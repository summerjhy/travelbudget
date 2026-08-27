import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export interface TripName {
  trip_id: string
  name: string
  created_at: string
}

/**
 * 홈 화면에 뿌릴 공개 여행 목록.
 *
 * trips 가 아니라 trip_names 를 읽는다 (마이그레이션 0005). 이 테이블에는
 * 이름 말고 아무것도 없어서 코드·날짜·목적지가 샐 여지가 없다.
 * 목록을 봐도 코드를 모르면 들어갈 수 없다.
 */
export function useTripNames() {
  const [names, setNames] = useState<TripName[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    supabase
      .from('trip_names')
      .select('trip_id, name, created_at')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!alive) return
        if (!error && data) setNames(data)
        setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  return { names, loading }
}
