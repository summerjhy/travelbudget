import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { Entry } from './types'
import { enqueueDelete, enqueueInsert, enqueueUpdate } from './offlineQueue'

/**
 * supabase-js는 네트워크가 끊겨도 throw하지 않고 error 필드로 반환하는 설계다.
 * 오프라인 여부는 navigator.onLine과 에러 메시지("Failed to fetch" 계열)로 함께 판단한다.
 */
function isNetworkError(error: { message?: string } | null): boolean {
  if (!navigator.onLine) return true
  if (!error?.message) return false
  return /failed to fetch|networkerror|load failed/i.test(error.message)
}

export interface NewEntryInput {
  date: string
  title: string
  category: string
  member_id: string | null
  krw: number
  cny: number
  currency: string
  rate: number | null
  payment_method: string
  paid_by: string | null
  source: Entry['source']
  created_by: string | null
}

export interface PendingEntry extends Entry {
  pending?: boolean
}

export function useEntries(tripId: string | undefined) {
  const [entries, setEntries] = useState<PendingEntry[]>([])
  const [loading, setLoading] = useState(true)

  async function refresh(options?: { clearPending?: boolean }) {
    if (!tripId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('entries')
      .select('*')
      .eq('trip_id', tripId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })

    if (!error && data) {
      if (options?.clearPending) {
        // 오프라인 큐를 모두 반영한 직후: pending 항목은 이미 서버 목록에 포함되어 있으므로 버린다.
        setEntries(data)
      } else {
        // 평소 폴링/새로고침: 아직 큐에 남아있는 pending 항목은 서버 목록에 없으므로 유지한다.
        setEntries((prev) => {
          const pendingOnly = prev.filter((e) => e.pending)
          return [...pendingOnly, ...data]
        })
      }
    }
    setLoading(false)
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId])

  async function queueInsert(tripId: string, items: NewEntryInput[]) {
    const now = new Date().toISOString()
    const pendingEntries: PendingEntry[] = []
    for (const item of items) {
      const localId = await enqueueInsert(tripId, item)
      pendingEntries.push({
        id: localId,
        trip_id: tripId,
        created_at: now,
        updated_at: now,
        pending: true,
        ...item,
      })
    }
    setEntries((prev) => [...pendingEntries, ...prev])
    return pendingEntries
  }

  async function addEntries(items: NewEntryInput[]): Promise<{ ok: boolean; error?: string; inserted?: Entry[]; queued?: boolean }> {
    if (!tripId || items.length === 0) return { ok: false, error: '저장할 내역이 없어요.' }

    try {
      const { data, error } = await supabase
        .from('entries')
        .insert(items.map((item) => ({ ...item, trip_id: tripId })))
        .select()

      if (error) {
        if (isNetworkError(error)) {
          const pending = await queueInsert(tripId, items)
          return { ok: true, inserted: pending, queued: true }
        }
        return { ok: false, error: '저장에 실패했어요. 다시 시도해주세요.' }
      }
      setEntries((prev) => [...data, ...prev])
      return { ok: true, inserted: data }
    } catch {
      const pending = await queueInsert(tripId, items)
      return { ok: true, inserted: pending, queued: true }
    }
  }

  async function updateEntry(id: string, patch: Partial<NewEntryInput>): Promise<{ ok: boolean; error?: string; queued?: boolean }> {
    if (!tripId) return { ok: false, error: '여행 정보가 없어요.' }
    try {
      const { data, error } = await supabase.from('entries').update(patch).eq('id', id).select().single()
      if (error) {
        if (isNetworkError(error)) {
          await enqueueUpdate(tripId, id, patch)
          setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch, pending: true } : e)))
          return { ok: true, queued: true }
        }
        return { ok: false, error: '수정에 실패했어요.' }
      }
      setEntries((prev) => prev.map((e) => (e.id === id ? data : e)))
      return { ok: true }
    } catch {
      await enqueueUpdate(tripId, id, patch)
      setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch, pending: true } : e)))
      return { ok: true, queued: true }
    }
  }

  async function removeEntry(id: string): Promise<{ ok: boolean; error?: string; queued?: boolean }> {
    if (!tripId) return { ok: false, error: '여행 정보가 없어요.' }
    try {
      const { error } = await supabase.from('entries').delete().eq('id', id)
      if (error) {
        if (isNetworkError(error)) {
          await enqueueDelete(tripId, id)
          setEntries((prev) => prev.filter((e) => e.id !== id))
          return { ok: true, queued: true }
        }
        return { ok: false, error: '삭제에 실패했어요.' }
      }
      setEntries((prev) => prev.filter((e) => e.id !== id))
      return { ok: true }
    } catch {
      await enqueueDelete(tripId, id)
      setEntries((prev) => prev.filter((e) => e.id !== id))
      return { ok: true, queued: true }
    }
  }

  return { entries, loading, refresh, addEntries, updateEntry, removeEntry }
}
