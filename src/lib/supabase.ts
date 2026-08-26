import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  console.warn('Supabase 환경변수가 설정되지 않았습니다. .env를 확인하세요.')
}

let currentTripCode: string | null = null

export function setTripCode(code: string | null) {
  currentTripCode = code
}

export const supabase = createClient(url ?? '', anonKey ?? '', {
  global: {
    fetch: (input, init) => {
      const headers = new Headers(init?.headers)
      if (currentTripCode) {
        headers.set('x-trip-code', currentTripCode)
      }
      return fetch(input, { ...init, headers })
    },
  },
})
