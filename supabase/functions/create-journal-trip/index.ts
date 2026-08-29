import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-note-code, x-member-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/**
 * 관리자가 새 관찰일지(여행)를 만든다. travelbudget의 create-trip과 같은
 * 이유로 journal_trips는 RLS에 insert 정책이 없고 이 함수만 service_role로
 * 생성할 수 있다.
 *
 * memberNames를 같이 받아 초기 참여자도 한 번에 만든다 — 참여자는 코드
 * 입력 후 스스로 이름을 등록하는 게 주 경로(NoteContext.setPersonName)지만,
 * 관리자가 미리 이름을 알고 있을 때 매칭까지 한 번에 준비할 수 있게 돕는다.
 */

interface Body {
  adminPassword: string
  code: string
  name: string
  startDate?: string
  endDate?: string
  memberNames?: string[]
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

  if (!body.code || !/^\d{8}$/.test(body.code)) {
    return jsonResponse({ error: '코드는 숫자 8자리여야 합니다.' }, 400)
  }
  if (!body.name?.trim()) {
    return jsonResponse({ error: '관찰일지 이름은 필수입니다.' }, 400)
  }

  const memberNames = (body.memberNames ?? []).map((n) => n.trim()).filter(Boolean)
  if (memberNames.some((n) => n.length > 10)) {
    return jsonResponse({ error: '참여자 이름은 10자 이하여야 합니다.' }, 400)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: trip, error } = await supabase
    .from('journal_trips')
    .insert({
      code: body.code,
      name: body.name.trim(),
      start_date: body.startDate || null,
      end_date: body.endDate || null,
    })
    .select()
    .single()

  if (error) {
    const status = error.code === '23505' ? 409 : 500
    const message = error.code === '23505' ? '이미 사용 중인 코드입니다.' : error.message
    return jsonResponse({ error: message }, status)
  }

  // 참여자를 미리 만들어둔다. 이름이 같은 journal_people이 이미 있으면
  // (다른 관찰일지에서 쓴 적 있는 이름) 재사용하고, 없으면 새로 만든다.
  for (const name of memberNames) {
    const { data: existing } = await supabase
      .from('journal_people')
      .select('id')
      .eq('name', name)
      .maybeSingle()

    let personId = existing?.id as string | undefined
    if (!personId) {
      const { data: person, error: personError } = await supabase
        .from('journal_people')
        .insert({ name })
        .select('id')
        .single()
      if (personError) {
        console.error('journal_people insert 실패', personError.message)
        continue
      }
      personId = person.id
    }

    const { error: memberError } = await supabase
      .from('journal_trip_members')
      .insert({ trip_id: trip.id, person_id: personId })
    if (memberError) {
      console.error('journal_trip_members insert 실패', memberError.message)
    }
  }

  return jsonResponse({ trip }, 201)
})
