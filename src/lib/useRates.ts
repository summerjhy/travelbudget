import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { fetchRateForDate } from './fetchRate'

export function useRates(tripId: string | undefined, tripCode: string | undefined) {
  const [ratesByDate, setRatesByDate] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  async function refresh() {
    if (!tripId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('rates')
      .select('date, rate')
      .eq('trip_id', tripId)

    if (!error && data) {
      const map: Record<string, number> = {}
      for (const r of data) map[r.date] = Number(r.rate)
      setRatesByDate(map)
    }
    setLoading(false)
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId])

  async function setManualRate(date: string, rate: number): Promise<{ ok: boolean; error?: string }> {
    if (!tripId) return { ok: false, error: '여행 정보가 없어요.' }
    const { error } = await supabase.from('rates').upsert({ trip_id: tripId, date, rate })
    if (error) return { ok: false, error: '환율 저장에 실패했어요.' }
    setRatesByDate((prev) => ({ ...prev, [date]: rate }))
    return { ok: true }
  }

  async function fetchNow(date: string): Promise<{ ok: boolean; error?: string; rate?: number }> {
    if (!tripCode) return { ok: false, error: '여행 정보가 없어요.' }
    const result = await fetchRateForDate(tripCode, date)
    if (!result.ok || result.rate === undefined) {
      return { ok: false, error: result.error ?? '환율을 못 가져왔어요.' }
    }
    setRatesByDate((prev) => ({ ...prev, [date]: result.rate! }))
    return { ok: true, rate: result.rate }
  }

  return { ratesByDate, loading, refresh, setManualRate, fetchNow }
}
