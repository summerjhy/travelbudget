import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { fetchRatesForDate } from './fetchRate'
import type { RateTable } from './rates'

export function useRates(tripId: string | undefined, tripCode: string | undefined) {
  const [rates, setRates] = useState<RateTable>({})
  const [loading, setLoading] = useState(true)

  async function refresh() {
    if (!tripId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('rates')
      .select('date, currency, rate')
      .eq('trip_id', tripId)

    if (!error && data) {
      const table: RateTable = {}
      for (const r of data) {
        const date = r.date as string
        // currency 컬럼이 생기기 전 행은 전부 위안이었다 (마이그레이션 0003).
        const currency = (r.currency as string | null) ?? 'CNY'
        table[date] = { ...(table[date] ?? {}), [currency]: Number(r.rate) }
      }
      setRates(table)
    }
    setLoading(false)
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId])

  function merge(date: string, byCurrency: Record<string, number>) {
    setRates((prev) => ({ ...prev, [date]: { ...(prev[date] ?? {}), ...byCurrency } }))
  }

  async function setManualRate(date: string, currency: string, rate: number): Promise<{ ok: boolean; error?: string }> {
    if (!tripId) return { ok: false, error: '여행 정보가 없어요.' }
    const { error } = await supabase.from('rates').upsert({ trip_id: tripId, date, currency, rate })
    if (error) return { ok: false, error: '환율 저장에 실패했어요.' }
    merge(date, { [currency]: rate })
    return { ok: true }
  }

  /** 그 날짜의 환율을 여행에 설정된 외화 전부에 대해 한 번에 조회한다. */
  async function fetchNow(date: string): Promise<{ ok: boolean; error?: string; rates?: Record<string, number> }> {
    if (!tripCode) return { ok: false, error: '여행 정보가 없어요.' }
    const result = await fetchRatesForDate(tripCode, date)
    if (!result.ok || !result.rates) {
      return { ok: false, error: result.error ?? '환율을 못 가져왔어요.' }
    }
    merge(date, result.rates)
    return { ok: true, rates: result.rates }
  }

  return { rates, loading, refresh, setManualRate, fetchNow }
}
