const url = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/+$/, '')
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export async function deliverJournal(
  tripCode: string,
  memberId: string,
): Promise<{ ok: true; text: string; alreadyDelivered: boolean } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${url}/functions/v1/deliver-journal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      body: JSON.stringify({ tripCode, memberId }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: data?.error ?? '발송에 실패했어요.' }
    return { ok: true, text: data.text, alreadyDelivered: data.alreadyDelivered }
  } catch {
    return { ok: false, error: '네트워크를 확인해주세요.' }
  }
}
