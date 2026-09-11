import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { supabase } from './supabase'
import type { FundHandout } from './types'
import { BASE_CURRENCY } from './tripCurrency'

/**
 * 공금 나눠주기 / 돌려받기.
 *
 * useBudgets 와 같은 이유로 여행별 공유 캐시를 쓴다 — 설정 탭에서 넣은 기록이
 * 정산 화면에도 바로 반영돼야 하기 때문이다.
 */
const cache = new Map<string, FundHandout[]>()
const listeners = new Map<string, Set<() => void>>()
const EMPTY: FundHandout[] = []

function publish(tripId: string, next: FundHandout[]) {
  cache.set(tripId, next)
  for (const fn of listeners.get(tripId) ?? []) fn()
}

function current(tripId: string | undefined): FundHandout[] {
  return (tripId && cache.get(tripId)) || EMPTY
}

function subscribe(tripId: string | undefined, onChange: () => void): () => void {
  if (!tripId) return () => {}
  let set = listeners.get(tripId)
  if (!set) {
    set = new Set()
    listeners.set(tripId, set)
  }
  set.add(onChange)
  return () => {
    set.delete(onChange)
    if (set.size === 0) listeners.delete(tripId)
  }
}

export interface HandoutInput {
  memberId: string
  direction: 'out' | 'in'
  /** 입력한 그대로의 금액. 통화가 외화면 외화 금액이다. */
  amount: number
  currency: string
  /** 외화일 때 원화로 환산할 환율. 미리 환전한 주머니면 그 환전 환율. */
  rate?: number | null
  date: string
  memo: string
}

export function useFundHandouts(tripId: string | undefined) {
  const handouts = useSyncExternalStore(
    useCallback((onChange: () => void) => subscribe(tripId, onChange), [tripId]),
    useCallback(() => current(tripId), [tripId]),
  )

  const apply = useCallback(
    (fn: (prev: FundHandout[]) => FundHandout[]) => {
      if (!tripId) return
      publish(tripId, fn(current(tripId)))
    },
    [tripId],
  )

  const refresh = useCallback(async () => {
    if (!tripId) return
    const { data, error } = await supabase
      .from('fund_handouts')
      .select('*')
      .eq('trip_id', tripId)
      .order('date', { ascending: true })
    if (!error && data) publish(tripId, data)
  }, [tripId])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function addHandout(input: HandoutInput): Promise<{ ok: boolean; error?: string }> {
    if (!tripId) return { ok: false, error: '여행 정보가 없어요.' }
    if (!input.memberId) return { ok: false, error: '누구와 주고받았는지 골라주세요.' }
    if (!(input.amount > 0)) return { ok: false, error: '금액을 입력해주세요.' }

    const isForeign = input.currency !== BASE_CURRENCY
    if (isForeign && !(input.rate && input.rate > 0)) {
      return { ok: false, error: '외화로 건넸다면 적용 환율을 입력해주세요.' }
    }
    const krw = isForeign ? Math.round(input.amount * (input.rate as number)) : Math.round(input.amount)

    const { data, error } = await supabase
      .from('fund_handouts')
      .insert({
        trip_id: tripId,
        member_id: input.memberId,
        direction: input.direction,
        amount: krw,
        currency: input.currency,
        original_amount: isForeign ? input.amount : null,
        rate: isForeign ? input.rate : null,
        date: input.date,
        memo: input.memo,
      })
      .select()
      .single()
    if (error || !data) return { ok: false, error: '기록에 실패했어요.' }
    apply((prev) => (prev.some((h) => h.id === data.id) ? prev : [...prev, data]))
    return { ok: true }
  }

  async function removeHandout(id: string): Promise<{ ok: boolean; error?: string }> {
    const { error } = await supabase.from('fund_handouts').delete().eq('id', id)
    if (error) return { ok: false, error: '삭제에 실패했어요.' }
    apply((prev) => prev.filter((h) => h.id !== id))
    return { ok: true }
  }

  return { handouts, refresh, addHandout, removeHandout }
}
