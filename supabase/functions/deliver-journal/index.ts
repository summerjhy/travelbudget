import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-note-code, x-member-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/**
 * "비밀친구에게 발송하기" 버튼. 관찰자(author) 본인만 자기 것을 보낼 수
 * 있다 — memberId가 실제로 그 여행의 journal_secret_pairs에서
 * observer_member_id로 등록돼 있는지 확인한 뒤에만 처리한다.
 *
 * 1. 지금까지 쓴 메모 전체(시간순)를 텍스트로 조합해 journal_deliveries에
 *    스냅샷으로 저장한다 — 이후 author가 메모를 고치거나 지워도 이미
 *    보낸 내용은 바뀌지 않는다.
 * 2. target(받는 사람)의 구독 기기로 "비밀친구가 보냈어요" 푸시를 보낸다.
 * 3. 조합한 텍스트를 응답으로 돌려줘 클라이언트가 카톡 공유용으로 그대로 쓴다.
 *
 * service_role이 필요한 이유: journal_notes는 본인 것만 보이는 RLS라
 * observer 본인 요청으로는 자기 메모를 읽는 데 문제 없지만, target에게
 * 노출하는 journal_deliveries insert는 target 쪽에서 볼 수 있어야 하므로
 * (RLS가 target_member_id 기준) observer 권한으로는 insert할 수 없다.
 */

interface Body {
  tripCode: string
  memberId: string
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

function formatObservedAt(iso: string): string {
  const d = new Date(iso)
  const formatted = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d)
  return formatted
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'POST만 지원합니다.' }, 405)

  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY')
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  const contact = Deno.env.get('VAPID_CONTACT') ?? 'mailto:janghy04@gmail.com'

  let body: Body
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: '요청 본문이 올바른 JSON이 아닙니다.' }, 400)
  }
  if (!body.tripCode || !body.memberId) {
    return jsonResponse({ error: '필요한 값이 없어요.' }, 400)
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: trip } = await admin
    .from('journal_trips')
    .select('id, name')
    .eq('code', body.tripCode)
    .maybeSingle()
  if (!trip) return jsonResponse({ error: '여행을 찾을 수 없어요.' }, 404)

  const { data: pair } = await admin
    .from('journal_secret_pairs')
    .select('id, observer_member_id, target_member_id')
    .eq('trip_id', trip.id)
    .eq('observer_member_id', body.memberId)
    .maybeSingle()
  if (!pair) return jsonResponse({ error: '아직 제비뽑기 전이거나 참여자를 찾을 수 없어요.' }, 404)

  const { data: existingDelivery } = await admin
    .from('journal_deliveries')
    .select('id, body, delivered_at')
    .eq('trip_id', trip.id)
    .eq('observer_member_id', body.memberId)
    .maybeSingle()
  if (existingDelivery) {
    // 이미 보낸 적 있으면 재발송하지 않고 그때 스냅샷을 그대로 돌려준다 —
    // 두 번 누르면 알림도 두 번 가는 걸 막는다.
    return jsonResponse({ text: existingDelivery.body, alreadyDelivered: true }, 200)
  }

  const { data: notes, error: notesError } = await admin
    .from('journal_notes')
    .select('body, observed_at')
    .eq('trip_id', trip.id)
    .eq('author_member_id', body.memberId)
    .order('observed_at', { ascending: true })
  if (notesError) return jsonResponse({ error: notesError.message }, 500)
  if (!notes || notes.length === 0) {
    return jsonResponse({ error: '아직 남긴 메모가 없어요.' }, 400)
  }

  const lines = notes.map((n) => `${formatObservedAt(n.observed_at)}. ${n.body}`)
  const text = `🔍 비밀친구 관찰일지\n\n${lines.join('\n')}`

  const { error: deliveryError } = await admin.from('journal_deliveries').insert({
    trip_id: trip.id,
    observer_member_id: pair.observer_member_id,
    target_member_id: pair.target_member_id,
    body: text,
  })
  if (deliveryError) return jsonResponse({ error: deliveryError.message }, 500)

  // 알림은 부가 기능이다 — 실패해도 발송(스냅샷 저장) 자체는 이미 성공했으므로 에러로 만들지 않는다.
  if (publicKey && privateKey) {
    try {
      webpush.setVapidDetails(contact, publicKey, privateKey)
      const { data: subs } = await admin
        .from('journal_push_subscriptions')
        .select('*')
        .eq('member_id', pair.target_member_id)
      const payload = JSON.stringify({
        title: '💌 비밀친구가 관찰일지를 보냈어요',
        body: `'${trip.name}'에서 당신을 지켜본 이야기가 도착했어요.`,
      })
      await Promise.allSettled(
        (subs ?? []).map((s) =>
          webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload),
        ),
      )
    } catch (e) {
      console.error('발송 알림 실패', (e as Error).message)
    }
  }

  return jsonResponse({ text, alreadyDelivered: false }, 200)
})
