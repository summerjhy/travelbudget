import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-note-code, x-member-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/**
 * 관리자 관찰일지 관리 (목록/수정/삭제). travelbudget의 admin-trips와
 * 동일한 이유로 Edge Function을 거친다 — journal_trips는 RLS에
 * insert/delete 정책이 없고 update도 코드를 아는 여행 하나로 제한된다.
 */

interface Body {
  adminPassword: string
  action: 'list' | 'update' | 'delete'
  tripId?: string
  patch?: {
    name?: string
    code?: string
    startDate?: string | null
    endDate?: string | null
  }
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'POST만 지원합니다.' }, 405)

  let body: Body
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: '요청 본문이 올바른 JSON이 아닙니다.' }, 400)
  }

  const adminPassword = Deno.env.get('ADMIN_PASSWORD')
  if (!adminPassword) {
    return jsonResponse({ error: '서버에 관리자 비밀번호가 설정되지 않았습니다.' }, 500)
  }
  if (body.adminPassword !== adminPassword) {
    return jsonResponse({ error: '관리자 비밀번호가 올바르지 않습니다.' }, 401)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  if (body.action === 'list') {
    const { data: trips, error } = await supabase
      .from('journal_trips')
      .select('id, code, name, start_date, end_date, matched_at, revealed_at, created_at')
      .order('created_at', { ascending: false })
    if (error) return jsonResponse({ error: error.message }, 500)

    const { data: members } = await supabase.from('journal_trip_members').select('trip_id')
    const byTrip = new Map<string, number>()
    for (const row of members ?? []) {
      byTrip.set(row.trip_id, (byTrip.get(row.trip_id) ?? 0) + 1)
    }

    return jsonResponse({
      trips: (trips ?? []).map((t) => ({ ...t, member_count: byTrip.get(t.id) ?? 0 })),
    }, 200)
  }

  if (!body.tripId) return jsonResponse({ error: '여행을 지정해주세요.' }, 400)

  if (body.action === 'update') {
    const p = body.patch ?? {}
    const patch: Record<string, unknown> = {}

    if (p.name !== undefined) {
      if (!p.name.trim()) return jsonResponse({ error: '이름은 비울 수 없습니다.' }, 400)
      patch.name = p.name.trim()
    }
    if (p.code !== undefined) {
      if (!/^[0-9]{8}$/.test(p.code)) return jsonResponse({ error: '코드는 숫자 8자리여야 합니다.' }, 400)
      patch.code = p.code
    }
    if (p.startDate !== undefined) patch.start_date = p.startDate
    if (p.endDate !== undefined) patch.end_date = p.endDate
    if (Object.keys(patch).length === 0) return jsonResponse({ error: '바뀐 내용이 없습니다.' }, 400)

    const { data, error } = await supabase
      .from('journal_trips')
      .update(patch)
      .eq('id', body.tripId)
      .select()
      .single()

    if (error) {
      const dup = error.code === '23505'
      return jsonResponse({ error: dup ? '이미 사용 중인 코드입니다.' : error.message }, dup ? 409 : 500)
    }
    return jsonResponse({ trip: data }, 200)
  }

  if (body.action === 'delete') {
    // journal_trip_members/journal_notes/journal_secret_pairs/journal_deliveries/
    // journal_reminders는 ON DELETE CASCADE로 같이 지워진다.
    const { error } = await supabase.from('journal_trips').delete().eq('id', body.tripId)
    if (error) return jsonResponse({ error: error.message }, 500)
    return jsonResponse({ ok: true }, 200)
  }

  return jsonResponse({ error: '알 수 없는 요청입니다.' }, 400)
})
