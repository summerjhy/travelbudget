import { useMemo, useState } from 'react'
import { createTrip } from '../lib/createTrip'
import { CURRENCY_GROUPS, currencyLabel } from '../lib/currencies'
import { CONTINENTS, destinationLabel } from '../lib/destinations'
import { tzOfFirstDestination } from '../lib/tripDate'

/** 도시 셀렉트의 특수 항목 값. 실제 도시 이름과 겹치지 않도록 언더스코어를 쓴다. */
const CITY_NONE = '__none__'
const CITY_CUSTOM = '__custom__'

export function CreateTripForm({ onBack, onCreated }: { onBack: () => void; onCreated: (code: string) => void }) {
  const [adminPassword, setAdminPassword] = useState('')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [continent, setContinent] = useState('')
  const [country, setCountry] = useState('')
  const [city, setCity] = useState('')
  const [customCity, setCustomCity] = useState('')
  const [destinations, setDestinations] = useState<string[]>([])
  const [currencies, setCurrencies] = useState<string[]>(['KRW'])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const countries = useMemo(
    () => CONTINENTS.find((c) => c.name === continent)?.countries ?? [],
    [continent],
  )
  const cities = useMemo(
    () => countries.find((c) => c.name === country)?.cities ?? [],
    [countries, country],
  )

  function pickContinent(v: string) {
    setContinent(v)
    setCountry('')
    setCity('')
    setCustomCity('')
  }

  function pickCountry(v: string) {
    setCountry(v)
    setCity('')
    setCustomCity('')
    // 나라를 고르면 그 나라 통화를 사용 통화에 바로 넣어준다 (KRW 는 처음부터 선택돼 있다).
    const picked = countries.find((c) => c.name === v)
    if (picked) addCurrency(picked.currency)
  }

  function addDestination() {
    if (!country) return
    if (city === CITY_CUSTOM && !customCity.trim()) return
    const picked = city === CITY_CUSTOM ? customCity : city === CITY_NONE ? '' : city
    const label = destinationLabel(country, picked)
    if (destinations.includes(label)) return
    setDestinations((prev) => [...prev, label])
    setCity('')
    setCustomCity('')
  }

  function removeDestination(d: string) {
    setDestinations((prev) => prev.filter((x) => x !== d))
  }

  function addCurrency(c: string) {
    if (!c || currencies.includes(c)) return
    setCurrencies((prev) => [...prev, c])
  }

  function removeCurrency(c: string) {
    setCurrencies((prev) => prev.filter((x) => x !== c))
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
      // '오늘' 판정 기준. 목적지 나라의 시간대를 그대로 박아둔다.
      tz: countries.find((c) => c.name === country)?.tz ?? tzOfFirstDestination(destinations),
      spendCurrencies: currencies.length ? currencies : ['KRW'],
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
            <select
              className="inp sel"
              aria-label="대륙"
              value={continent}
              onChange={(e) => pickContinent(e.target.value)}
            >
              <option value="">대륙 선택</option>
              {CONTINENTS.map((c) => (
                <option key={c.name} value={c.name}>{c.name}</option>
              ))}
            </select>
            <select
              className="inp sel"
              aria-label="나라"
              value={country}
              disabled={!continent}
              onChange={(e) => pickCountry(e.target.value)}
            >
              <option value="">나라 선택</option>
              {countries.map((c) => (
                <option key={c.name} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="row2" style={{ marginBottom: 8 }}>
            <select
              className="inp sel"
              aria-label="도시"
              value={city}
              disabled={!country}
              onChange={(e) => setCity(e.target.value)}
            >
              <option value="">도시 선택</option>
              {cities.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
              <option value={CITY_NONE}>도시 미정 (나라만)</option>
              <option value={CITY_CUSTOM}>직접 입력…</option>
            </select>
            <button className="btn ghost" style={{ flex: '0 0 80px' }} onClick={addDestination}>추가</button>
          </div>
          {city === CITY_CUSTOM && (
            <input
              className="inp"
              style={{ marginBottom: 8 }}
              value={customCity}
              onChange={(e) => setCustomCity(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addDestination()
                }
              }}
              placeholder="도시 이름을 직접 입력"
              autoFocus
            />
          )}
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
          <p className="note" style={{ margin: '0 0 8px' }}>
            목적지 나라를 고르면 그 나라 통화가 자동으로 들어와요. 칩을 누르면 뺄 수 있어요.
          </p>
          <select
            className="inp sel"
            aria-label="통화 추가"
            style={{ marginBottom: 8 }}
            value=""
            onChange={(e) => addCurrency(e.target.value)}
          >
            <option value="">통화 추가…</option>
            {CURRENCY_GROUPS.map((g) => (
              <optgroup key={g.region} label={g.region}>
                {g.items
                  .filter((c) => !currencies.includes(c.code))
                  .map((c) => (
                    <option key={c.code} value={c.code}>{`${c.code} (${c.country} ${c.unit})`}</option>
                  ))}
              </optgroup>
            ))}
          </select>
          {currencies.length > 0 && (
            <div className="chips">
              {currencies.map((c) => (
                <button key={c} className="chip on" onClick={() => removeCurrency(c)}>{currencyLabel(c)} ✕</button>
              ))}
            </div>
          )}
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
