import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { listTrips } from '../lib/adminTrips'

/**
 * 관리자 세션.
 *
 * 비밀번호를 한 번만 받고 이후 화면들이 그 값을 공유한다. 예전에는 새 여행
 * 만들기와 여행 관리가 각각 비밀번호를 물어서 두 번 입력해야 했다.
 *
 * 메모리에만 둔다 — localStorage 에 넣으면 기기를 잃거나 남이 만졌을 때
 * 여행을 지울 수 있는 비밀번호가 그대로 남는다. 새로고침하면 다시 묻는다.
 */
interface AdminContextValue {
  /** 인증된 관리자 비밀번호. 인증 전에는 null. */
  password: string | null
  authed: boolean
  /** 서버에 물어 비밀번호가 맞는지 확인하고, 맞으면 세션을 연다. */
  signIn: (pw: string) => Promise<{ ok: boolean; error?: string }>
  signOut: () => void
}

const AdminContext = createContext<AdminContextValue | null>(null)

export function AdminProvider({ children }: { children: ReactNode }) {
  const [password, setPassword] = useState<string | null>(null)

  const signIn = useCallback(async (pw: string) => {
    if (!pw) return { ok: false, error: '관리자 비밀번호를 입력해주세요.' }
    // 목록 조회로 비밀번호를 검증한다. 틀리면 서버가 401 을 준다.
    const result = await listTrips(pw)
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
