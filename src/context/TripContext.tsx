import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase, setTripCode } from '../lib/supabase'
import {
  clearStoredTripCode,
  getStoredPersonName,
  getStoredTripCode,
  setStoredPersonName,
  setStoredTripCode,
} from '../lib/session'
import type { Trip, TripMember } from '../lib/types'

interface TripContextValue {
  loading: boolean
  trip: Trip | null
  error: string | null
  personName: string | null
  member: TripMember | null
  connectTrip: (code: string) => Promise<{ ok: boolean; error?: string }>
  switchTrip: () => void
  setPersonName: (name: string) => Promise<{ ok: boolean; error?: string }>
}

const TripContext = createContext<TripContextValue | null>(null)

export function TripProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [trip, setTrip] = useState<Trip | null>(null)
  const [member, setMember] = useState<TripMember | null>(null)
  const [personName, setPersonNameState] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function loadTrip(code: string): Promise<{ ok: boolean; error?: string }> {
    setTripCode(code)
    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .eq('code', code)
      .maybeSingle()

    if (error) {
      setTripCode(null)
      return { ok: false, error: '여행 정보를 불러오지 못했어요.' }
    }
    if (!data) {
      setTripCode(null)
      return { ok: false, error: '존재하지 않는 코드예요. 다시 확인해주세요.' }
    }
    setTrip(data)
    return { ok: true }
  }

  async function loadMember(tripId: string, name: string): Promise<TripMember | null> {
    const { data: existingPeople } = await supabase
      .from('people')
      .select('*')
      .eq('name', name)

    let personId: string | null = null

    if (existingPeople && existingPeople.length > 0) {
      for (const p of existingPeople) {
        const { data: tm } = await supabase
          .from('trip_members')
          .select('*')
          .eq('trip_id', tripId)
          .eq('person_id', p.id)
          .maybeSingle()
        if (tm) {
          return tm
        }
      }
      personId = existingPeople[0].id
    }

    if (!personId) {
      const { data: newPerson, error: personError } = await supabase
        .from('people')
        .insert({ name })
        .select()
        .single()
      if (personError || !newPerson) return null
      personId = newPerson.id
    }

    const { data: newMember, error: memberError } = await supabase
      .from('trip_members')
      .insert({ trip_id: tripId, person_id: personId })
      .select()
      .single()

    if (memberError || !newMember) return null
    return newMember
  }

  useEffect(() => {
    const code = getStoredTripCode()
    if (!code) {
      setLoading(false)
      return
    }

    loadTrip(code).then(async (result) => {
      if (!result.ok) {
        clearStoredTripCode()
        setError(result.error ?? null)
        setLoading(false)
        return
      }

      const name = getStoredPersonName()
      if (name) {
        setPersonNameState(name)
      }
      setLoading(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!trip || !personName) return
    loadMember(trip.id, personName).then((m) => {
      if (m) setMember(m)
    })
  }, [trip, personName])

  async function connectTrip(code: string) {
    setError(null)
    const result = await loadTrip(code)
    if (result.ok) {
      setStoredTripCode(code)
    }
    return result
  }

  function switchTrip() {
    clearStoredTripCode()
    setTripCode(null)
    setTrip(null)
    setMember(null)
    setPersonNameState(null)
    setError(null)
  }

  async function setPersonName(name: string) {
    if (!trip) return { ok: false, error: '여행 정보가 없어요.' }
    const trimmed = name.trim()
    if (!trimmed) return { ok: false, error: '이름을 입력해주세요.' }
    if (trimmed.length > 10) return { ok: false, error: '이름은 10자 이하로 입력해주세요.' }

    const m = await loadMember(trip.id, trimmed)
    if (!m) return { ok: false, error: '등록에 실패했어요. 다시 시도해주세요.' }

    setMember(m)
    setPersonNameState(trimmed)
    setStoredPersonName(trimmed)
    return { ok: true }
  }

  const value = useMemo<TripContextValue>(
    () => ({ loading, trip, error, personName, member, connectTrip, switchTrip, setPersonName }),
    [loading, trip, error, personName, member],
  )

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>
}

export function useTrip() {
  const ctx = useContext(TripContext)
  if (!ctx) throw new Error('useTrip은 TripProvider 안에서만 사용할 수 있습니다.')
  return ctx
}
