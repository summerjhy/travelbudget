import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { Budget } from './types'
import { budgetCurrency } from './totals'

export function useBudgets(tripId: string | undefined) {
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [loading, setLoading] = useState(true)

  async function refresh() {
    if (!tripId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('budgets')
      .select('*')
      .eq('trip_id', tripId)
      .order('date', { ascending: true })

    if (!error && data) setBudgets(data)
    setLoading(false)
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId])

  // 통화별로 따로 센다. 이미 환전한 돈이라 서로 더할 수 없다.
  const totalsByCurrency: Record<string, number> = {}
  for (const b of budgets) {
    const c = budgetCurrency(b)
    totalsByCurrency[c] = (totalsByCurrency[c] ?? 0) + Number(b.amount)
  }

  async function addBudget(
    amount: number,
    currency: string,
    date: string,
    memo: string,
  ): Promise<{ ok: boolean; error?: string }> {
    if (!tripId) return { ok: false, error: '여행 정보가 없어요.' }
    const { data, error } = await supabase
      .from('budgets')
      .insert({ trip_id: tripId, amount, currency, date, memo })
      .select()
      .single()
    if (error || !data) return { ok: false, error: '예산 추가에 실패했어요.' }
    setBudgets((prev) => [...prev, data])
    return { ok: true }
  }

  async function removeBudget(id: string): Promise<{ ok: boolean; error?: string }> {
    const { error } = await supabase.from('budgets').delete().eq('id', id)
    if (error) return { ok: false, error: '삭제에 실패했어요.' }
    setBudgets((prev) => prev.filter((b) => b.id !== id))
    return { ok: true }
  }

  return { budgets, totalsByCurrency, loading, refresh, addBudget, removeBudget }
}
