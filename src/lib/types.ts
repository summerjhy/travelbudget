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
  cny: number
  rate: number | null
  source: 'text' | 'image' | 'manual'
  created_by: string | null
  created_at: string
  updated_at: string
}
