import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export interface TripMemberRow {
  id: string
  emoji: string | null
  name: string
}

/**
 * 이 코드에 참여 중인(active) 사람 목록. journal_trip_members/journal_people는
 * 트립 코드만 알면 조회 가능한 공개 테이블이라(fetchMemberName과 같은 이유)
 * 누가 들어와 있는지는 참여자 모두에게 보여줘도 된다. 매칭 정보는 담기지 않는다.
 */
export function useTripMembers(tripId: string | undefined) {
  const [members, setMembers] = useState<TripMemberRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!tripId) {
      setLoading(false)
      return
    }
    let alive = true
    supabase
      .from('journal_trip_members')
      .select('id, emoji, created_at, journal_people(name)')
      .eq('trip_id', tripId)
      .eq('active', true)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (!alive) return
        setMembers(
          (data ?? []).map((row) => ({
            id: row.id,
            emoji: row.emoji,
            name: (row.journal_people as unknown as { name: string } | null)?.name ?? '이름 없음',
          })),
        )
        setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [tripId])

  return { members, loading }
}
