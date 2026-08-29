import { useEffect, useState } from 'react'
import { useAdmin } from '../context/AdminContext'
import {
  deleteJournalTrip,
  listJournalTrips,
  runJournalMatching,
  updateJournalTrip,
  type AdminJournalTrip,
  type JournalTripPatch,
} from '../lib/adminJournal'

interface Draft {
  name: string
  code: string
  startDate: string
  endDate: string
}

function toDraft(t: AdminJournalTrip): Draft {
  return { name: t.name, code: t.code, startDate: t.start_date ?? '', endDate: t.end_date ?? '' }
}

export function AdminConsole({ onBack, onCreateTrip }: { onBack: () => void; onCreateTrip: () => void }) {
  const { password } = useAdmin()
  const [trips, setTrips] = useState<AdminJournalTrip[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [matchingId, setMatchingId] = useState<string | null>(null)

  useEffect(() => {
    if (!password) return
    load(password)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [password])

  async function load(pw: string) {
    setBusy(true)
    setError(null)
    const result = await listJournalTrips(pw)
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setTrips(result.data.trips)
  }

  function openEdit(t: AdminJournalTrip) {
    setEditingId(t.id)
    setDraft(toDraft(t))
    setDeletingId(null)
    setError(null)
    setNotice(null)
  }

  async function saveEdit() {
    if (!editingId || !draft || !password) return
    const original = trips.find((t) => t.id === editingId)
    if (!original) return

    const patch: JournalTripPatch = {}
    if (draft.name.trim() !== original.name) patch.name = draft.name
    if (draft.code !== original.code) patch.code = draft.code
    if (draft.startDate !== (original.start_date ?? '')) patch.startDate = draft.startDate || null
    if (draft.endDate !== (original.end_date ?? '')) patch.endDate = draft.endDate || null

    if (Object.keys(patch).length === 0) {
      setEditingId(null)
      setDraft(null)
      return
    }

    setBusy(true)
    setError(null)
    const result = await updateJournalTrip(password, editingId, patch)
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setTrips((prev) => prev.map((t) => (t.id === editingId ? { ...result.data.trip, member_count: t.member_count } : t)))
    setEditingId(null)
    setDraft(null)
    setNotice('저장했어요.')
  }

  async function confirmDelete(t: AdminJournalTrip) {
    if (!password) return
    setBusy(true)
    setError(null)
    const result = await deleteJournalTrip(password, t.id)
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setTrips((prev) => prev.filter((x) => x.id !== t.id))
    setDeletingId(null)
    setConfirmText('')
    setNotice(`'${t.name}' 을(를) 지웠어요.`)
  }

  async function handleMatch(t: AdminJournalTrip, force: boolean) {
    if (!password) return
    setBusy(true)
    setError(null)
    const result = await runJournalMatching(password, t.code, force)
    setBusy(false)
    setMatchingId(null)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setTrips((prev) => prev.map((x) => (x.id === t.id ? { ...x, matched_at: result.data.matchedAt } : x)))
    setNotice(`제비뽑기 완료! ${result.data.memberCount}명이 매칭됐어요.`)
  }

  return (
    <div className="wrap" style={{ paddingBottom: 44 }}>
      <header className="head">
        <div className="headrow">
          <h1 className="title">🗂 관찰일지 관리하기</h1>
        </div>
        <p className="subtitle">{trips.length}개 · 목록 · 수정 · 삭제 · 제비뽑기</p>
      </header>

      <div className="pad">
        <div className="row2" style={{ marginBottom: 10 }}>
          <button className="btn ghost" onClick={onCreateTrip}>+ 새 관찰일지</button>
          <button className="btn quiet" onClick={onBack}>돌아가기</button>
        </div>

        {notice && <p className="note" style={{ color: 'var(--coral-ink)', marginBottom: 9 }}>{notice}</p>}
        {error && <p className="err">{error}</p>}

        {trips.length === 0 && <div className="empty">아직 만들어진 관찰일지가 없어요.</div>}

        {trips.map((t) => {
          if (t.id === editingId && draft) {
            return (
              <div className="box" key={t.id} style={{ marginBottom: 10, padding: 14 }}>
                <div className="field">
                  <label className="lab">이름</label>
                  <input className="inp" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                </div>
                <div className="field">
                  <label className="lab">참여 코드 (숫자 8자리)</label>
                  <input
                    className="inp num"
                    inputMode="numeric"
                    maxLength={8}
                    value={draft.code}
                    onChange={(e) => setDraft({ ...draft, code: e.target.value.replace(/\D/g, '') })}
                  />
                </div>
                <div className="row2">
                  <div className="field" style={{ flex: 1 }}>
                    <label className="lab">시작일</label>
                    <input className="inp" type="date" value={draft.startDate} onChange={(e) => setDraft({ ...draft, startDate: e.target.value })} />
                  </div>
                  <div className="field" style={{ flex: 1 }}>
                    <label className="lab">종료일</label>
                    <input className="inp" type="date" value={draft.endDate} onChange={(e) => setDraft({ ...draft, endDate: e.target.value })} />
                  </div>
                </div>
                <div className="row2">
                  <button className="btn quiet sm" style={{ flex: '0 0 30%' }} onClick={() => { setEditingId(null); setDraft(null) }}>취소</button>
                  <button className="btn sm" onClick={saveEdit} disabled={busy}>{busy ? '저장 중...' : '저장'}</button>
                </div>
              </div>
            )
          }

          if (t.id === deletingId) {
            return (
              <div className="box" key={t.id} style={{ marginBottom: 10, padding: 14, borderColor: 'var(--rose)' }}>
                <p className="note" style={{ marginBottom: 9 }}>
                  <b style={{ color: 'var(--rose)' }}>'{t.name}' 을(를) 완전히 지웁니다.</b><br />
                  참여자 {t.member_count}명, 메모, 매칭 정보가 모두 함께 사라지고 되돌릴 수 없어요.
                  확인을 위해 이름을 그대로 입력해주세요.
                </p>
                <input
                  className="inp"
                  autoFocus
                  placeholder={t.name}
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  style={{ marginBottom: 9 }}
                />
                <div className="row2">
                  <button className="btn quiet sm" style={{ flex: '0 0 30%' }} onClick={() => { setDeletingId(null); setConfirmText('') }}>취소</button>
                  <button className="btn warn sm" onClick={() => confirmDelete(t)} disabled={busy || confirmText.trim() !== t.name}>
                    {busy ? '지우는 중...' : '완전히 삭제'}
                  </button>
                </div>
              </div>
            )
          }

          if (t.id === matchingId) {
            return (
              <div className="box" key={t.id} style={{ marginBottom: 10, padding: 14, borderColor: 'var(--coral)' }}>
                <p className="note" style={{ marginBottom: 9 }}>
                  {t.matched_at
                    ? `이미 ${new Date(t.matched_at).toLocaleString('ko-KR')}에 제비뽑기를 했어요. 다시 뽑으면 기존 매칭뿐 아니라 그동안 쓴 관찰 메모와 발송 기록까지 전부 지워져요(참여자들이 지금까지 쓴 메모를 모두 잃습니다). 정말 다시 뽑을까요?`
                    : `참여자 ${t.member_count}명으로 비밀친구를 제비뽑기합니다. 한 번 뽑으면 여행 중엔 바꾸지 않는 게 좋아요.`}
                </p>
                <div className="row2">
                  <button className="btn quiet sm" style={{ flex: '0 0 30%' }} onClick={() => setMatchingId(null)}>취소</button>
                  <button className="btn sm" onClick={() => handleMatch(t, !!t.matched_at)} disabled={busy}>
                    {busy ? '뽑는 중...' : '제비뽑기'}
                  </button>
                </div>
              </div>
            )
          }

          return (
            <div className="box" key={t.id} style={{ marginBottom: 9 }}>
              <div className="tr">
                <span className="k" style={{ fontWeight: 700, color: 'var(--ink)' }}>{t.name}</span>
                <span className="v">{t.code}</span>
              </div>
              <div className="tr">
                <span className="k">일정</span>
                <span className="v txt">{t.start_date ?? '미정'}{t.end_date && ` ~ ${t.end_date}`}</span>
              </div>
              <div className="tr">
                <span className="k">참여자</span>
                <span className="v">{t.member_count}명</span>
              </div>
              <div className="tr">
                <span className="k">제비뽑기</span>
                <span className="v txt">{t.matched_at ? `✅ 완료` : '⏳ 아직'}</span>
              </div>
              <div className="tr" style={{ gap: 6, flexWrap: 'wrap' }}>
                <button className="act mine" onClick={() => setMatchingId(t.id)}>제비뽑기</button>
                <button className="act" onClick={() => openEdit(t)}>수정</button>
                <button
                  className="act warn"
                  onClick={() => { setDeletingId(t.id); setConfirmText(''); setEditingId(null); setError(null) }}
                >
                  삭제
                </button>
              </div>
            </div>
          )
        })}
        <div style={{ height: 30 }} />
      </div>
    </div>
  )
}
