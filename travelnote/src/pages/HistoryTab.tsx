import { useState } from 'react'
import { useNote } from '../context/NoteContext'
import { useNotes } from '../lib/useNotes'
import { usePolling } from '../lib/usePolling'
import type { JournalNote } from '../lib/types'

export function HistoryTab() {
  const { trip } = useNote()
  const { notes, refresh, updateNote, deleteNote } = useNotes(trip?.id)
  usePolling(refresh, !!trip?.id)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

  function startEdit(n: JournalNote) {
    setEditingId(n.id)
    setDraft(n.body)
    setError(null)
  }

  async function saveEdit(id: string) {
    const result = await updateNote(id, draft)
    if (!result.ok) {
      setError(result.error ?? '수정에 실패했어요.')
      return
    }
    setEditingId(null)
    setError(null)
  }

  async function handleDelete(id: string) {
    const result = await deleteNote(id)
    if (!result.ok) setError(result.error ?? '삭제에 실패했어요.')
  }

  return (
    <section className="pad">
      <div className="sec first">📖 내가 쓴 메모 ({notes.length}건)</div>
      {error && <p className="err" style={{ marginBottom: 9 }}>{error}</p>}
      {notes.length === 0 ? (
        <div className="empty">아직 남긴 메모가 없어요. 기록 탭에서 첫 메모를 남겨보세요.</div>
      ) : (
        notes.map((n) => (
          <div className="item" key={n.id}>
            <div className="body">
              {editingId === n.id ? (
                <>
                  <textarea
                    className="ta"
                    style={{ minHeight: 72, marginBottom: 8 }}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    autoFocus
                  />
                  <div className="row2">
                    <button className="btn quiet sm" style={{ flex: '0 0 30%' }} onClick={() => setEditingId(null)}>
                      취소
                    </button>
                    <button className="btn sm" onClick={() => saveEdit(n.id)}>저장</button>
                  </div>
                </>
              ) : (
                <>
                  <div className="top">
                    <span className="time">{formatTime(n.observed_at)}</span>
                    <span style={{ display: 'flex', gap: 6 }}>
                      <button className="x" onClick={() => startEdit(n)}>수정</button>
                      <button className="x" style={{ color: 'var(--rose)' }} onClick={() => handleDelete(n.id)}>삭제</button>
                    </span>
                  </div>
                  <div className="meta">{n.body}</div>
                </>
              )}
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
