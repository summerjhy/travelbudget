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
  monthDay: string | null
  time: string | null
}

/** 사진 한 장의 실패 사유. 클라이언트가 이유별로 다른 안내를 보여준다. */
type FailReason = 'overloaded' | 'quota' | 'other'

const MAX_ITEMS_PER_IMAGE = 20

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-flash-latest'
const CLAUDE_MODEL = Deno.env.get('CLAUDE_MODEL') || 'claude-haiku-4-5'

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function reasonForStatus(status: number): FailReason {
  if (status === 503) return 'overloaded'
  if (status === 429) return 'quota'
  return 'other'
}

async function callGeminiOnce(
  apiKey: string,
  imageBase64: string,
): Promise<{ result: GeminiParsedResult[] | null; status?: number }> {
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
          // 화면에서 텍스트를 읽어 JSON으로 옮기는 기계적인 작업이라 복잡한
          // 추론이 필요 없다. Flash 계열은 기본적으로 "생각하기"에 시간을
          // 더 쓰는데, 이 작업엔 불필요한 지연이라 꺼서 응답을 앞당긴다.
          thinkingConfig: { thinkingBudget: 0 },
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

/**
 * 503(일시적 과부하)만 1회 재시도한다. 429(할당량 초과)는 재시도하지 않고
 * 그 사진만 실패 처리한다. 여러 장을 병렬로 보내므로, 한 장의 429/503이
 * 다른 장의 처리를 막지 않는다.
 *
 * 실패 사유(reason)를 함께 돌려준다 — 클라이언트가 "서버가 붐벼요, 나중에
 * 다시 시도해주세요"(overloaded)와 "그냥 인식이 안 됐어요, 직접입력
 * 해주세요"(other)를 구분해서 안내할 수 있어야 하기 때문이다.
 */
async function callGemini(
  apiKey: string,
  imageBase64: string,
): Promise<{ result: GeminiParsedResult[] | null; reason: FailReason | null }> {
  const first = await callGeminiOnce(apiKey, imageBase64)
  if (first.result !== null) return { result: first.result, reason: null }
  if (first.status !== 503) {
    return { result: null, reason: first.status ? reasonForStatus(first.status) : 'other' }
  }

  console.log('Gemini 503, retrying once after 2s')
  await sleep(2000)
  const second = await callGeminiOnce(apiKey, imageBase64)
  if (second.result !== null) return { result: second.result, reason: null }
  return { result: null, reason: second.status ? reasonForStatus(second.status) : 'other' }
}

/**
 * Gemini가 과부하(503)나 할당량 초과(429)로 실패했을 때만 쓰는 유료 폴백.
 * Claude Haiku 4.5는 저렴하고(이미지 1장당 1원 단위) 이 작업(화면에서
 * 텍스트를 읽어 JSON으로 옮기는 단순 추출)에 충분한 성능이라 골랐다.
 * 평소엔 무료인 Gemini만 쓰고, Gemini가 막혔을 때만 비용이 발생한다.
 */
async function callClaudeOnce(
  apiKey: string,
  imageBase64: string,
): Promise<{ result: GeminiParsedResult[] | null }> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 } },
            { type: 'text', text: '위 화면을 분석해서 지시된 JSON 스키마로만 응답해줘.' },
          ],
        },
      ],
    }),
  })

  if (!res.ok) {
    const errBody = await res.text()
    console.error('Claude API error', res.status, errBody)
    return { result: null }
  }

  const data = await res.json()
  const text = data?.content?.find((b: { type: string }) => b.type === 'text')?.text
  if (!text) {
    console.error('Claude response has no text', JSON.stringify(data))
    return { result: null }
  }

  let parsed: unknown
  try {
    // Claude는 시스템 프롬프트에 "JSON만 응답"이라고 지시해도 가끔 코드블록(```json ... ```)으로
    // 감싸서 답할 때가 있다. Gemini는 responseMimeType 강제라 이 문제가 없지만 Claude API엔
    // 그런 강제 옵션이 없어 방어적으로 벗겨낸다.
    const stripped = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '')
    parsed = JSON.parse(stripped)
  } catch {
    console.error('Claude response text is not valid JSON', text)
    return { result: null }
  }

  const list = Array.isArray(parsed) ? parsed : [parsed]
  return { result: list.slice(0, MAX_ITEMS_PER_IMAGE) as GeminiParsedResult[] }
}

/**
 * Gemini가 overloaded/quota로 실패했을 때만 Claude로 넘어간다. Gemini가
 * 응답 형식 오류 등(other)으로 실패했을 때는 같은 이미지를 다른 모델에
 * 줘도 대개 같은 종류의 문제(글자가 안 보이는 캡처 등)일 가능성이 높아
 * 굳이 유료 호출을 쓰지 않는다 — overloaded/quota만 "우리 쪽이 아니라
 * Gemini 서버 사정"이라 폴백할 가치가 있다.
 */
async function callGeminiWithFallback(
  geminiApiKey: string,
  claudeApiKey: string | null,
  imageBase64: string,
): Promise<{ result: GeminiParsedResult[] | null; reason: FailReason | null; usedFallback: boolean }> {
  const primary = await callGemini(geminiApiKey, imageBase64)
  if (primary.result !== null) return { ...primary, usedFallback: false }
  if (!claudeApiKey || (primary.reason !== 'overloaded' && primary.reason !== 'quota')) {
    return { ...primary, usedFallback: false }
  }

  console.log(`Gemini failed (${primary.reason}), falling back to Claude`)
  const fallback = await callClaudeOnce(claudeApiKey, imageBase64)
  if (fallback.result !== null) return { result: fallback.result, reason: null, usedFallback: true }
  // Claude도 실패하면 원래 Gemini 실패 사유를 그대로 클라이언트에 전달한다
  // (Claude 실패는 부가 정보일 뿐, 사용자에게 보여줄 주된 사유는 Gemini 쪽이다).
  return { result: null, reason: primary.reason, usedFallback: false }
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
  // 없어도 그냥 폴백 없이 Gemini만 쓴다 — 필수 시크릿이 아니다.
  const claudeApiKey = Deno.env.get('ANTHROPIC_API_KEY') || null

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
  const settled = await Promise.allSettled(
    body.images.map((image) => callGeminiWithFallback(geminiApiKey, claudeApiKey, image)),
  )
  const results = settled.map((s) => (s.status === 'fulfilled' ? s.value.result : null))
  const reasons = settled.map((s) => (s.status === 'fulfilled' ? s.value.reason : 'other' as FailReason))
  const usedFallbackCount = settled.filter((s) => s.status === 'fulfilled' && s.value.usedFallback).length
  if (usedFallbackCount > 0) console.log(`Claude fallback used for ${usedFallbackCount}/${body.images.length} image(s)`)

  // 이미지는 파싱 후 즉시 폐기한다(저장하지 않음) — SPEC 6-1 준수.
  return jsonResponse({ results, reasons }, 200)
})
