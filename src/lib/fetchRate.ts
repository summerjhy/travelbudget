const url = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/+$/, '')
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export interface FetchRatesResult {
  ok: boolean
  /** 통화 코드 → 1 통화당 원화 */
  rates?: Record<string, number>
  /** 통화 코드 → 어디서 가져왔는지 (cache / frankfurter / open.er-api / fallback) */
  sources?: Record<string, string>
  error?: string
}

/**
 * 그 날짜의 환율을 여행에 설정된 외화 전부에 대해 한 번에 조회한다.
 * 어느 통화를 가져올지는 Edge Function 이 trips.spend_currencies 를 보고 정한다.
 */
export async function fetchRatesForDate(tripCode: string, date: string): Promise<FetchRatesResult> {
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
    return { ok: true, rates: data.rates ?? {}, sources: data.sources ?? {} }
  } catch {
    return { ok: false, error: '환율 조회에 실패했어요. 네트워크를 확인해주세요.' }
  }
}
