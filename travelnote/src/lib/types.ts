export interface JournalTrip {
  id: string
  code: string
  name: string
  start_date: string | null
  end_date: string | null
  matched_at: string | null
  revealed_at: string | null
  created_at: string
}

export interface JournalTripMember {
  id: string
  trip_id: string
  person_id: string
  emoji: string | null
  active: boolean
  created_at: string
  /** people(name)을 임베드 조회했을 때만 채워짐 */
  person?: { name: string }
}

export interface JournalNote {
  id: string
  trip_id: string
  author_member_id: string
  body: string
  observed_at: string
  created_at: string
}

export interface JournalReminder {
  id: string
  trip_id: string
  member_id: string
  enabled: boolean
  start_hour: number
  end_hour: number
  interval_minutes: number
  last_sent_at: string | null
  created_at: string
}
