import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export interface TripName {
  trip_id: string
  name: string
  created_at: string
  /** 서버가 목적지 시간대로 계산해 붙인다. 날짜 자체는 내려오지 않는다. */
  phase?: 'ongoing' | 'upcoming' | 'ended'
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
      // trip_list 뷰: 이름 + 진행 상태만. 날짜·코드는 안 내려온다 (마이그레이션 0008).
      .from('trip_list')
      .select('trip_id, name, created_at, phase')
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
