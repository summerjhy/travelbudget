import { createClient } from 'jsr:@supabase/supabase-js@2'
import { SYSTEM_PROMPT } from './prompt.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-trip-code',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface ParseImageBody {
  images: string[] // base64 JPEG, data URL 접두사 없이
}

interface GeminiParsedResult {
  merchant: string
  krw: number | null
  amount: number | null
  currency: string | null
  date: string | null
  time: string | null
}

const MAX_ITEMS_PER_IMAGE = 20

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-flash-latest'

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function callGeminiOnce(apiKey: string, imageBase64: string): Promise<{ result: GeminiParsedResult[] | null; status?: number }> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: SYSTEM_PROMPT },
              { inline_data: { mime_type: 'image/jpeg', data: imageBase64 } },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
        },
      }),
    },
  )

  if (!res.ok) {
    const errBody = await res.text()
    console.error('Gemini API error', res.status, errBody)
    return { result: null, status: res.status }
  }

  const data = await res.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) {
    console.error('Gemini response has no text', JSON.stringify(data))
    return { result: null }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    console.error('Gemini response text is not valid JSON', text)
    return { result: null }
  }

  // 스키마는 항상 배열이지만, 혹시 모델이 단일 객체로 응답하면 배열로 감싸 방어한다.
  const list = Array.isArray(parsed) ? parsed : [parsed]
  return { result: list.slice(0, MAX_ITEMS_PER_IMAGE) as GeminiParsedResult[] }
}

// 503(일시적 과부하)만 1회 재시도한다. 429(할당량 초과)는 재시도하지 않고 그 사진만 실패 처리한다.
// 여러 장을 병렬로 보내므로, 한 장의 429/503이 다른 장의 처리를 막지 않는다.
async function callGemini(apiKey: string, imageBase64: string): Promise<GeminiParsedResult[] | null> {
  const first = await callGeminiOnce(apiKey, imageBase64)
  if (first.result !== null || first.status !== 503) return first.result

  console.log('Gemini 503, retrying once after 2s')
  await sleep(2000)
  const second = await callGeminiOnce(apiKey, imageBase64)
  return second.result
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'POST만 지원합니다.' }, 405)
  }

  const tripCode = req.headers.get('x-trip-code')
  if (!tripCode) {
    return jsonResponse({ error: 'x-trip-code 헤더가 필요합니다.' }, 400)
  }

  const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
  if (!geminiApiKey) {
    return jsonResponse({ error: '서버에 Gemini API 키가 설정되지 않았습니다.' }, 500)
  }

  let body: ParseImageBody
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: '요청 본문이 올바른 JSON이 아닙니다.' }, 400)
  }

  if (!Array.isArray(body.images) || body.images.length === 0) {
    return jsonResponse({ error: '이미지가 없습니다.' }, 400)
  }
  if (body.images.length > 5) {
    return jsonResponse({ error: '사진은 최대 5장까지 가능해요.' }, 400)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
  const { data: trip } = await supabase.from('trips').select('id').eq('code', tripCode).maybeSingle()
  if (!trip) {
    return jsonResponse({ error: '존재하지 않는 여행 코드입니다.' }, 401)
  }

  // 여러 장을 동시에 보낸다. 한 장이 실패(429/타임아웃 등)해도 나머지는 계속 처리된다.
  const settled = await Promise.allSettled(body.images.map((image) => callGemini(geminiApiKey, image)))
  const results = settled.map((s) => (s.status === 'fulfilled' ? s.value : null))

  // 이미지는 파싱 후 즉시 폐기한다(저장하지 않음) — SPEC 6-1 준수.
  return jsonResponse({ results }, 200)
})
