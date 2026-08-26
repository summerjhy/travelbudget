import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export function useRates(tripId: string | undefined) {
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

  return { ratesByDate, loading, refresh }
}
