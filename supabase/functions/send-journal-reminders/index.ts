import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/**
 * pg_cron이 1분마다 호출하는 리마인더 발송기.
 *
 * 앱이 완전히 종료된 상태에서도 정확한 시각에 알림이 와야 하므로
 * (사용자 요구사항), 클라이언트 setTimeout이 아니라 서버가 시각을 체크해
 * 발송한다. 각 journal_reminders 행에 대해:
 *  1. enabled가 아니면 건너뜀
 *  2. 지금(KST 기준) 시각이 [start_hour, end_hour) 범위 밖이면 건너뜀
 *  3. last_sent_at으로부터 interval_minutes가 지나지 않았으면 건너뜀
 *  4. 위 조건을 통과하면 발송하고 last_sent_at을 갱신
 *
 * 인증 없이 호출되지만(anon key로 pg_cron이 호출), 클라이언트가 원하는
 * 대상에게 임의로 알림을 보내게 만들 수는 없다 — 발송 대상/문구를 전부
 * 서버가 DB 상태만으로 결정하고, 요청 바디를 아예 읽지 않는다.
 */

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

/** Asia/Seoul 기준 지금 시각의 "시"(0~23)를 반환. */
function currentHourInSeoul(): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(new Date())
  const hourPart = parts.find((p) => p.type === 'hour')?.value ?? '0'
  // 'en-US' + hour12:false 가 자정을 '24'로 줄 때가 있어 24를 0으로 보정한다.
  return Number(hourPart) % 24
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

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

  const now = new Date()
  const hour = currentHourInSeoul()

  const { data: reminders, error } = await admin
    .from('journal_reminders')
    .select('*')
    .eq('enabled', true)
  if (error) return jsonResponse({ error: error.message }, 500)

  const due = (reminders ?? []).filter((r) => {
    const inWindow = r.start_hour <= r.end_hour
      ? hour >= r.start_hour && hour < r.end_hour
      : hour >= r.start_hour || hour < r.end_hour // 자정을 넘나드는 범위(예: 22시~2시)도 지원
    if (!inWindow) return false
    if (!r.last_sent_at) return true
    const elapsedMinutes = (now.getTime() - new Date(r.last_sent_at).getTime()) / 60000
    return elapsedMinutes >= r.interval_minutes
  })

  if (due.length === 0) return jsonResponse({ ok: true, sent: 0 }, 200)

  const memberIds = due.map((r) => r.member_id)
  const { data: subs } = await admin
    .from('journal_push_subscriptions')
    .select('*')
    .in('member_id', memberIds)

  const payload = JSON.stringify({
    title: '🔍 비밀친구 관찰일지',
    body: '비밀친구 관찰 메모, 잊지 않으셨죠? 지금 한 줄 남겨보세요.',
  })

  let sent = 0
  const dead: string[] = []

  for (const reminder of due) {
    const memberSubs = (subs ?? []).filter((s) => s.member_id === reminder.member_id)
    let anySent = false
    await Promise.allSettled(
      memberSubs.map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)
          anySent = true
          sent++
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode
          if (status === 404 || status === 410) dead.push(s.endpoint)
        }
      }),
    )
    // 구독이 없어도(아직 알림 권한을 안 준 기기) last_sent_at은 갱신한다 —
    // 안 그러면 구독 없는 멤버가 매분 계속 due 목록에 남아 불필요한 조회가 반복된다.
    void anySent
    await admin.from('journal_reminders').update({ last_sent_at: now.toISOString() }).eq('id', reminder.id)
  }

  if (dead.length > 0) {
    await admin.from('journal_push_subscriptions').delete().in('endpoint', dead)
  }

  return jsonResponse({ ok: true, sent, checked: due.length }, 200)
})
