const url = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/+$/, '')
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** 여행 코드 대신 이 값을 입력하면 관리자 화면이 열린다. */
export const ADMIN_GATE_CODE = '93519374'

export interface AdminTrip {
  id: string
  code: string
  name: string
  start_date: string
  end_date: string | null
  destinations: string[]
  tz: string
  spend_currencies: string[]
  created_at: string
  /** 이 여행에 딸린 지출 건수. 삭제할 때 뭘 잃는지 보여준다. */
  entry_count: number
}

export interface TripPatch {
  name?: string
  code?: string
  startDate?: string
  endDate?: string | null
  destinations?: string[]
  tz?: string
  spendCurrencies?: string[]
}

async function call<T>(payload: Record<string, unknown>): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${url}/functions/v1/admin-trips`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) return { ok: false, error: data?.error ?? '요청에 실패했어요.' }
    return { ok: true, data: data as T }
  } catch {
    return { ok: false, error: '네트워크를 확인해주세요.' }
  }
}

export function listTrips(adminPassword: string) {
  return call<{ trips: AdminTrip[] }>({ adminPassword, action: 'list' })
}

export function updateTrip(adminPassword: string, tripId: string, patch: TripPatch) {
  return call<{ trip: AdminTrip }>({ adminPassword, action: 'update', tripId, patch })
}

export function deleteTrip(adminPassword: string, tripId: string) {
  return call<{ ok: boolean }>({ adminPassword, action: 'delete', tripId })
}
