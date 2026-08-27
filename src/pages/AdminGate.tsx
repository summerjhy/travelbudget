import { useState } from 'react'
import { useAdmin } from '../context/AdminContext'

/** 관리자 비밀번호 입력. 한 번 통과하면 세션이 열려 다시 묻지 않는다. */
export function AdminGate({ onBack }: { onBack: () => void }) {
  const { signIn } = useAdmin()
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setBusy(true)
    setError(null)
    const result = await signIn(pw)
    setBusy(false)
    if (!result.ok) setError(result.error ?? '확인에 실패했어요.')
  }

  return (
    <div className="wrap">
      <header className="head">
        <div className="headrow">
          <h1 className="title">🛠 관리자</h1>
        </div>
        <div className="remain">
          <span><span>비밀번호를 확인할게요</span></span>
        </div>
      </header>
      <div className="pad">
        <div className="field" style={{ marginTop: 16 }}>
          <label className="lab" htmlFor="adminPw">관리자 비밀번호</label>
          <input
            id="adminPw"
            className="inp"
            type="password"
            value={pw}
            autoFocus
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
          />
        </div>
        <button className="btn" onClick={submit} disabled={busy}>
          {busy ? '확인 중...' : '들어가기'}
        </button>
        <button className="btn quiet" style={{ marginTop: 9 }} onClick={onBack}>돌아가기</button>
        {error && <p className="err">{error}</p>}
        <p className="note" style={{ marginTop: 16 }}>
          한 번 입력하면 이 창을 닫기 전까지 다시 묻지 않아요.
        </p>
      </div>
    </div>
  )
}
