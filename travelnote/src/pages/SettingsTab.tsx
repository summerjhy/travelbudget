import { useEffect, useState } from 'react'
import { useNote } from '../context/NoteContext'
import { useReminder } from '../lib/useReminder'
import { enableJournalPush, pushEnabled, pushSupported, sendTestJournalPush } from '../lib/journalPush'
import { useTripMembers } from '../lib/useTripMembers'
import { withEmoji } from '../lib/memberEmoji'
import { useAdmin } from '../context/AdminContext'
import { updateJournalTrip } from '../lib/adminJournal'
import { DEFAULT_GUIDE_STEPS, MAX_GUIDE_STEPS, MAX_GUIDE_STEP_LENGTH, guideStepsOf } from '../lib/guideSteps'

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const INTERVALS = [30, 60, 90, 120, 180, 240]

function toGuideDraft(steps: string[] | null | undefined) {
  const base = guideStepsOf(steps)
  return Array.from({ length: MAX_GUIDE_STEPS }, (_, i) => base[i] ?? '')
}

/**
 * 홈 "어떻게 쓰나요?" 안내를 코드별로 고치는 관리자 전용 편집기.
 * 관리자 비밀번호가 메모리에 있을 때(관리자 → 둘러보기로 들어온 경우)만
 * 렌더되고, 저장은 admin-journal이 비밀번호를 다시 확인한 뒤 처리한다.
 */
function GuideStepsEditor() {
  const { trip, refreshTrip } = useNote()
  const { password } = useAdmin()
  const [draft, setDraft] = useState(() => toGuideDraft(trip?.guide_steps))
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    setDraft(toGuideDraft(trip?.guide_steps))
  }, [trip?.guide_steps])

  async function persist(steps: string[]) {
    if (!trip || !password) return
    setBusy(true)
    setNotice(null)
    const result = await updateJournalTrip(password, trip.id, { guideSteps: steps })
    setBusy(false)
    if (!result.ok) {
      setNotice(result.error)
      return
    }
    await refreshTrip()
    setNotice('저장했어요. 홈 화면에 바로 반영돼요.')
  }

  return (
    <>
      <div className="sec">🛠 홈 안내 편집 (관리자)</div>
      <div className="box" style={{ padding: '4px 14px 14px' }}>
        <p className="note" style={{ marginTop: 13 }}>
          이 코드의 홈 화면 "어떻게 쓰나요?"에 보일 내용이에요. 최대 {MAX_GUIDE_STEPS}개, 빈 칸은 빠져요.
        </p>
        {draft.map((value, i) => (
          <div className="field" key={i}>
            <label className="lab">{i + 1}번</label>
            <input
              className="inp"
              maxLength={MAX_GUIDE_STEP_LENGTH}
              value={value}
              placeholder={i < DEFAULT_GUIDE_STEPS.length ? DEFAULT_GUIDE_STEPS[i] : '(비워두면 표시 안 함)'}
              onChange={(e) => setDraft(draft.map((v, j) => (j === i ? e.target.value : v)))}
            />
          </div>
        ))}
        <div className="row2">
          <button className="btn quiet sm" style={{ flex: '0 0 40%' }} onClick={() => persist([])} disabled={busy}>
            기본값으로
          </button>
          <button
            className="btn sm"
            onClick={() => persist(draft.map((s) => s.trim()).filter(Boolean))}
            disabled={busy}
          >
            {busy ? '저장 중...' : '저장'}
          </button>
        </div>
        {notice && <p className="note" style={{ marginTop: 8, color: 'var(--coral-ink)' }}>{notice}</p>}
      </div>
    </>
  )
}

export function SettingsTab() {
  const { trip, member, switchTrip } = useNote()
  const { authed } = useAdmin()
  const { reminder, save } = useReminder(trip?.id, member?.id)
  const { members, loading: membersLoading } = useTripMembers(trip?.id)

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
      <div className="sec first">👥 참여 중인 친구 {!membersLoading && `(${members.length}명)`}</div>
      <div className="box">
        {membersLoading ? (
          <div className="tr"><span className="k">불러오는 중...</span></div>
        ) : members.length === 0 ? (
          <div className="tr"><span className="k">아직 아무도 없어요.</span></div>
        ) : (
          members.map((m) => (
            <div className="tr" key={m.id}>
              <span className="k" style={{ color: 'var(--ink)' }}>{withEmoji(m.emoji ?? '', m.name)}</span>
              {m.id === member?.id && <span className="v txt">나</span>}
            </div>
          ))
        )}
      </div>

      {authed && <GuideStepsEditor />}

      <div className="sec">🔔 리마인더</div>
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
