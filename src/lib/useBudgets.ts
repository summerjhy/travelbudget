import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { Budget } from './types'
import { BASE_CURRENCY } from './tripCurrency'

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

  const total = budgets.reduce((sum, b) => sum + Number(b.amount), 0)

  /**
   * 예산 추가.
   *
   * 외화로 넣으면 환전 시점 환율로 원화 환산액을 계산해 amount 에 박는다.
   * 나중에 시세가 움직여도 예산은 변하지 않는다 — 이미 환전한 돈이기 때문이다.
   */
  async function addBudget(input: {
    amount: number
    currency: string
    rate?: number | null
    date: string
    memo: string
  }): Promise<{ ok: boolean; error?: string }> {
    if (!tripId) return { ok: false, error: '여행 정보가 없어요.' }

    const foreign = input.currency !== BASE_CURRENCY
    if (foreign && !(input.rate && input.rate > 0)) {
      return { ok: false, error: '환전할 때 적용된 환율을 입력해주세요.' }
    }
    const krw = foreign ? Math.round(input.amount * (input.rate as number)) : Math.round(input.amount)
    if (!(krw > 0)) return { ok: false, error: '금액을 입력해주세요.' }

    const { data, error } = await supabase
      .from('budgets')
      .insert({
        trip_id: tripId,
        date: input.date,
        memo: input.memo,
        amount: krw,
        currency: input.currency,
        original_amount: foreign ? input.amount : null,
        rate: foreign ? input.rate : null,
      })
      .select()
      .single()
    if (error || !data) return { ok: false, error: '예산 추가에 실패했어요.' }
    // 폴링/새로고침이 같은 행을 이미 가져왔을 수 있어 id 로 중복을 막는다.
    setBudgets((prev) => (prev.some((b) => b.id === data.id) ? prev : [...prev, data]))
    return { ok: true }
  }

  /** 예산 수정. 참여자 누구나 할 수 있다 (RLS 도 여행 코드 기준으로 열려 있다). */
  async function updateBudget(
    id: string,
    input: { amount: number; currency: string; rate?: number | null; date: string; memo: string },
  ): Promise<{ ok: boolean; error?: string }> {
    const foreign = input.currency !== BASE_CURRENCY
    if (foreign && !(input.rate && input.rate > 0)) {
      return { ok: false, error: '환전할 때 적용된 환율을 입력해주세요.' }
    }
    const krw = foreign ? Math.round(input.amount * (input.rate as number)) : Math.round(input.amount)
    if (!(krw > 0)) return { ok: false, error: '금액을 입력해주세요.' }

    const { data, error } = await supabase
      .from('budgets')
      .update({
        date: input.date,
        memo: input.memo,
        amount: krw,
        currency: input.currency,
        original_amount: foreign ? input.amount : null,
        rate: foreign ? input.rate : null,
      })
      .eq('id', id)
      .select()
      .single()
    if (error || !data) return { ok: false, error: '예산 수정에 실패했어요.' }
    // 응답에 id 가 빠져 와도 목록의 키가 깨지지 않게 원래 id 를 지킨다.
    setBudgets((prev) => prev.map((b) => (b.id === id ? { ...b, ...data, id } : b)))
    return { ok: true }
  }

  async function removeBudget(id: string): Promise<{ ok: boolean; error?: string }> {
    const { error } = await supabase.from('budgets').delete().eq('id', id)
    if (error) return { ok: false, error: '삭제에 실패했어요.' }
    setBudgets((prev) => prev.filter((b) => b.id !== id))
    return { ok: true }
  }

  return { budgets, total, loading, refresh, addBudget, updateBudget, removeBudget }
}
