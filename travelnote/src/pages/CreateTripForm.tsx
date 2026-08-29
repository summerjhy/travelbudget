import { useState, type FormEvent } from 'react'
import { useAdmin } from '../context/AdminContext'
import { createJournalTrip } from '../lib/adminJournal'

export function CreateTripForm({
  onBack,
  onCreated,
}: {
  onBack: () => void
  onCreated: (code: string) => void
}) {
  const { password } = useAdmin()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [memberInput, setMemberInput] = useState('')
  const [memberNames, setMemberNames] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addMember() {
    const v = memberInput.trim()
    if (!v || memberNames.includes(v)) return
    setMemberNames([...memberNames, v])
    setMemberInput('')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!password) return
    if (!/^\d{8}$/.test(code)) {
      setError('코드는 숫자 8자리여야 해요.')
      return
    }
    if (!name.trim()) {
      setError('이름을 입력해주세요.')
      return
    }
    setSubmitting(true)
    setError(null)
    const result = await createJournalTrip(password, {
      name: name.trim(),
      code,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      memberNames,
    })
    setSubmitting(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    onCreated(code)
  }

  return (
    <div className="wrap">
      <header className="head">
        <div className="headrow">
          <h1 className="title">➕ 새 관찰일지 만들기</h1>
        </div>
      </header>
      <div className="pad">
        <button className="btn quiet" style={{ marginBottom: 12 }} onClick={onBack}>돌아가기</button>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label className="lab">관찰일지 이름</label>
            <input className="inp" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 상하이 여행" />
          </div>
          <div className="field">
            <label className="lab">참여 코드 (숫자 8자리)</label>
            <input
              className="inp num"
              inputMode="numeric"
              maxLength={8}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="20260903"
            />
          </div>
          <div className="row2">
            <div className="field" style={{ flex: 1 }}>
              <label className="lab">시작일</label>
              <input className="inp" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label className="lab">종료일</label>
              <input className="inp" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label className="lab">참여자 이름 (선택, 미리 등록)</label>
            <div className="row2" style={{ marginBottom: 6 }}>
              <input
                className="inp"
                placeholder="예: 소영"
                maxLength={10}
                value={memberInput}
                onChange={(e) => setMemberInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addMember() } }}
              />
              <button type="button" className="btn ghost sm" style={{ flex: '0 0 66px' }} onClick={addMember}>추가</button>
            </div>
            <div className="chips">
              {memberNames.map((n) => (
                <button
                  type="button"
                  key={n}
                  className="chip on"
                  onClick={() => setMemberNames(memberNames.filter((x) => x !== n))}
                >
                  {n} ✕
                </button>
              ))}
            </div>
            <p className="note" style={{ marginTop: 6 }}>
              미리 등록하지 않아도, 참여자가 직접 코드로 접속해 이름을 입력할 수 있어요.
            </p>
          </div>

          <button className="btn" type="submit" disabled={submitting}>
            {submitting ? '만드는 중...' : '만들기'}
          </button>
        </form>
        {error && <p className="err">{error}</p>}
      </div>
    </div>
  )
}
