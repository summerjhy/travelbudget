const url = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/+$/, '')
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

async function call(payload: Record<string, unknown>) {
  try {
    const res = await fetch(`${url}/functions/v1/journal-push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false as const, error: data?.error ?? '요청에 실패했어요.' }
    return { ok: true as const, data }
  } catch {
    return { ok: false as const, error: '네트워크를 확인해주세요.' }
  }
}

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export async function pushEnabled(): Promise<boolean> {
  if (!pushSupported()) return false
  try {
    const reg = await navigator.serviceWorker.ready
    return (await reg.pushManager.getSubscription()) !== null
  } catch {
    return false
  }
}

export async function enableJournalPush(
  tripCode: string,
  memberId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!pushSupported()) return { ok: false, error: '이 브라우저는 알림을 지원하지 않아요.' }
  if (!vapidPublicKey) return { ok: false, error: '알림 키가 설정되지 않았어요.' }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return { ok: false, error: '알림이 차단돼 있어요. 브라우저 설정에서 허용해주세요.' }

  try {
    const reg = await navigator.serviceWorker.ready
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) }))

    const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      return { ok: false, error: '구독 정보를 만들지 못했어요.' }
    }

    const result = await call({
      action: 'subscribe',
      tripCode,
      memberId,
      subscription: { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } },
    })
    if (!result.ok) return { ok: false, error: result.error }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: (e as Error).message || '등록에 실패했어요.' }
  }
}

export async function disableJournalPush(tripCode: string, memberId: string): Promise<{ ok: boolean }> {
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      const json = sub.toJSON() as { endpoint?: string }
      await sub.unsubscribe()
      if (json.endpoint) await call({ action: 'unsubscribe', tripCode, memberId, subscription: { endpoint: json.endpoint, keys: { p256dh: '', auth: '' } } })
    }
    return { ok: true }
  } catch {
    return { ok: false }
  }
}

export function sendTestJournalPush(tripCode: string, memberId: string) {
  return call({ action: 'test', tripCode, memberId })
}

function urlBase64ToUint8Array(base64: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(normalized)
  const buf = new ArrayBuffer(raw.length)
  const view = new Uint8Array(buf)
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i)
  return buf
}
