import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { JournalNote } from './types'

/**
 * 내가 쓴 관찰 메모 목록. RLS가 author_member_id 기준으로 이미 "내 것만"
 * 걸러주므로 여기서는 trip_id로만 필터한다.
 *
 * 오프라인 큐는 의도적으로 없다 — 낙관적으로 저장된 것처럼 보여줬다가
 * 실제로는 서버 반영에 실패해(RLS 위반이든 진짜 네트워크 문제든) 새로고침
 * 하면 조용히 사라지는 게 오히려 "내가 쓴 메모가 없어졌다"는 혼란을 줬다.
 * 온라인일 때만 쓰게 하고, 실패하면 그 자리에서 바로 알려주는 편이
 * 마니또 관찰 메모처럼 가끔 쓰는 짧은 텍스트에는 더 명확하다.
 */
export function useNotes(tripId: string | undefined) {
  const [notes, setNotes] = useState<JournalNote[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!tripId) return
    const { data, error } = await supabase
      .from('journal_notes')
      .select('*')
      .eq('trip_id', tripId)
      .order('observed_at', { ascending: false })
    if (!error && data) setNotes(data)
    setLoading(false)
  }, [tripId])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function addNote(memberId: string | undefined, body: string) {
    if (!tripId || !memberId) return { ok: false as const, error: '참여자 정보가 없어요.' }
    if (!navigator.onLine) return { ok: false as const, error: '오프라인 상태예요. 온라인 연결 후 다시 시도해주세요.' }
    const trimmed = body.trim()
    if (!trimmed) return { ok: false as const, error: '내용을 입력해주세요.' }

    const { data, error } = await supabase
      .from('journal_notes')
      .insert({ trip_id: tripId, author_member_id: memberId, body: trimmed, observed_at: new Date().toISOString() })
      .select()
      .single()
    if (error) return { ok: false as const, error: '저장에 실패했어요. 다시 시도해주세요.' }
    setNotes((prev) => [data, ...prev])
    return { ok: true as const }
  }

  async function updateNote(id: string, body: string) {
    if (!tripId) return { ok: false as const, error: '여행 정보가 없어요.' }
    if (!navigator.onLine) return { ok: false as const, error: '오프라인 상태예요. 온라인 연결 후 다시 시도해주세요.' }
    const trimmed = body.trim()
    if (!trimmed) return { ok: false as const, error: '내용을 입력해주세요.' }

    const { error } = await supabase.from('journal_notes').update({ body: trimmed }).eq('id', id)
    if (error) return { ok: false as const, error: '수정에 실패했어요.' }
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, body: trimmed } : n)))
    return { ok: true as const }
  }

  async function deleteNote(id: string) {
    if (!tripId) return { ok: false as const, error: '여행 정보가 없어요.' }
    if (!navigator.onLine) return { ok: false as const, error: '오프라인 상태예요. 온라인 연결 후 다시 시도해주세요.' }

    const { error } = await supabase.from('journal_notes').delete().eq('id', id)
    if (error) return { ok: false as const, error: '삭제에 실패했어요.' }
    setNotes((prev) => prev.filter((n) => n.id !== id))
    return { ok: true as const }
  }

  return { notes, loading, refresh, addNote, updateNote, deleteNote }
}
