import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-trip-code',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface FetchRateBody {
  date: string
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

async function fetchFromFrankfurter(date: string): Promise<number | null> {
  try {
    const res = await fetch(`https://api.frankfurter.app/${date}?from=CNY&to=KRW`)
    if (!res.ok) return null
    const data = await res.json()
    const rate = data?.rates?.KRW
    return typeof rate === 'number' ? rate : null
  } catch {
    return null
  }
}

async function fetchFromOpenErApi(): Promise<number | null> {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/CNY')
    if (!res.ok) return null
    const data = await res.json()
    const rate = data?.rates?.KRW
    return typeof rate === 'number' ? rate : null
  } catch {
    return null
  }
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

  let body: FetchRateBody
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: '요청 본문이 올바른 JSON이 아닙니다.' }, 400)
  }

  if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    return jsonResponse({ error: '날짜는 YYYY-MM-DD 형식이어야 합니다.' }, 400)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: trip } = await supabase
    .from('trips')
    .select('id')
    .eq('code', tripCode)
    .maybeSingle()

  if (!trip) {
    return jsonResponse({ error: '존재하지 않는 여행 코드입니다.' }, 401)
  }

  const { data: existing } = await supabase
    .from('rates')
    .select('rate')
    .eq('trip_id', trip.id)
    .eq('date', body.date)
    .maybeSingle()

  if (existing) {
    return jsonResponse({ date: body.date, rate: existing.rate, source: 'cache' }, 200)
  }

  let rate = await fetchFromFrankfurter(body.date)
  let source = 'frankfurter'
  if (rate === null) {
    rate = await fetchFromOpenErApi()
    source = 'open.er-api'
  }

  if (rate === null) {
    const { data: latest } = await supabase
      .from('rates')
      .select('date, rate')
      .eq('trip_id', trip.id)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!latest) {
      return jsonResponse({ error: '환율 조회에 실패했고 저장된 값도 없습니다. 직접 입력해주세요.' }, 502)
    }
    return jsonResponse({ date: body.date, rate: latest.rate, source: 'fallback', fallbackFrom: latest.date }, 200)
  }

  const { error: upsertError } = await supabase
    .from('rates')
    .upsert({ trip_id: trip.id, date: body.date, rate })

  if (upsertError) {
    return jsonResponse({ error: '환율 저장에 실패했습니다.' }, 500)
  }

  return jsonResponse({ date: body.date, rate, source }, 200)
})
