const url = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/+$/, '')
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export interface CreateTripInput {
  adminPassword: string
  code: string
  name: string
  startDate: string
  endDate?: string
  destinations?: string[]
  baseCurrency?: string
  spendCurrencies?: string[]
}

export interface CreateTripResult {
  ok: boolean
  error?: string
}

export async function createTrip(input: CreateTripInput): Promise<CreateTripResult> {
  try {
    const res = await fetch(`${url}/functions/v1/create-trip`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify(input),
    })
    const data = await res.json()
    if (!res.ok) return { ok: false, error: data?.error ?? '여행 생성에 실패했어요.' }
    return { ok: true }
  } catch {
    return { ok: false, error: '여행 생성에 실패했어요. 네트워크를 확인해주세요.' }
  }
}
