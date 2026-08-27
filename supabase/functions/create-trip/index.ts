import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-trip-code',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface CreateTripBody {
  adminPassword: string
  code: string
  name: string
  startDate: string
  endDate?: string
  destinations?: string[]
  tz?: string
  baseCurrency?: string
  spendCurrencies?: string[]
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'POST만 지원합니다.' }, 405)
  }

  let body: CreateTripBody
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

  if (!body.code || !/^\d{8}$/.test(body.code)) {
    return jsonResponse({ error: '코드는 숫자 8자리여야 합니다.' }, 400)
  }
  if (!body.name || !body.startDate) {
    return jsonResponse({ error: '여행 이름과 시작일은 필수입니다.' }, 400)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data, error } = await supabase
    .from('trips')
    .insert({
      code: body.code,
      name: body.name,
      start_date: body.startDate,
      end_date: body.endDate ?? null,
      destinations: body.destinations ?? [],
      tz: body.tz || 'Asia/Seoul',
      base_currency: body.baseCurrency ?? 'KRW',
      spend_currencies: body.spendCurrencies ?? ['CNY'],
    })
    .select()
    .single()

  if (error) {
    const status = error.code === '23505' ? 409 : 500
    const message = error.code === '23505' ? '이미 사용 중인 코드입니다.' : error.message
    return jsonResponse({ error: message }, status)
  }

  // 홈 화면 공개 목록에 이름만 넣는다 (마이그레이션 0005).
  // 실패해도 여행 생성 자체는 성공이므로 막지 않고 로그만 남긴다.
  const { error: nameError } = await supabase
    .from('trip_names')
    .insert({ trip_id: data.id, name: data.name, created_at: data.created_at })
  if (nameError) {
    console.error('trip_names insert 실패', nameError.message)
  }

  return jsonResponse({ trip: data }, 201)
})
