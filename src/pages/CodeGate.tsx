import { useState, type FormEvent } from 'react'
import { useTrip } from '../context/TripContext'
import { ADMIN_GATE_CODE } from '../lib/adminTrips'

export function CodeGate({ onCreateTrip, onAdmin }: { onCreateTrip: () => void; onAdmin: () => void }) {
  const { connectTrip, error: contextError } = useTrip()
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!/^\d{8}$/.test(code)) {
      setError('숫자 8자리를 입력해주세요.')
      return
    }
    // 여행 코드가 아니라 관리자 화면으로 가는 통로.
    if (code === ADMIN_GATE_CODE) {
      onAdmin()
      return
    }
    setSubmitting(true)
    setError(null)
    const result = await connectTrip(code)
    setSubmitting(false)
    if (!result.ok) {
      setError(result.error ?? '접속에 실패했어요.')
    }
  }

  return (
    <div className="wrap">
      <header className="head">
        <div className="eyebrow">여행 가계부</div>
        <h1 className="title">여행 코드를 입력하세요</h1>
      </header>
      <div className="pad">
        <form onSubmit={handleSubmit}>
          <div className="field" style={{ marginTop: 16 }}>
            <label className="lab" htmlFor="tripCode">참여 코드 (숫자 8자리)</label>
            <input
              id="tripCode"
              className="inp num"
              inputMode="numeric"
              maxLength={8}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="20260903"
              autoFocus
            />
          </div>
          <button className="btn" type="submit" disabled={submitting}>
            {submitting ? '확인 중...' : '들어가기'}
          </button>
        </form>
        {(error || contextError) && <p className="err">{error ?? contextError}</p>}
        <p className="note" style={{ marginTop: 16 }}>
          여행 관리자에게 받은 8자리 코드를 입력하면 그 여행 가계부로 들어가요.
          한 번 입력하면 다음부터는 자동으로 열려요.
        </p>
        <button
          className="btn quiet sm"
          style={{ width: 'auto', marginTop: 24, padding: '6px 10px' }}
          onClick={onCreateTrip}
        >
          관리자이신가요? 새 여행 만들기
        </button>
      </div>
    </div>
  )
}
