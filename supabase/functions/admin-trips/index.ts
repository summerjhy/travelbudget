import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-trip-code',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/**
 * 관리자 여행 관리 (목록/수정/삭제).
 *
 * trips 는 RLS 에 INSERT/DELETE 정책이 없고 UPDATE 도 코드를 아는 여행 하나로
 * 제한된다. 관리 화면은 모든 여행을 다뤄야 하므로 service_role 이 필요하고,
 * 그래서 Edge Function 을 경유한다.
 *
 * 화면 진입은 클라이언트에서 코드(93519374)로 열리지만, 실제로 데이터를
 * 바꾸는 건 여기서 ADMIN_PASSWORD 를 확인한 뒤에만 한다. 삭제는 되돌릴 수
 * 없고, RLS 를 열어버리면 앱 밖 API 호출에도 그대로 적용되기 때문이다.
 */

interface Body {
  adminPassword: string
  action: 'list' | 'update' | 'delete'
  tripId?: string
  patch?: {
    name?: string
    code?: string
    startDate?: string
    endDate?: string | null
    destinations?: string[]
    spendCurrencies?: string[]
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

  // ---------- 목록 ----------
  if (body.action === 'list') {
    const { data: trips, error } = await supabase
      .from('trips')
      .select('id, code, name, start_date, end_date, destinations, spend_currencies, created_at')
      .order('created_at', { ascending: false })
    if (error) return jsonResponse({ error: error.message }, 500)

    // 여행별 지출 건수를 같이 준다 — 삭제할 때 뭘 잃는지 알아야 한다.
    const { data: counts } = await supabase.from('entries').select('trip_id')
    const byTrip = new Map<string, number>()
    for (const row of counts ?? []) {
      byTrip.set(row.trip_id, (byTrip.get(row.trip_id) ?? 0) + 1)
    }

    return jsonResponse({
      trips: (trips ?? []).map((t) => ({ ...t, entry_count: byTrip.get(t.id) ?? 0 })),
    }, 200)
  }

  if (!body.tripId) return jsonResponse({ error: '여행을 지정해주세요.' }, 400)

  // ---------- 수정 ----------
  if (body.action === 'update') {
    const p = body.patch ?? {}
    const patch: Record<string, unknown> = {}

    if (p.name !== undefined) {
      if (!p.name.trim()) return jsonResponse({ error: '여행 이름은 비울 수 없습니다.' }, 400)
      patch.name = p.name.trim()
    }
    if (p.code !== undefined) {
      if (!/^[0-9]{8}$/.test(p.code)) return jsonResponse({ error: '코드는 숫자 8자리여야 합니다.' }, 400)
      patch.code = p.code
    }
    if (p.startDate !== undefined) patch.start_date = p.startDate
    if (p.endDate !== undefined) patch.end_date = p.endDate || null
    if (p.destinations !== undefined) patch.destinations = p.destinations
    if (p.spendCurrencies !== undefined) {
      if (p.spendCurrencies.length === 0) {
        return jsonResponse({ error: '통화를 하나 이상 골라주세요.' }, 400)
      }
      patch.spend_currencies = p.spendCurrencies
    }
    if (Object.keys(patch).length === 0) return jsonResponse({ error: '바뀐 내용이 없습니다.' }, 400)

    const { data, error } = await supabase
      .from('trips')
      .update(patch)
      .eq('id', body.tripId)
      .select()
      .single()

    if (error) {
      const dup = error.code === '23505'
      return jsonResponse({ error: dup ? '이미 사용 중인 코드입니다.' : error.message }, dup ? 409 : 500)
    }

    // 공개 목록의 이름도 같이 맞춘다.
    if (patch.name !== undefined) {
      const { error: nameError } = await supabase
        .from('trip_names')
        .update({ name: patch.name })
        .eq('trip_id', body.tripId)
      if (nameError) console.error('trip_names 갱신 실패', nameError.message)
    }

    return jsonResponse({ trip: data }, 200)
  }

  // ---------- 삭제 ----------
  if (body.action === 'delete') {
    // entries/budgets/rates/trip_members/trip_names 는 ON DELETE CASCADE 로 같이 지워진다.
    const { error } = await supabase.from('trips').delete().eq('id', body.tripId)
    if (error) return jsonResponse({ error: error.message }, 500)
    return jsonResponse({ ok: true }, 200)
  }

  return jsonResponse({ error: '알 수 없는 요청입니다.' }, 400)
})
