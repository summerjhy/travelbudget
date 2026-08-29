const url = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/+$/, '')
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** 여행 코드 대신 이 값을 입력하면 관리자 화면이 열린다. travelbudget의 ADMIN_GATE_CODE와는
 * 다른 값을 쓴다 — 두 앱은 서로 독립된 코드 체계라 숨은 문도 따로 둔다. */
export const ADMIN_GATE_CODE = '93529375'

export interface AdminJournalTrip {
  id: string
  code: string
  name: string
  start_date: string | null
  end_date: string | null
  matched_at: string | null
  revealed_at: string | null
  created_at: string
  member_count: number
}

export interface JournalTripPatch {
  name?: string
  code?: string
  startDate?: string | null
  endDate?: string | null
}

async function call<T>(
  functionName: string,
  payload: Record<string, unknown>,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${url}/functions/v1/${functionName}`, {
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

export function listJournalTrips(adminPassword: string) {
  return call<{ trips: AdminJournalTrip[] }>('admin-journal', { adminPassword, action: 'list' })
}

export function updateJournalTrip(adminPassword: string, tripId: string, patch: JournalTripPatch) {
  return call<{ trip: AdminJournalTrip }>('admin-journal', { adminPassword, action: 'update', tripId, patch })
}

export function deleteJournalTrip(adminPassword: string, tripId: string) {
  return call<{ ok: boolean }>('admin-journal', { adminPassword, action: 'delete', tripId })
}

export function createJournalTrip(
  adminPassword: string,
  input: { name: string; code: string; startDate?: string; endDate?: string; memberNames: string[] },
) {
  return call<{ code: string }>('create-journal-trip', { adminPassword, ...input })
}

export interface MatchingResult {
  memberCount: number
  matchedAt: string
}

export function runJournalMatching(adminPassword: string, tripCode: string, force = false) {
  return call<MatchingResult>('run-journal-matching', { adminPassword, tripCode, force })
}
