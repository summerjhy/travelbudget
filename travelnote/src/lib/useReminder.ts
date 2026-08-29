import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { JournalReminder } from './types'

export function useReminder(tripId: string | undefined, memberId: string | undefined) {
  const [reminder, setReminder] = useState<JournalReminder | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!tripId || !memberId) {
      setLoading(false)
      return
    }
    const { data } = await supabase
      .from('journal_reminders')
      .select('*')
      .eq('trip_id', tripId)
      .eq('member_id', memberId)
      .maybeSingle()
    setReminder(data)
    setLoading(false)
  }, [tripId, memberId])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function save(patch: {
    enabled: boolean
    startHour: number
    endHour: number
    intervalMinutes: number
  }) {
    if (!tripId || !memberId) return { ok: false as const, error: '참여자 정보가 없어요.' }

    const row = {
      trip_id: tripId,
      member_id: memberId,
      enabled: patch.enabled,
      start_hour: patch.startHour,
      end_hour: patch.endHour,
      interval_minutes: patch.intervalMinutes,
    }

    if (reminder) {
      const { data, error } = await supabase
        .from('journal_reminders')
        .update(row)
        .eq('id', reminder.id)
        .select()
        .single()
      if (error) return { ok: false as const, error: '저장에 실패했어요.' }
      setReminder(data)
      return { ok: true as const }
    }

    const { data, error } = await supabase.from('journal_reminders').insert(row).select().single()
    if (error) return { ok: false as const, error: '저장에 실패했어요.' }
    setReminder(data)
    return { ok: true as const }
  }

  return { reminder, loading, save }
}
