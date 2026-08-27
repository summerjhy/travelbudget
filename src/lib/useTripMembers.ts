import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import type { Person, TripMember } from './types'
import { withEmoji } from './memberEmoji'

export interface MemberWithName extends TripMember {
  personName: string
  /** 이모지 + 이름. 화면에 사람 이름을 쓸 때는 항상 이걸 쓴다. */
  displayName: string
}

export const MAX_NAME_LENGTH = 10

/** people.name 의 CHECK 제약(1~10자)과 같은 조건. 저장 전에 여기서 먼저 거른다. */
export function validateName(name: string): { ok: true; name: string } | { ok: false; error: string } {
  const trimmed = name.trim()
  if (!trimmed) return { ok: false, error: '이름을 입력해주세요.' }
  if (trimmed.length > MAX_NAME_LENGTH) {
    return { ok: false, error: `이름은 ${MAX_NAME_LENGTH}자 이하로 입력해주세요.` }
  }
  return { ok: true, name: trimmed }
}

export function useTripMembers(tripId: string | undefined) {
  // 비활성 멤버까지 전부 담는다. 목록 UI 는 활성만 쓰지만, 집계와 이름 조회는
  // 비활성 멤버도 알아야 한다 — 모르면 그 사람 지출이 '공금' 으로 새어 들어간다.
  const [allMembers, setAllMembers] = useState<MemberWithName[]>([])
  const [loading, setLoading] = useState(true)

  async function refresh() {
    if (!tripId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('trip_members')
      .select('*, person:people(*)')
      .eq('trip_id', tripId)
      .order('sort', { ascending: true })

    if (!error && data) {
      setAllMembers(
        data.map((m: TripMember & { person: Person }) => ({
          ...m,
          personName: m.person?.name ?? '',
          displayName: withEmoji(m.emoji, m.person?.name ?? ''),
        })),
      )
    }
    setLoading(false)
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId])

  const members = useMemo(() => allMembers.filter((m) => m.active), [allMembers])

  /**
   * 참여자를 미리 등록한다. 나중에 본인이 접속해 같은 이름을 입력하면
   * TripContext.loadMember 가 이 행을 찾아 그대로 붙으므로 중복이 생기지 않는다.
   * 그래서 이름 표기가 어긋나지 않게 trim 과 중복 검사를 꼭 거친다.
   */
  async function addMember(rawName: string, emoji = ''): Promise<{ ok: boolean; error?: string }> {
    if (!tripId) return { ok: false, error: '여행 정보가 없어요.' }
    const v = validateName(rawName)
    if (!v.ok) return v

    if (allMembers.some((m) => m.personName === v.name)) {
      return { ok: false, error: `'${v.name}' 은(는) 이미 있어요.` }
    }

    const { data: person, error: personError } = await supabase
      .from('people')
      .insert({ name: v.name })
      .select()
      .single()
    if (personError || !person) return { ok: false, error: '참여자 추가에 실패했어요.' }

    const { error: memberError } = await supabase
      .from('trip_members')
      .insert({ trip_id: tripId, person_id: person.id, sort: allMembers.length, emoji })
    if (memberError) return { ok: false, error: '참여자 추가에 실패했어요.' }

    await refresh()
    return { ok: true }
  }

  /** 참여자 이모지만 바꾼다. 이름과 달리 people 을 건드리지 않는다. */
  async function setMemberEmoji(memberId: string, emoji: string): Promise<{ ok: boolean; error?: string }> {
    const { error } = await supabase.from('trip_members').update({ emoji }).eq('id', memberId)
    if (error) return { ok: false, error: '이모지 저장에 실패했어요.' }
    await refresh()
    return { ok: true }
  }

  /**
   * 목록에서 빼기. trip_members 에는 DELETE 정책이 없고, entries.member_id 가
   * 이 행을 참조하므로 하드 삭제하지 않고 active=false 로만 둔다.
   */
  async function deactivateMember(memberId: string): Promise<{ ok: boolean; error?: string }> {
    const { error } = await supabase.from('trip_members').update({ active: false }).eq('id', memberId)
    if (error) return { ok: false, error: '삭제에 실패했어요.' }
    await refresh()
    return { ok: true }
  }

  async function reactivateMember(memberId: string): Promise<{ ok: boolean; error?: string }> {
    const { error } = await supabase.from('trip_members').update({ active: true }).eq('id', memberId)
    if (error) return { ok: false, error: '되돌리기에 실패했어요.' }
    await refresh()
    return { ok: true }
  }

  return { members, allMembers, loading, refresh, addMember, setMemberEmoji, deactivateMember, reactivateMember }
}
