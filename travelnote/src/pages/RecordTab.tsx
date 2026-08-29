import { useState } from 'react'
import { useNote } from '../context/NoteContext'
import { useNotes } from '../lib/useNotes'
import { usePolling } from '../lib/usePolling'
import { useOfflineSync } from '../lib/useOfflineSync'

export function RecordTab() {
  const { trip, member } = useNote()
  const { notes, refresh, addNote } = useNotes(trip?.id, member?.id)
  usePolling(refresh, !!trip?.id)
  useOfflineSync(trip?.id, refresh)

  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setError(null)
    const result = await addNote(body)
    setSaving(false)
    if (!result.ok) {
      setError(result.error ?? '저장에 실패했어요.')
      return
    }
    setBody('')
  }

  if (!trip?.matched_at) {
    return (
      <section className="pad">
        <div className="empty">아직 제비뽑기 전이에요. 관리자가 제비뽑기를 하면 기록할 수 있어요.</div>
      </section>
    )
  }

  return (
    <section className="pad">
      <div className="sec first">✍️ 관찰 메모 남기기</div>
      <div className="field">
        <textarea
          className="ta"
          placeholder="예: 벌써 일어나서 씻는다 진짜 부지런함"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={300}
        />
      </div>
      <button className="btn" onClick={handleSave} disabled={saving || !body.trim()}>
        {saving ? '저장 중...' : '메모 남기기'}
      </button>
      {error && <p className="err">{error}</p>}
      <p className="note" style={{ marginTop: 12 }}>
        지금 시각이 자동으로 기록돼요. 오프라인이어도 저장되고, 온라인이 되면 자동으로 동기화돼요.
      </p>

      <div className="sec">🕓 최근 메모</div>
      {notes.length === 0 ? (
        <div className="empty">아직 남긴 메모가 없어요.</div>
      ) : (
        notes.slice(0, 5).map((n) => (
          <div className="item" key={n.id}>
            <div className="body">
              <div className="top">
                <span className="time">{formatTime(n.observed_at)}</span>
              </div>
              <div className="meta">{n.body}</div>
            </div>
          </div>
        ))
      )}
      <div style={{ height: 20 }} />
    </section>
  )
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('ko-KR', {
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}
