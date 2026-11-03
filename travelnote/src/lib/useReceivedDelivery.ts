import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { withEmoji } from './memberEmoji'

interface ReceivedDelivery {
  body: string
  delivered_at: string
}

/**
 * 내가 받은 비밀친구의 관찰일지. RLS가 target_member_id=나 기준으로
 * 걸러주므로 이 쿼리는 항상 내가 받은 것만 돌려준다.
 *
 * observer_member_id(보낸 사람)는 가져오지 않는다 — 마이그레이션 0020부터
 * 클라이언트는 이 컬럼을 조회할 권한이 없다. 보낸 사람 이름은 관리자가
 * "다 같이 공개"를 켠 뒤에만 revealObserver()로 알 수 있다.
 */
export function useReceivedDelivery(tripId: string | undefined, memberId: string | undefined) {
  const [delivery, setDelivery] = useState<ReceivedDelivery | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!tripId || !memberId) {
      setLoading(false)
      return
    }
    let alive = true
    supabase
      .from('journal_deliveries')
      .select('body, delivered_at')
      .eq('trip_id', tripId)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return
        setDelivery(data ? { body: data.body, delivered_at: data.delivered_at } : null)
        setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [tripId, memberId])

  return { delivery, loading }
}

/**
 * 나를 관찰한 친구의 이름(+이모지). journal_reveal_observer()는 관리자가
 * 공개(journal_trips.revealed_at)하기 전엔 빈 결과를 돌려주므로, 공개 전에는
 * 화면을 우회해도 이름을 알 수 없다. 공개 전이거나 못 찾으면 null.
 */
export async function revealObserver(): Promise<string | null> {
  const { data } = await supabase.rpc('journal_reveal_observer')
  const row = (data as { name: string; emoji: string | null }[] | null)?.[0]
  if (!row?.name) return null
  return withEmoji(row.emoji ?? '', row.name)
}
