const url = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/+$/, '')
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export interface ImageParseResult {
  merchant: string
  krw: number | null
  amount: number | null
  currency: string | null
  date: string | null
}

export interface ParseImagesResponse {
  ok: boolean
  results?: (ImageParseResult | null)[]
  error?: string
}

export async function parseImages(tripCode: string, imagesBase64: string[]): Promise<ParseImagesResponse> {
  try {
    const res = await fetch(`${url}/functions/v1/parse-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'x-trip-code': tripCode,
      },
      body: JSON.stringify({ images: imagesBase64 }),
    })
    const data = await res.json()
    if (!res.ok) return { ok: false, error: data?.error ?? '사진 분석에 실패했어요.' }
    return { ok: true, results: data.results }
  } catch {
    return { ok: false, error: '사진 분석에 실패했어요. 네트워크를 확인해주세요.' }
  }
}
