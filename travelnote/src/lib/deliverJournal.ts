const url = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/+$/, '')
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

async function call(tripCode: string, memberId: string, checkOnly: boolean) {
  try {
    const res = await fetch(`${url}/functions/v1/deliver-journal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      body: JSON.stringify({ tripCode, memberId, checkOnly }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false as const, error: data?.error ?? '발송에 실패했어요.' }
    return { ok: true as const, text: data.text as string | null, alreadyDelivered: data.alreadyDelivered as boolean }
  } catch {
    return { ok: false as const, error: '네트워크를 확인해주세요.' }
  }
}

/** 실제로 발송(또는 갱신)한다 — 메모를 서버에 upsert하고, 최초 발송이면 알림도 보낸다. */
export function deliverJournal(tripCode: string, memberId: string) {
  return call(tripCode, memberId, false)
}

/**
 * 아무것도 쓰지 않고 "이미 발송했는지"만 확인한다. DeliverTab이 탭을 열
 * 때마다 상태를 복원하려고 호출하는데, 여기서 실제 발송 함수를 그대로
 * 부르면 탭을 열기만 해도 발송(upsert)이 실행되는 버그가 있었다.
 */
export function checkDelivered(tripCode: string, memberId: string) {
  return call(tripCode, memberId, true)
}
