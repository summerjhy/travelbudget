import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase, setNoteCode, setMemberId } from '../lib/supabase'
import {
  clearStoredNoteCode,
  getStoredNoteCode,
  getStoredPersonName,
  setStoredNoteCode,
  setStoredPersonName,
} from '../lib/session'
import type { JournalTrip, JournalTripMember } from '../lib/types'
import { validateName } from '../lib/validateName'

interface NoteContextValue {
  loading: boolean
  trip: JournalTrip | null
  error: string | null
  personName: string | null
  member: JournalTripMember | null
  connectTrip: (code: string) => Promise<{ ok: boolean; error?: string }>
  switchTrip: () => void
  setPersonName: (name: string, emoji?: string) => Promise<{ ok: boolean; error?: string }>
  refreshTrip: () => Promise<void>
}

const NoteContext = createContext<NoteContextValue | null>(null)

export function NoteProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [trip, setTrip] = useState<JournalTrip | null>(null)
  const [member, setMember] = useState<JournalTripMember | null>(null)
  const [personName, setPersonNameState] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function loadTrip(code: string): Promise<{ ok: boolean; error?: string }> {
    setNoteCode(code)
    const { data, error } = await supabase
      .from('journal_trips')
      .select('*')
      .eq('code', code)
      .maybeSingle()

    if (error) {
      setNoteCode(null)
      return { ok: false, error: '여행 정보를 불러오지 못했어요.' }
    }
    if (!data) {
      setNoteCode(null)
      return { ok: false, error: '존재하지 않는 코드예요. 다시 확인해주세요.' }
    }
    setTrip(data)
    return { ok: true }
  }

  async function loadMember(tripId: string, name: string, emoji = ''): Promise<JournalTripMember | null> {
    const { data: existingPeople } = await supabase
      .from('journal_people')
      .select('*')
      .eq('name', name)

    let personId: string | null = null

    if (existingPeople && existingPeople.length > 0) {
      for (const p of existingPeople) {
        const { data: tm } = await supabase
          .from('journal_trip_members')
          .select('*')
          .eq('trip_id', tripId)
          .eq('person_id', p.id)
          .maybeSingle()
        if (tm) {
          setMemberId(tm.id)
          return tm
        }
      }
      personId = existingPeople[0].id
    }

    if (!personId) {
      const { data: newPerson, error: personError } = await supabase
        .from('journal_people')
        .insert({ name })
        .select()
        .single()
      if (personError || !newPerson) return null
      personId = newPerson.id
    }

    const { data: newMember, error: memberError } = await supabase
      .from('journal_trip_members')
      .insert({ trip_id: tripId, person_id: personId, emoji })
      .select()
      .single()

    if (memberError || !newMember) return null

    setMemberId(newMember.id)
    return newMember
  }

  useEffect(() => {
    const code = getStoredNoteCode()
    if (!code) {
      setLoading(false)
      return
    }

    loadTrip(code).then(async (result) => {
      if (!result.ok) {
        clearStoredNoteCode()
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
      // 이름은 여행별이 아니라 기기별로 저장되므로 다른 여행으로 옮겨도 같은 사람이다.
      const name = getStoredPersonName()
      setStoredNoteCode(code)
      if (name) {
        setPersonNameState(name)
        setStoredPersonName(name)
      }
    }
    return result
  }

  function switchTrip() {
    clearStoredNoteCode()
    setNoteCode(null)
    setMemberId(null)
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

  async function refreshTrip() {
    if (!trip) return
    const { data } = await supabase.from('journal_trips').select('*').eq('id', trip.id).maybeSingle()
    if (data) setTrip(data)
  }

  const value = useMemo<NoteContextValue>(
    () => ({ loading, trip, error, personName, member, connectTrip, switchTrip, setPersonName, refreshTrip }),
    [loading, trip, error, personName, member],
  )

  return <NoteContext.Provider value={value}>{children}</NoteContext.Provider>
}

export function useNote() {
  const ctx = useContext(NoteContext)
  if (!ctx) throw new Error('useNote는 NoteProvider 안에서만 사용할 수 있습니다.')
  return ctx
}
