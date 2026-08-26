const url = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/+$/, '')
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export interface FetchRateResult {
  ok: boolean
  rate?: number
  source?: string
  error?: string
}

export async function fetchRateForDate(tripCode: string, date: string): Promise<FetchRateResult> {
  try {
    const res = await fetch(`${url}/functions/v1/fetch-rate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'x-trip-code': tripCode,
      },
      body: JSON.stringify({ date }),
    })
    const data = await res.json()
    if (!res.ok) return { ok: false, error: data?.error ?? '환율 조회에 실패했어요.' }
    return { ok: true, rate: data.rate, source: data.source }
  } catch {
    return { ok: false, error: '환율 조회에 실패했어요. 네트워크를 확인해주세요.' }
  }
}
