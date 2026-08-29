import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { withEmoji } from './memberEmoji'

interface ReceivedDelivery {
  body: string
  delivered_at: string
  observerMemberId: string
}

/**
 * 내가 받은 비밀친구의 관찰일지. RLS가 target_member_id=나 기준으로
 * 걸러주므로 이 쿼리는 항상 내가 받은 것만 돌려준다.
 *
 * observer_member_id도 함께 가져온다 — "나를 관찰한 친구의 이름은?" 버튼을
 * 눌렀을 때 그 사람 이름을 보여주기 위함이다. 발송 전에는 대상이 누군지
 * 몰라야 하지만, 이미 발송(공개)된 뒤에는 서로 누군지 밝히는 게 이
 * 게임의 마지막 재미 포인트라 이 시점부터는 숨길 이유가 없다.
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
      .select('body, delivered_at, observer_member_id')
      .eq('trip_id', tripId)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return
        setDelivery(
          data
            ? { body: data.body, delivered_at: data.delivered_at, observerMemberId: data.observer_member_id }
            : null,
        )
        setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [tripId, memberId])

  return { delivery, loading }
}

/**
 * observer_member_id로 그 사람의 이름(+이모지)을 조회한다.
 * journal_trip_members/journal_people는 트립 코드만 알면 누구나 조회
 * 가능한 공개 테이블이라(가계부의 참여자 목록과 동일한 설계) 이 조회는
 * 별도 권한 확인 없이 그대로 쓸 수 있다.
 */
export async function fetchMemberName(memberId: string): Promise<string> {
  const { data } = await supabase
    .from('journal_trip_members')
    .select('emoji, journal_people(name)')
    .eq('id', memberId)
    .maybeSingle()
  const person = data?.journal_people as unknown as { name: string } | null
  if (!person?.name) return '누군가'
  return withEmoji(data?.emoji ?? '', person.name)
}
