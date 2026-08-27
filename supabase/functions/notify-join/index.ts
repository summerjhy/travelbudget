import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-trip-code',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/**
 * 관리자 참여 알림 (웹 푸시).
 *
 * 참여자가 여행에 새로 들어오면 관리자 폰으로 알림을 보낸다. 메일 서비스를
 * 붙이지 않고 웹 푸시로 처리한다 — 외부 가입 없이 VAPID 키만 있으면 된다.
 *
 * 두 가지 일을 한다:
 *  - subscribe: 관리자 기기를 push_subscriptions 에 등록. ADMIN_PASSWORD 를
 *    확인한 뒤에만 받는다. 아무나 등록하면 남의 폰으로 알림이 가버린다.
 *  - notify: 등록된 기기 전부에 알림 발송. 이건 참여자(anon)가 호출하므로
 *    비밀번호를 요구하지 않는다 — 대신 보내는 내용을 클라이언트가 정하지
 *    못하게 하고(이름/여행명만 받아 서버가 문장을 만든다), 실제로 그 여행에
 *    그 참여자가 있는지 DB 로 확인한 뒤에만 보낸다.
 *
 * 알림 실패는 참여 자체를 막지 않는다 — 클라이언트가 결과를 무시한다.
 */

interface Body {
  action: 'subscribe' | 'notify' | 'test'
  // subscribe / test
  adminPassword?: string
  subscription?: { endpoint: string; keys: { p256dh: string; auth: string } }
  label?: string
  // notify
  tripCode?: string
  memberId?: string
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY')
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  const contact = Deno.env.get('VAPID_CONTACT') ?? 'mailto:janghy04@gmail.com'
  if (!publicKey || !privateKey) {
    return jsonResponse({ error: 'VAPID 키가 설정되지 않았습니다.' }, 500)
  }
  webpush.setVapidDetails(contact, publicKey, privateKey)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  let body: Body
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: '잘못된 요청이에요.' }, 400)
  }

  // ── 관리자 기기 등록 ──────────────────────────────────────────────
  if (body.action === 'subscribe') {
    if (body.adminPassword !== Deno.env.get('ADMIN_PASSWORD')) {
      return jsonResponse({ error: '관리자 비밀번호가 올바르지 않습니다.' }, 401)
    }
    const sub = body.subscription
    if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
      return jsonResponse({ error: '구독 정보가 올바르지 않아요.' }, 400)
    }
    // 같은 기기에서 다시 허용하면 endpoint 가 같으므로 갱신만 한다.
    const { error } = await admin
      .from('push_subscriptions')
      .upsert(
        {
          endpoint: sub.endpoint,
          p256dh: sub.keys.p256dh,
          auth: sub.keys.auth,
          label: body.label ?? null,
        },
        { onConflict: 'endpoint' },
      )
    if (error) return jsonResponse({ error: '등록에 실패했어요.' }, 500)
    return jsonResponse({ ok: true }, 200)
  }

  // ── 발송 ─────────────────────────────────────────────────────────
  let title: string
  let message: string

  if (body.action === 'test') {
    if (body.adminPassword !== Deno.env.get('ADMIN_PASSWORD')) {
      return jsonResponse({ error: '관리자 비밀번호가 올바르지 않습니다.' }, 401)
    }
    title = '🧳 여행 가계부'
    message = '알림이 잘 도착했어요.'
  } else if (body.action === 'notify') {
    // 클라이언트가 보낸 이름을 그대로 믿지 않는다. memberId 로 DB 를 조회해
    // 실제 이름과 여행명을 가져온다 — 안 그러면 아무나 임의의 문구로 관리자
    // 폰에 알림을 띄울 수 있다.
    if (!body.tripCode || !body.memberId) {
      return jsonResponse({ error: '필요한 값이 없어요.' }, 400)
    }
    const { data: trip } = await admin
      .from('trips')
      .select('id, name')
      .eq('code', body.tripCode)
      .maybeSingle()
    if (!trip) return jsonResponse({ error: '여행을 찾을 수 없어요.' }, 404)

    const { data: member } = await admin
      .from('trip_members')
      .select('id, emoji, people ( name )')
      .eq('id', body.memberId)
      .eq('trip_id', trip.id)
      .maybeSingle()
    if (!member) return jsonResponse({ error: '참여자를 찾을 수 없어요.' }, 404)

    const person = member.people as { name?: string } | null
    const who = `${member.emoji ?? ''}${person?.name ?? '누군가'}`.trim()
    title = '🧳 새 참여자'
    message = `${who}님이 '${trip.name}'에 참여했어요.`
  } else {
    return jsonResponse({ error: '알 수 없는 요청이에요.' }, 400)
  }

  const { data: subs } = await admin.from('push_subscriptions').select('*')
  if (!subs || subs.length === 0) return jsonResponse({ ok: true, sent: 0 }, 200)

  const payload = JSON.stringify({ title, body: message })
  let sent = 0
  const dead: string[] = []

  await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        )
        sent++
      } catch (e) {
        // 404/410 은 기기가 구독을 버린 것 — 지워야 계속 재시도하지 않는다.
        const status = (e as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) dead.push(s.endpoint)
        else console.error('푸시 실패:', status, (e as Error).message)
      }
    }),
  )

  if (dead.length > 0) {
    await admin.from('push_subscriptions').delete().in('endpoint', dead)
  }

  return jsonResponse({ ok: true, sent, removed: dead.length }, 200)
})
