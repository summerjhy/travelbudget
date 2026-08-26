import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-trip-code',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const BASE_CURRENCY = 'KRW'

interface FetchRateBody {
  date: string
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

async function fetchFromFrankfurter(date: string, from: string): Promise<number | null> {
  try {
    const res = await fetch(`https://api.frankfurter.app/${date}?from=${from}&to=${BASE_CURRENCY}`)
    if (!res.ok) return null
    const data = await res.json()
    const rate = data?.rates?.[BASE_CURRENCY]
    return typeof rate === 'number' ? rate : null
  } catch {
    return null
  }
}

async function fetchFromOpenErApi(from: string): Promise<number | null> {
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${from}`)
    if (!res.ok) return null
    const data = await res.json()
    const rate = data?.rates?.[BASE_CURRENCY]
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
    .select('id, spend_currencies')
    .eq('code', tripCode)
    .maybeSingle()

  if (!trip) {
    return jsonResponse({ error: '존재하지 않는 여행 코드입니다.' }, 401)
  }

  // 조회 대상은 여행이 정한다. 클라이언트가 지정하게 두면 그 여행과 상관없는
  // 통화가 rates 에 섞여 들어올 수 있다.
  const listed: string[] = trip.spend_currencies ?? []
  const currencies = [...new Set(listed.filter((c) => c && c !== BASE_CURRENCY))]

  // 원화만 쓰는 여행이면 환산할 게 없다.
  if (currencies.length === 0) {
    return jsonResponse({ date: body.date, rates: {}, sources: {} }, 200)
  }

  const { data: cached } = await supabase
    .from('rates')
    .select('currency, rate')
    .eq('trip_id', trip.id)
    .eq('date', body.date)

  const cachedByCurrency = new Map<string, number>()
  for (const row of cached ?? []) cachedByCurrency.set(row.currency ?? 'CNY', Number(row.rate))

  const rates: Record<string, number> = {}
  const sources: Record<string, string> = {}
  const toUpsert: { trip_id: string; date: string; currency: string; rate: number }[] = []

  // 통화마다 독립적으로 조회한다. 한 통화가 실패해도 나머지는 그대로 돌려준다.
  await Promise.all(
    currencies.map(async (currency) => {
      const hit = cachedByCurrency.get(currency)
      if (hit !== undefined) {
        rates[currency] = hit
        sources[currency] = 'cache'
        return
      }

      let rate = await fetchFromFrankfurter(body.date, currency)
      let source = 'frankfurter'
      if (rate === null) {
        rate = await fetchFromOpenErApi(currency)
        source = 'open.er-api'
      }

      if (rate === null) {
        // 외부 조회가 안 되면 그 통화의 가장 최근 저장값으로 버틴다.
        const { data: latest } = await supabase
          .from('rates')
          .select('date, rate')
          .eq('trip_id', trip.id)
          .eq('currency', currency)
          .order('date', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (latest) {
          rates[currency] = Number(latest.rate)
          sources[currency] = 'fallback'
        }
        return
      }

      rates[currency] = rate
      sources[currency] = source
      toUpsert.push({ trip_id: trip.id, date: body.date, currency, rate })
    }),
  )

  if (toUpsert.length > 0) {
    const { error: upsertError } = await supabase.from('rates').upsert(toUpsert)
    if (upsertError) {
      return jsonResponse({ error: '환율 저장에 실패했습니다.' }, 500)
    }
  }

  if (Object.keys(rates).length === 0) {
    return jsonResponse({ error: '환율 조회에 실패했고 저장된 값도 없습니다. 직접 입력해주세요.' }, 502)
  }

  return jsonResponse({ date: body.date, rates, sources }, 200)
})
