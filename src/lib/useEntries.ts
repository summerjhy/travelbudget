import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { Entry } from './types'

export interface NewEntryInput {
  date: string
  title: string
  category: string
  member_id: string | null
  krw: number
  cny: number
  rate: number | null
  source: Entry['source']
  created_by: string | null
}

export function useEntries(tripId: string | undefined) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)

  async function refresh() {
    if (!tripId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('entries')
      .select('*')
      .eq('trip_id', tripId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })

    if (!error && data) setEntries(data)
    setLoading(false)
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId])

  async function addEntries(items: NewEntryInput[]): Promise<{ ok: boolean; error?: string; inserted?: Entry[] }> {
    if (!tripId || items.length === 0) return { ok: false, error: '저장할 내역이 없어요.' }
    const { data, error } = await supabase
      .from('entries')
      .insert(items.map((item) => ({ ...item, trip_id: tripId })))
      .select()

    if (error || !data) return { ok: false, error: '저장에 실패했어요. 다시 시도해주세요.' }
    setEntries((prev) => [...data, ...prev])
    return { ok: true, inserted: data }
  }

  async function updateEntry(id: string, patch: Partial<NewEntryInput>): Promise<{ ok: boolean; error?: string }> {
    const { data, error } = await supabase.from('entries').update(patch).eq('id', id).select().single()
    if (error || !data) return { ok: false, error: '수정에 실패했어요.' }
    setEntries((prev) => prev.map((e) => (e.id === id ? data : e)))
    return { ok: true }
  }

  async function removeEntry(id: string): Promise<{ ok: boolean; error?: string }> {
    const { error } = await supabase.from('entries').delete().eq('id', id)
    if (error) return { ok: false, error: '삭제에 실패했어요.' }
    setEntries((prev) => prev.filter((e) => e.id !== id))
    return { ok: true }
  }

  return { entries, loading, refresh, addEntries, updateEntry, removeEntry }
}
