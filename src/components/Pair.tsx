import { foreign, won } from '../lib/format'
import { BASE_CURRENCY } from '../lib/tripCurrency'

/**
 * `380元 · ₩72,200` 형태의 금액 병기.
 * `currency` 가 null(외화가 여럿이라 합칠 수 없음)이거나 원화면 원화만 찍는다.
 */
export function Pair({ amount, krw, currency }: { amount: number; krw: number; currency: string | null }) {
  if (!currency || currency === BASE_CURRENCY) return <span className="pair">{won(krw)}</span>
  return (
    <span className="pair">
      <span className="c">{foreign(amount, currency)}</span>
      <span className="d">·</span>
      <span>{won(krw)}</span>
    </span>
  )
}
