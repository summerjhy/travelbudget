const url = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/+$/, '')
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export interface ImageParseResult {
  merchant: string
  krw: number | null
  amount: number | null
  currency: string | null
  date: string | null
  /** MM-DD. 연도는 안 보이지만 월일은 보일 때만 채워진다(date 는 이 경우 null). */
  monthDay: string | null
  /** HH:MM. 목록형 이용내역처럼 화면에 시각이 보일 때만 채워진다. */
  time: string | null
}

/** 사진 한 장이 실패한 이유. 클라이언트가 이유별로 다른 안내를 보여준다. */
export type ImageFailReason = 'overloaded' | 'quota' | 'other'

export interface ParseImagesResponse {
  ok: boolean
  /**
   * 사진 한 장당 하나. 그 사진에서 읽은 거래 배열(단건 화면이면 1개,
   * 목록형 화면이면 여러 개), 못 읽었으면 null.
   */
  results?: (ImageParseResult[] | null)[]
  /** results 와 같은 순서. 그 사진이 실패했을 때만 사유가 들어있고, 성공했으면 null. */
  reasons?: (ImageFailReason | null)[]
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
    return { ok: true, results: data.results, reasons: data.reasons }
  } catch {
    return { ok: false, error: '사진 분석에 실패했어요. 네트워크를 확인해주세요.' }
  }
}
