import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { listJournalTrips } from '../lib/adminJournal'

/**
 * 관리자 세션. travelbudget의 AdminContext와 동일한 설계 —
 * 비밀번호는 메모리에만 두고(localStorage 미사용) 새로고침하면 다시 묻는다.
 * 제비뽑기 실행 같은 되돌리기 어려운 동작을 가드하는 값이라 기기 분실 시
 * 남이 쓸 수 있으면 곤란하다.
 */
interface AdminContextValue {
  password: string | null
  authed: boolean
  signIn: (pw: string) => Promise<{ ok: boolean; error?: string }>
  signOut: () => void
}

const AdminContext = createContext<AdminContextValue | null>(null)

export function AdminProvider({ children }: { children: ReactNode }) {
  const [password, setPassword] = useState<string | null>(null)

  const signIn = useCallback(async (pw: string) => {
    if (!pw) return { ok: false, error: '관리자 비밀번호를 입력해주세요.' }
    const result = await listJournalTrips(pw)
    if (!result.ok) return { ok: false, error: result.error }
    setPassword(pw)
    return { ok: true }
  }, [])

  const signOut = useCallback(() => setPassword(null), [])

  const value = useMemo<AdminContextValue>(
    () => ({ password, authed: password !== null, signIn, signOut }),
    [password, signIn, signOut],
  )

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>
}

export function useAdmin() {
  const ctx = useContext(AdminContext)
  if (!ctx) throw new Error('useAdmin은 AdminProvider 안에서만 사용할 수 있습니다.')
  return ctx
}
