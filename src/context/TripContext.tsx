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
import { validateName } from '../lib/useTripMembers'

interface TripContextValue {
  loading: boolean
  trip: Trip | null
  error: string | null
  personName: string | null
  member: TripMember | null
  connectTrip: (code: string) => Promise<{ ok: boolean; error?: string }>
  switchTrip: () => void
  setPersonName: (name: string, emoji?: string) => Promise<{ ok: boolean; error?: string }>
  renameMe: (name: string) => Promise<{ ok: boolean; error?: string }>
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

  async function loadMember(tripId: string, name: string, emoji = ''): Promise<TripMember | null> {
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
      .insert({ trip_id: tripId, person_id: personId, emoji })
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

  // 재방문(localStorage 에 이름만 있고 member 가 없을 때) 신원을 되찾는 용도다.
  // setPersonName 이 이미 member 를 넣어준 직후에는 돌면 안 된다 — 그러면
  // 이모지 없이 trip_members 를 한 번 더 만들어 방금 고른 이모지를 덮어쓴다.
  useEffect(() => {
    if (!trip || !personName || member) return
    loadMember(trip.id, personName).then((m) => {
      if (m) setMember(m)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip, personName, member])

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

  async function setPersonName(name: string, emoji = '') {
    if (!trip) return { ok: false, error: '여행 정보가 없어요.' }
    const v = validateName(name)
    if (!v.ok) return v
    const trimmed = v.name

    const m = await loadMember(trip.id, trimmed, emoji)
    if (!m) return { ok: false, error: '등록에 실패했어요. 다시 시도해주세요.' }

    setMember(m)
    setPersonNameState(trimmed)
    setStoredPersonName(trimmed)
    return { ok: true }
  }

  /**
   * 본인 이름 바꾸기.
   *
   * people.name 을 직접 고치지 않는다 — people 은 여행 간 공유 테이블이라
   * 그렇게 하면 다른 여행에 있는 같은 사람 이름까지 바뀐다.
   * 대신 새 people 행을 만들고 trip_members.person_id 만 갈아끼운다.
   * trip_members.id 는 그대로라 entries.member_id 가 전부 살아있고,
   * 다음 접속 때 loadMember(새 이름)도 이 행을 그대로 찾는다.
   */
  async function renameMe(name: string) {
    if (!trip) return { ok: false, error: '여행 정보가 없어요.' }
    if (!member) return { ok: false, error: '내 참여자 정보가 없어요.' }
    const v = validateName(name)
    if (!v.ok) return v
    if (v.name === personName) return { ok: true }

    // 같은 여행에 같은 이름이 둘 생기면 다음 접속 때 신원 해석이 엉킨다.
    const { data: siblings } = await supabase
      .from('trip_members')
      .select('id, person:people(name)')
      .eq('trip_id', trip.id)
    // supabase-js 는 임베드 조인을 배열 타입으로 잡는다. 실제로는 1:1 이라 첫 원소만 본다.
    const taken = (siblings ?? []).some((m) => {
      if (m.id === member.id) return false
      const p = m.person as unknown as { name: string } | { name: string }[] | null
      const name = Array.isArray(p) ? p[0]?.name : p?.name
      return name === v.name
    })
    if (taken) return { ok: false, error: v.name + ' 은(는) 이미 있는 이름이에요.' }

    const { data: person, error: personError } = await supabase
      .from('people')
      .insert({ name: v.name })
      .select()
      .single()
    if (personError || !person) return { ok: false, error: '이름 변경에 실패했어요.' }

    const { data: updated, error: updateError } = await supabase
      .from('trip_members')
      .update({ person_id: person.id })
      .eq('id', member.id)
      .select()
      .single()
    if (updateError || !updated) return { ok: false, error: '이름 변경에 실패했어요.' }

    setMember(updated)
    setPersonNameState(v.name)
    setStoredPersonName(v.name)
    return { ok: true }
  }
  const value = useMemo<TripContextValue>(
    () => ({ loading, trip, error, personName, member, connectTrip, switchTrip, setPersonName, renameMe }),
    [loading, trip, error, personName, member],
  )

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>
}

export function useTrip() {
  const ctx = useContext(TripContext)
  if (!ctx) throw new Error('useTrip은 TripProvider 안에서만 사용할 수 있습니다.')
  return ctx
}
