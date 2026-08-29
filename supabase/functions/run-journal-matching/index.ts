import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-note-code, x-member-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/**
 * 비밀친구 제비뽑기. 관리자가 버튼으로 트리거하며, 반드시 여기(서버)에서
 * 계산해야 한다 — 클라이언트가 매칭 결과를 만들거나 볼 수 있으면
 * "비밀"이라는 컨셉 자체가 깨진다.
 *
 * 더랑주먼트(자기 자신을 관찰하지 않는 순환 순열)를 무작위 순열 재시도
 * 방식으로 만든다. 인원이 적어(보통 4명) 재시도 횟수가 크게 늘지 않는다.
 * scratchpad에서 Node 스크립트로 2~8명 각 2000회씩 "자기 자신 매칭 없음" +
 * "전원이 정확히 1명씩 관찰자/대상으로 등장"을 검증했다.
 */

interface Body {
  adminPassword: string
  tripCode: string
  /** 이미 매칭된 여행을 다시 뽑을 때 true. 기존 journal_secret_pairs를 덮어쓴다. */
  force?: boolean
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function makeDerangement(ids: string[]): { observer: string; target: string }[] {
  const n = ids.length
  let perm: string[]
  let tries = 0
  do {
    perm = shuffle(ids)
    tries++
    if (tries > 10000) throw new Error('매칭에 실패했어요. 다시 시도해주세요.')
  } while (perm.some((id, i) => id === ids[i]))
  return ids.map((observer, i) => ({ observer, target: perm[i] }))
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
  if (!body.tripCode) {
    return jsonResponse({ error: '여행 코드가 필요합니다.' }, 400)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: trip } = await supabase
    .from('journal_trips')
    .select('id, matched_at')
    .eq('code', body.tripCode)
    .maybeSingle()
  if (!trip) return jsonResponse({ error: '존재하지 않는 여행 코드입니다.' }, 404)

  if (trip.matched_at && !body.force) {
    return jsonResponse(
      { error: '이미 제비뽑기를 했어요. 다시 뽑으려면 force를 전달하세요.', matchedAt: trip.matched_at },
      409,
    )
  }

  const { data: members, error: membersError } = await supabase
    .from('journal_trip_members')
    .select('id')
    .eq('trip_id', trip.id)
    .eq('active', true)

  if (membersError) return jsonResponse({ error: membersError.message }, 500)
  if (!members || members.length < 2) {
    return jsonResponse({ error: '매칭하려면 활성 참여자가 최소 2명 필요해요.' }, 400)
  }

  const ids = members.map((m) => m.id as string)
  let pairs: { observer: string; target: string }[]
  try {
    pairs = makeDerangement(ids)
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 500)
  }

  // 재실행(force)이면 이전 매칭에 딸린 모든 흔적을 지운다.
  //  - journal_secret_pairs: 지우지 않으면 unique(trip_id, observer_member_id) 충돌.
  //  - journal_notes: 예전 대상을 관찰하며 쓴 메모라 새 매칭과 안 맞고, 그대로
  //    두면 다음 발송 때 엉뚱한 사람에게 전달된다.
  //  - journal_deliveries: 예전 매칭 기준 발송 완료 기록이라, 지우지 않으면
  //    새로 매칭된 사람이 실제로는 아직 안 보냈는데도 "이미 받은 관찰일지"가
  //    남아있거나 deliver-journal이 "이미 발송함"으로 오판한다.
  if (body.force) {
    await supabase.from('journal_deliveries').delete().eq('trip_id', trip.id)
    await supabase.from('journal_notes').delete().eq('trip_id', trip.id)
    await supabase.from('journal_secret_pairs').delete().eq('trip_id', trip.id)
  }

  const { error: insertError } = await supabase.from('journal_secret_pairs').insert(
    pairs.map((p) => ({ trip_id: trip.id, observer_member_id: p.observer, target_member_id: p.target })),
  )
  if (insertError) return jsonResponse({ error: insertError.message }, 500)

  const matchedAt = new Date().toISOString()
  const { error: updateError } = await supabase
    .from('journal_trips')
    .update({ matched_at: matchedAt })
    .eq('id', trip.id)
  if (updateError) return jsonResponse({ error: updateError.message }, 500)

  // 매칭이 끝나면 참여자 전원에게 알려준다. 실패해도(구독 없음, VAPID
  // 미설정 등) 매칭 자체는 이미 성공했으니 에러로 만들지 않는다.
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY')
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  const contact = Deno.env.get('VAPID_CONTACT') ?? 'mailto:janghy04@gmail.com'
  if (publicKey && privateKey) {
    try {
      webpush.setVapidDetails(contact, publicKey, privateKey)
      const { data: subs } = await supabase
        .from('journal_push_subscriptions')
        .select('*')
        .in('member_id', ids)
      const payload = JSON.stringify({
        title: '🎉 비밀친구가 정해졌어요',
        body: '나의 비밀친구가 결정됐어요. 지금 바로 앱에 들어와서 확인해보세요!',
      })
      const dead: string[] = []
      await Promise.allSettled(
        (subs ?? []).map(async (s) => {
          try {
            await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)
          } catch (e) {
            const status = (e as { statusCode?: number }).statusCode
            if (status === 404 || status === 410) dead.push(s.endpoint)
          }
        }),
      )
      if (dead.length > 0) {
        await supabase.from('journal_push_subscriptions').delete().in('endpoint', dead)
      }
    } catch (e) {
      console.error('매칭 알림 발송 실패', (e as Error).message)
    }
  }

  return jsonResponse({ memberCount: ids.length, matchedAt }, 200)
})
