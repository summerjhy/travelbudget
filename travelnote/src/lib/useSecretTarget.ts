import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { withEmoji } from './memberEmoji'

interface SecretTarget {
  memberId: string
  name: string
  emoji: string | null
}

/**
 * 내 비밀친구(관찰 대상)를 조회한다.
 *
 * RLS(journal_secret_pairs_select_own_only)는 observer_member_id가 나
 * 자신일 때만 그 행을 보여준다 — 그래서 이 쿼리는 "내 관찰 대상"만 정확히
 * 돌려주고, 다른 사람이 누구를 관찰하는지는 절대 알 수 없다.
 *
 * 마니또의 "비밀"은 대상 쪽에서 지켜져야 하는 것이다(그 사람은 자기가
 * 관찰당하는지도, 누가 관찰하는지도 몰라야 함). 관찰자 본인이 자기
 * 대상을 아는 건 게임 진행에 필수라서 여기서 이름까지 보여준다 —
 * 처음 설계 때 이걸 반대로 착각해 관찰자에게도 이름을 숨겼던 게 버그였다.
 */
export function useSecretTarget(tripId: string | undefined, memberId: string | undefined) {
  const [target, setTarget] = useState<SecretTarget | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!tripId || !memberId) {
      setLoading(false)
      return
    }
    let alive = true
    supabase
      .from('journal_secret_pairs')
      .select('target_member_id, journal_trip_members!journal_secret_pairs_target_member_id_fkey(emoji, journal_people(name))')
      .eq('trip_id', tripId)
      .eq('observer_member_id', memberId)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return
        if (!data) {
          setTarget(null)
        } else {
          const tm = data.journal_trip_members as unknown as { emoji: string | null; journal_people: { name: string } | null } | null
          setTarget({
            memberId: data.target_member_id,
            name: tm?.journal_people?.name ?? '누군가',
            emoji: tm?.emoji ?? null,
          })
        }
        setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [tripId, memberId])

  const displayName = target ? withEmoji(target.emoji ?? '', target.name) : null

  return { target, displayName, loading }
}
