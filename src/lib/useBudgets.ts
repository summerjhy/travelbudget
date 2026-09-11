import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { supabase } from './supabase'
import type { Budget } from './types'
import { BASE_CURRENCY } from './tripCurrency'

/**
 * 예산은 여행당 하나의 목록을 화면 여러 곳(헤더·홈·기록·내역·설정)에서 함께 본다.
 * 훅 인스턴스마다 state 를 따로 들면 설정 탭에서 지운 예산이 헤더에는 그대로 남는다
 * (헤더 TripLayout 은 탭을 옮겨도 언마운트되지 않아 영영 낡은 값을 보여줬다).
 * 그래서 여행별로 하나의 캐시를 두고 useSyncExternalStore 로 구독한다.
 */
const cache = new Map<string, Budget[]>()
const listeners = new Map<string, Set<() => void>>()

// getSnapshot 이 매번 새 배열을 만들면 무한 렌더가 된다. 빈 값은 항상 같은 참조를 쓴다.
const EMPTY: Budget[] = []

function publish(tripId: string, next: Budget[]) {
  cache.set(tripId, next)
  for (const fn of listeners.get(tripId) ?? []) fn()
}

function current(tripId: string | undefined): Budget[] {
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


export interface BudgetInput {
  /** 입력한 그대로의 금액. 통화가 외화면 외화 금액이다. */
  amount: number
  currency: string
  /** 미리 환전한 경우의 환전 환율. 실시간 환율 예산이면 안 쓴다. */
  rate?: number | null
  /** 외화일 때만 의미가 있다. true = 미리 환전해둔 돈, false = 실시간 환율로 결제. */
  prepaid?: boolean
  /** 실시간 환율 예산의 원화 스냅샷을 만들 때 쓰는 그날 시세. */
  marketRate?: number | null
  date: string
  memo: string
}

/**
 * 저장할 컬럼 값을 만든다.
 *
 * 외화 예산은 original_amount(외화 금액)가 진짜다. amount(원화)는
 *   · 미리 환전했으면  original_amount * rate 로 고정되고
 *   · 실시간 환율이면  입력 당시 시세로 만든 참고용 스냅샷이다 (화면은 그날 시세로 다시 환산).
 */
interface BudgetFields {
  amount: number
  currency: string
  original_amount: number | null
  rate: number | null | undefined
  prepaid: boolean
}

function buildFields(input: BudgetInput): BudgetFields | { error: string } {
  const isForeign = input.currency !== BASE_CURRENCY
  if (!(input.amount > 0)) return { error: '금액을 입력해주세요.' }

  if (!isForeign) {
    return {
      amount: Math.round(input.amount),
      currency: BASE_CURRENCY,
      original_amount: null,
      rate: null,
      prepaid: true,
    }
  }

  const prepaid = input.prepaid !== false
  if (prepaid && !(input.rate && input.rate > 0)) {
    return { error: '환전할 때 적용된 환율을 입력해주세요.' }
  }
  const rate = prepaid ? (input.rate as number) : input.marketRate || 0
  return {
    amount: Math.round(input.amount * rate),
    currency: input.currency,
    original_amount: input.amount,
    rate: prepaid ? input.rate : null,
    prepaid,
  }
}

export function useBudgets(tripId: string | undefined) {
  const budgets = useSyncExternalStore(
    useCallback((onChange: () => void) => subscribe(tripId, onChange), [tripId]),
    useCallback(() => current(tripId), [tripId]),
  )

  /** 캐시를 갱신하면 이 여행을 보고 있는 모든 화면이 같이 바뀐다. */
  const apply = useCallback(
    (fn: (prev: Budget[]) => Budget[]) => {
      if (!tripId) return
      publish(tripId, fn(current(tripId)))
    },
    [tripId],
  )

  const refresh = useCallback(async () => {
    if (!tripId) return
    const { data, error } = await supabase
      .from('budgets')
      .select('*')
      .eq('trip_id', tripId)
      .order('date', { ascending: true })

    if (!error && data) publish(tripId, data)
  }, [tripId])

  useEffect(() => {
    refresh()
  }, [refresh])

  const total = budgets.reduce((sum, b) => sum + Number(b.amount), 0)

  /**
   * 예산 추가.
   *
   * 외화로 넣으면 환전 시점 환율로 원화 환산액을 계산해 amount 에 박는다.
   * 나중에 시세가 움직여도 예산은 변하지 않는다 — 이미 환전한 돈이기 때문이다.
   */
  async function addBudget(input: BudgetInput): Promise<{ ok: boolean; error?: string }> {
    if (!tripId) return { ok: false, error: '여행 정보가 없어요.' }
    const fields = buildFields(input)
    if ('error' in fields) return { ok: false, error: fields.error }

    const { data, error } = await supabase
      .from('budgets')
      .insert({ trip_id: tripId, date: input.date, memo: input.memo, ...fields })
      .select()
      .single()
    if (error || !data) return { ok: false, error: '예산 추가에 실패했어요.' }
    // 폴링/새로고침이 같은 행을 이미 가져왔을 수 있어 id 로 중복을 막는다.
    apply((prev) => (prev.some((b) => b.id === data.id) ? prev : [...prev, data]))
    return { ok: true }
  }

  /** 예산 수정. 참여자 누구나 할 수 있다 (RLS 도 여행 코드 기준으로 열려 있다). */
  async function updateBudget(id: string, input: BudgetInput): Promise<{ ok: boolean; error?: string }> {
    const fields = buildFields(input)
    if ('error' in fields) return { ok: false, error: fields.error }

    const { data, error } = await supabase
      .from('budgets')
      .update({ date: input.date, memo: input.memo, ...fields })
      .eq('id', id)
      .select()
      .single()
    if (error || !data) return { ok: false, error: '예산 수정에 실패했어요.' }
    // 응답에 id 가 빠져 와도 목록의 키가 깨지지 않게 원래 id 를 지킨다.
    apply((prev) => prev.map((b) => (b.id === id ? { ...b, ...data, id } : b)))
    return { ok: true }
  }

  async function removeBudget(id: string): Promise<{ ok: boolean; error?: string }> {
    const { error } = await supabase.from('budgets').delete().eq('id', id)
    if (error) return { ok: false, error: '삭제에 실패했어요.' }
    apply((prev) => prev.filter((b) => b.id !== id))
    return { ok: true }
  }

  return { budgets, total, refresh, addBudget, updateBudget, removeBudget }
}
