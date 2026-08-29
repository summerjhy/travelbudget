import { useEffect, useState } from 'react'
import { useNote } from '../context/NoteContext'
import { useReminder } from '../lib/useReminder'
import { enableJournalPush, pushEnabled, pushSupported, sendTestJournalPush } from '../lib/journalPush'

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const INTERVALS = [30, 60, 90, 120, 180, 240]

export function SettingsTab() {
  const { trip, member, switchTrip } = useNote()
  const { reminder, save } = useReminder(trip?.id, member?.id)

  const [enabled, setEnabled] = useState(true)
  const [startHour, setStartHour] = useState(9)
  const [endHour, setEndHour] = useState(22)
  const [intervalMinutes, setIntervalMinutes] = useState(120)
  const [notice, setNotice] = useState<string | null>(null)
  const [pushOn, setPushOn] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!reminder) return
    setEnabled(reminder.enabled)
    setStartHour(reminder.start_hour)
    setEndHour(reminder.end_hour)
    setIntervalMinutes(reminder.interval_minutes)
  }, [reminder])

  useEffect(() => {
    pushEnabled().then(setPushOn)
  }, [])

  async function handleSave() {
    setBusy(true)
    setNotice(null)
    const result = await save({ enabled, startHour, endHour, intervalMinutes })
    setBusy(false)
    setNotice(result.ok ? '저장했어요.' : (result.error ?? '저장에 실패했어요.'))
  }

  async function handleEnablePush() {
    if (!trip || !member) return
    setBusy(true)
    const result = await enableJournalPush(trip.code, member.id)
    setBusy(false)
    if (result.ok) {
      setPushOn(true)
      setNotice('알림을 켰어요.')
    } else {
      setNotice(result.error ?? '알림 등록에 실패했어요.')
    }
  }

  async function handleTestPush() {
    if (!trip || !member) return
    const result = await sendTestJournalPush(trip.code, member.id)
    setNotice(result.ok ? '테스트 알림을 보냈어요.' : (result.error ?? '실패했어요.'))
  }

  return (
    <section className="pad">
      <div className="sec first">🔔 리마인더</div>
      <div className="box" style={{ padding: '4px 14px 14px' }}>
        <div className="field" style={{ marginTop: 13 }}>
          <label className="lab">메모 알림 받기</label>
          <div className="chips">
            <button className={'chip' + (enabled ? ' on' : '')} onClick={() => setEnabled(true)}>켜기</button>
            <button className={'chip' + (!enabled ? ' on' : '')} onClick={() => setEnabled(false)}>끄기</button>
          </div>
        </div>
        <div className="row2">
          <div className="field" style={{ flex: 1 }}>
            <label className="lab">시작 시각</label>
            <select className="inp sel" value={startHour} onChange={(e) => setStartHour(Number(e.target.value))}>
              {HOURS.map((h) => <option key={h} value={h}>{h}시</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label className="lab">종료 시각</label>
            <select className="inp sel" value={endHour} onChange={(e) => setEndHour(Number(e.target.value))}>
              {HOURS.map((h) => <option key={h} value={h}>{h}시</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label className="lab">알림 간격</label>
          <select className="inp sel" value={intervalMinutes} onChange={(e) => setIntervalMinutes(Number(e.target.value))}>
            {INTERVALS.map((m) => (
              <option key={m} value={m}>{m < 60 ? `${m}분` : `${m / 60}시간`}마다</option>
            ))}
          </select>
        </div>
        <button className="btn sm" onClick={handleSave} disabled={busy}>저장</button>
      </div>

      <div className="sec">📱 알림 받기</div>
      <div className="box" style={{ padding: '13px 14px' }}>
        {!pushSupported() ? (
          <p className="note">이 브라우저는 알림을 지원하지 않아요.</p>
        ) : pushOn ? (
          <>
            <p className="note" style={{ marginBottom: 8 }}>이 기기에서 알림을 받고 있어요.</p>
            <button className="btn ghost sm" onClick={handleTestPush}>테스트 알림 보내기</button>
          </>
        ) : (
          <>
            <p className="note" style={{ marginBottom: 8 }}>
              홈 화면에 설치한 뒤 알림을 켜면 리마인더가 이 기기로 와요.
            </p>
            <button className="btn sm" onClick={handleEnablePush} disabled={busy}>이 기기에서 알림 받기</button>
          </>
        )}
      </div>
      {notice && <p className="note" style={{ marginTop: 8, color: 'var(--coral-ink)' }}>{notice}</p>}

      <div className="sec">🔄 여행 전환</div>
      <button className="btn quiet" onClick={switchTrip}>다른 여행 코드로 전환</button>
      <div style={{ height: 20 }} />
    </section>
  )
}
