import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { JournalNote } from './types'
import { enqueueInsert, enqueueUpdate, enqueueDelete, type NewNoteInput } from './offlineQueue'

/**
 * 내가 쓴 관찰 메모 목록. RLS가 author_member_id 기준으로 이미 "내 것만"
 * 걸러주므로 여기서는 trip_id로만 필터한다.
 */
export function useNotes(tripId: string | undefined, memberId: string | undefined) {
  const [notes, setNotes] = useState<JournalNote[]>([])
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState<JournalNote[]>([])

  const refresh = useCallback(
    async (options?: { clearPending?: boolean }) => {
      if (!tripId) return
      const { data, error } = await supabase
        .from('journal_notes')
        .select('*')
        .eq('trip_id', tripId)
        .order('observed_at', { ascending: false })
      if (!error && data) setNotes(data)
      if (options?.clearPending) setPending([])
      setLoading(false)
    },
    [tripId],
  )

  useEffect(() => {
    refresh()
  }, [refresh])

  async function addNote(body: string) {
    if (!tripId || !memberId) return { ok: false as const, error: '참여자 정보가 없어요.' }
    const trimmed = body.trim()
    if (!trimmed) return { ok: false as const, error: '내용을 입력해주세요.' }

    const observedAt = new Date().toISOString()
    const input: NewNoteInput = { trip_id: tripId, author_member_id: memberId, body: trimmed, observed_at: observedAt }

    if (!navigator.onLine) {
      const localId = await enqueueInsert(tripId, input)
      const optimistic: JournalNote = {
        id: localId,
        trip_id: tripId,
        author_member_id: memberId,
        body: trimmed,
        observed_at: observedAt,
        created_at: observedAt,
      }
      setPending((prev) => [optimistic, ...prev])
      return { ok: true as const }
    }

    const { data, error } = await supabase.from('journal_notes').insert(input).select().single()
    if (error) {
      // 온라인이라고 믿었지만 실패했을 수 있다 — 큐에 넣어 나중에 재시도한다.
      const localId = await enqueueInsert(tripId, input)
      const optimistic: JournalNote = {
        id: localId,
        trip_id: tripId,
        author_member_id: memberId,
        body: trimmed,
        observed_at: observedAt,
        created_at: observedAt,
      }
      setPending((prev) => [optimistic, ...prev])
      return { ok: true as const }
    }
    setNotes((prev) => [data, ...prev])
    return { ok: true as const }
  }

  async function updateNote(id: string, body: string) {
    if (!tripId) return { ok: false as const, error: '여행 정보가 없어요.' }
    const trimmed = body.trim()
    if (!trimmed) return { ok: false as const, error: '내용을 입력해주세요.' }

    if (!navigator.onLine) {
      await enqueueUpdate(tripId, id, { body: trimmed })
      setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, body: trimmed } : n)))
      return { ok: true as const }
    }

    const { error } = await supabase.from('journal_notes').update({ body: trimmed }).eq('id', id)
    if (error) return { ok: false as const, error: '수정에 실패했어요.' }
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, body: trimmed } : n)))
    return { ok: true as const }
  }

  async function deleteNote(id: string) {
    if (!tripId) return { ok: false as const, error: '여행 정보가 없어요.' }

    if (!navigator.onLine) {
      await enqueueDelete(tripId, id)
      setNotes((prev) => prev.filter((n) => n.id !== id))
      setPending((prev) => prev.filter((n) => n.id !== id))
      return { ok: true as const }
    }

    const { error } = await supabase.from('journal_notes').delete().eq('id', id)
    if (error) return { ok: false as const, error: '삭제에 실패했어요.' }
    setNotes((prev) => prev.filter((n) => n.id !== id))
    return { ok: true as const }
  }

  const merged = [...pending, ...notes].sort((a, b) => (a.observed_at < b.observed_at ? 1 : -1))

  return { notes: merged, loading, refresh, addNote, updateNote, deleteNote }
}
