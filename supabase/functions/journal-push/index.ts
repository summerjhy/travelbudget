import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-note-code, x-member-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/**
 * 참여자별 웹 푸시 구독 등록/해제/테스트.
 *
 * travelbudget의 notify-join과 달리 "관리자 한 명"이 아니라 참여자 각자가
 * 자기 기기를 등록한다. 그래서 ADMIN_PASSWORD 대신 tripCode+memberId로
 * "그 여행의 실제 참여자인지"만 확인한다 — 참여자 자신의 알림 설정이라
 * 비밀번호까지 요구할 이유가 없다.
 */

interface Body {
  action: 'subscribe' | 'unsubscribe' | 'test'
  tripCode: string
  memberId: string
  subscription?: { endpoint: string; keys: { p256dh: string; auth: string } }
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

  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY')
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  const contact = Deno.env.get('VAPID_CONTACT') ?? 'mailto:janghy04@gmail.com'
  if (!publicKey || !privateKey) {
    return jsonResponse({ error: 'VAPID 키가 설정되지 않았습니다.' }, 500)
  }
  webpush.setVapidDetails(contact, publicKey, privateKey)

  let body: Body
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: '잘못된 요청이에요.' }, 400)
  }

  if (!body.tripCode || !body.memberId) {
    return jsonResponse({ error: '필요한 값이 없어요.' }, 400)
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // 실제로 그 여행의 그 참여자가 맞는지 확인한다. 이걸 생략하면 임의의
  // memberId로 남의 구독을 등록/삭제하거나 테스트 알림을 울릴 수 있다.
  const { data: trip } = await admin
    .from('journal_trips')
    .select('id')
    .eq('code', body.tripCode)
    .maybeSingle()
  if (!trip) return jsonResponse({ error: '여행을 찾을 수 없어요.' }, 404)

  const { data: member } = await admin
    .from('journal_trip_members')
    .select('id')
    .eq('id', body.memberId)
    .eq('trip_id', trip.id)
    .maybeSingle()
  if (!member) return jsonResponse({ error: '참여자를 찾을 수 없어요.' }, 404)

  if (body.action === 'subscribe') {
    const sub = body.subscription
    if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
      return jsonResponse({ error: '구독 정보가 올바르지 않아요.' }, 400)
    }
    const { error } = await admin
      .from('journal_push_subscriptions')
      .upsert(
        { member_id: member.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
        { onConflict: 'endpoint' },
      )
    if (error) return jsonResponse({ error: '등록에 실패했어요.' }, 500)
    return jsonResponse({ ok: true }, 200)
  }

  if (body.action === 'unsubscribe') {
    const sub = body.subscription
    if (!sub?.endpoint) return jsonResponse({ error: '구독 정보가 올바르지 않아요.' }, 400)
    await admin.from('journal_push_subscriptions').delete().eq('endpoint', sub.endpoint)
    return jsonResponse({ ok: true }, 200)
  }

  if (body.action === 'test') {
    const { data: subs } = await admin
      .from('journal_push_subscriptions')
      .select('*')
      .eq('member_id', member.id)
    if (!subs || subs.length === 0) return jsonResponse({ ok: true, sent: 0 }, 200)

    const payload = JSON.stringify({ title: '🔍 비밀친구 관찰일지', body: '알림이 잘 도착했어요.' })
    let sent = 0
    await Promise.allSettled(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)
          sent++
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode
          if (status === 404 || status === 410) {
            await admin.from('journal_push_subscriptions').delete().eq('endpoint', s.endpoint)
          }
        }
      }),
    )
    return jsonResponse({ ok: true, sent }, 200)
  }

  return jsonResponse({ error: '알 수 없는 요청이에요.' }, 400)
})
