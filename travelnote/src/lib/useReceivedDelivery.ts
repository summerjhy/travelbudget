import { useEffect, useState } from 'react'
import { supabase } from './supabase'

interface ReceivedDelivery {
  body: string
  delivered_at: string
}

/** 내가 받은 비밀친구의 관찰일지. RLS가 target_member_id=나 기준으로 걸러준다. */
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
        setDelivery(data)
        setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [tripId, memberId])

  return { delivery, loading }
}
