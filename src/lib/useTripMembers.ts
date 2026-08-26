import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { Person, TripMember } from './types'

export interface MemberWithName extends TripMember {
  personName: string
}

export function useTripMembers(tripId: string | undefined) {
  const [members, setMembers] = useState<MemberWithName[]>([])
  const [loading, setLoading] = useState(true)

  async function refresh() {
    if (!tripId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('trip_members')
      .select('*, person:people(*)')
      .eq('trip_id', tripId)
      .eq('active', true)
      .order('sort', { ascending: true })

    if (!error && data) {
      setMembers(
        data.map((m: TripMember & { person: Person }) => ({
          ...m,
          personName: m.person?.name ?? '',
        })),
      )
    }
    setLoading(false)
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId])

  return { members, loading, refresh }
}
