const url = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/+$/, '')
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

/**
 * 관리자 참여 알림 (웹 푸시).
 *
 * 참여자가 여행에 새로 들어오면 관리자 폰으로 알림이 간다. 메일 대신
 * 웹 푸시를 쓴다 — 외부 메일 서비스 가입이 필요 없기 때문.
 *
 * 알림을 받으려면 그 기기에서 한 번 등록해야 한다(설정 탭 > 관리자 알림).
 * 홈 화면에 설치한 PWA 여야 안정적으로 도착한다 — 브라우저 탭만으로는
 * 안드로이드에서도 잘 안 온다.
 */

async function call(payload: Record<string, unknown>) {
  try {
    const res = await fetch(`${url}/functions/v1/notify-join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false as const, error: data?.error ?? '요청에 실패했어요.' }
    return { ok: true as const, data }
  } catch {
    return { ok: false as const, error: '네트워크를 확인해주세요.' }
  }
}

/** 이 브라우저가 웹 푸시를 지원하는지. */
export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

/** 이 기기가 이미 알림을 받도록 등록돼 있는지. */
export async function pushEnabled(): Promise<boolean> {
  if (!pushSupported()) return false
  try {
    const reg = await navigator.serviceWorker.ready
    return (await reg.pushManager.getSubscription()) !== null
  } catch {
    return false
  }
}

/**
 * 이 기기를 관리자 알림 수신 기기로 등록한다.
 *
 * 관리자 비밀번호를 요구한다 — 안 그러면 아무나 자기 폰을 등록해서
 * 남의 여행 참여 알림을 받아볼 수 있다.
 */
export async function enablePush(
  adminPassword: string,
  label?: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!pushSupported()) {
    return { ok: false, error: '이 브라우저는 알림을 지원하지 않아요.' }
  }
  if (!vapidPublicKey) {
    return { ok: false, error: '알림 키가 설정되지 않았어요.' }
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    return { ok: false, error: '알림이 차단돼 있어요. 브라우저 설정에서 허용해주세요.' }
  }

  try {
    const reg = await navigator.serviceWorker.ready
    // 이미 구독이 있으면 재사용한다. 매번 새로 만들면 endpoint 가 바뀌어
    // DB 에 죽은 행이 쌓인다.
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      }))

    const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      return { ok: false, error: '구독 정보를 만들지 못했어요.' }
    }

    const result = await call({
      action: 'subscribe',
      adminPassword,
      label: label ?? navigator.userAgent.slice(0, 60),
      subscription: { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } },
    })
    if (!result.ok) return { ok: false, error: result.error }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: (e as Error).message || '등록에 실패했어요.' }
  }
}

/** 이 기기에서 알림 수신을 끈다. */
export async function disablePush(): Promise<{ ok: boolean }> {
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    // 서버 쪽 행은 다음 발송 때 404/410 으로 자동 정리된다.
    if (sub) await sub.unsubscribe()
    return { ok: true }
  } catch {
    return { ok: false }
  }
}

/** 등록이 잘 됐는지 확인용 알림을 보낸다. */
export async function sendTestPush(adminPassword: string) {
  return call({ action: 'test', adminPassword })
}

/**
 * 새 참여자가 들어왔다고 알린다.
 *
 * 실패해도 참여 자체는 성공이므로 결과를 무시한다 — 호출부에서 await 하지
 * 않아도 되도록 예외를 삼킨다.
 */
export function notifyJoin(tripCode: string, memberId: string) {
  void call({ action: 'notify', tripCode, memberId })
}

/**
 * VAPID 공개키(base64url)를 subscribe 가 요구하는 바이트 배열로.
 *
 * ArrayBuffer 를 직접 만들어 담는다 — Uint8Array 를 그대로 쓰면 타입이
 * SharedArrayBuffer 를 포함할 수 있어 BufferSource 로 좁혀지지 않는다.
 */
function urlBase64ToUint8Array(base64: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(normalized)
  const buf = new ArrayBuffer(raw.length)
  const view = new Uint8Array(buf)
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i)
  return buf
}
