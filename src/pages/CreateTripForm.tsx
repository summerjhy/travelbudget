import { useState } from 'react'
import { createTrip } from '../lib/createTrip'

const CURRENCY_OPTIONS = ['CNY', 'JPY', 'USD', 'EUR', 'THB', 'VND']

export function CreateTripForm({ onBack, onCreated }: { onBack: () => void; onCreated: (code: string) => void }) {
  const [adminPassword, setAdminPassword] = useState('')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [destinationInput, setDestinationInput] = useState('')
  const [destinations, setDestinations] = useState<string[]>([])
  const [currencies, setCurrencies] = useState<string[]>(['CNY'])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addDestination() {
    const v = destinationInput.trim()
    if (!v || destinations.includes(v)) return
    setDestinations((prev) => [...prev, v])
    setDestinationInput('')
  }

  function removeDestination(d: string) {
    setDestinations((prev) => prev.filter((x) => x !== d))
  }

  function toggleCurrency(c: string) {
    setCurrencies((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))
  }

  async function handleSubmit() {
    setError(null)
    if (!/^\d{8}$/.test(code)) {
      setError('코드는 숫자 8자리로 입력해주세요.')
      return
    }
    if (!name.trim()) {
      setError('여행 이름을 입력해주세요.')
      return
    }
    if (!startDate) {
      setError('시작일을 입력해주세요.')
      return
    }
    if (!adminPassword) {
      setError('관리자 비밀번호를 입력해주세요.')
      return
    }

    setSubmitting(true)
    const result = await createTrip({
      adminPassword,
      code,
      name: name.trim(),
      startDate,
      endDate: endDate || undefined,
      destinations,
      spendCurrencies: currencies.length ? currencies : ['CNY'],
    })
    setSubmitting(false)

    if (!result.ok) {
      setError(result.error ?? '여행 생성에 실패했어요.')
      return
    }
    onCreated(code)
  }

  return (
    <div className="wrap">
      <header className="head">
        <div className="eyebrow">관리자</div>
        <h1 className="title">새 여행 만들기</h1>
      </header>
      <div className="pad">
        <div className="field" style={{ marginTop: 16 }}>
          <label className="lab" htmlFor="adminPassword">관리자 비밀번호</label>
          <input
            id="adminPassword"
            className="inp"
            type="password"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
          />
        </div>

        <div className="field">
          <label className="lab" htmlFor="newCode">참여 코드 (숫자 8자리, 직접 지정)</label>
          <input
            id="newCode"
            className="inp num"
            inputMode="numeric"
            maxLength={8}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="예: 20260903"
          />
        </div>

        <div className="field">
          <label className="lab" htmlFor="tripName">여행 이름</label>
          <input
            id="tripName"
            className="inp"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 상하이 2026"
          />
        </div>

        <div className="row2">
          <div className="field" style={{ flex: 1 }}>
            <label className="lab" htmlFor="startDate">시작일</label>
            <input id="startDate" className="inp" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label className="lab" htmlFor="endDate">종료일 (선택)</label>
            <input id="endDate" className="inp" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>

        <div className="field">
          <label className="lab">여행 목적지 (복수 가능)</label>
          <div className="row2" style={{ marginBottom: 8 }}>
            <input
              className="inp"
              value={destinationInput}
              onChange={(e) => setDestinationInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addDestination()
                }
              }}
              placeholder="예: 중국 상하이"
            />
            <button className="btn ghost" style={{ flex: '0 0 80px' }} onClick={addDestination}>추가</button>
          </div>
          {destinations.length > 0 && (
            <div className="chips">
              {destinations.map((d) => (
                <button key={d} className="chip on" onClick={() => removeDestination(d)}>{d} ✕</button>
              ))}
            </div>
          )}
        </div>

        <div className="field">
          <label className="lab">사용 통화 (복수 가능)</label>
          <div className="chips">
            {CURRENCY_OPTIONS.map((c) => (
              <button
                key={c}
                className={'chip' + (currencies.includes(c) ? ' on' : '')}
                onClick={() => toggleCurrency(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <button className="btn" onClick={handleSubmit} disabled={submitting} style={{ marginTop: 9 }}>
          {submitting ? '만드는 중...' : '여행 만들기'}
        </button>
        <button className="btn quiet" onClick={onBack} style={{ marginTop: 9 }}>취소</button>

        {error && <p className="err">{error}</p>}
        <div style={{ height: 30 }} />
      </div>
    </div>
  )
}
