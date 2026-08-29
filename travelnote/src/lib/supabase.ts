import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  console.warn('Supabase 환경변수가 설정되지 않았습니다. .env를 확인하세요.')
}

let currentNoteCode: string | null = null
let currentMemberId: string | null = null

export function setNoteCode(code: string | null) {
  currentNoteCode = code
}

/**
 * journal_secret_pairs RLS가 "내가 관찰하는 대상만" 노출하려면 요청자
 * 자신이 누구인지도 헤더로 알려야 한다 (observer_member_id = current_member_id()).
 */
export function setMemberId(id: string | null) {
  currentMemberId = id
}

export const supabase = createClient(url ?? '', anonKey ?? '', {
  global: {
    fetch: (input, init) => {
      const headers = new Headers(init?.headers)
      if (currentNoteCode) headers.set('x-note-code', currentNoteCode)
      if (currentMemberId) headers.set('x-member-id', currentMemberId)
      return fetch(input, { ...init, headers })
    },
  },
})
