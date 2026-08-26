export interface Trip {
  id: string
  code: string
  name: string
  start_date: string
  end_date: string | null
  destinations: string[]
  base_currency: string
  spend_currencies: string[]
  created_at: string
}

export interface Person {
  id: string
  name: string
  created_at: string
}

export interface TripMember {
  id: string
  trip_id: string
  person_id: string
  active: boolean
  sort: number
  created_at: string
  person?: Person
}

export interface Budget {
  id: string
  trip_id: string
  date: string
  amount: number
  memo: string | null
  created_at: string
}

export interface Entry {
  id: string
  trip_id: string
  date: string
  title: string
  category: string
  member_id: string | null
  krw: number
  /** 외화 금액. 어느 통화인지는 currency 를 봐야 한다 (마이그레이션 0003 주석 참고). */
  cny: number
  /** cny 의 통화 코드. 예전 행은 null 로 올 수 있고 그때는 CNY 다. */
  currency: string | null
  rate: number | null
  source: 'text' | 'image' | 'manual'
  created_by: string | null
  created_at: string
  updated_at: string
}
