/**
 * supabase-js는 네트워크가 끊겨도 throw하지 않고 {data: null, error}로
 * 정상 반환한다(travelbudget 8단계에서 확인된 함정, 여기도 동일). 그래서
 * "저장이 실패했다"는 사실만으로는 오프라인인지 서버가 진짜로 거부한
 * 것인지(RLS 위반 등) 구분할 수 없다 — navigator.onLine과 에러 메시지를
 * 함께 봐야 한다.
 */
export function isNetworkError(error: { message?: string } | null): boolean {
  if (!navigator.onLine) return true
  if (!error?.message) return false
  return /failed to fetch|networkerror|load failed/i.test(error.message)
}
