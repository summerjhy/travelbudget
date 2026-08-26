import { won, yuan } from '../lib/format'

export function Pair({ cny, krw }: { cny: number; krw: number }) {
  return (
    <span className="pair">
      <span className="c">{yuan(cny)}</span>
      <span className="d">·</span>
      <span>{won(krw)}</span>
    </span>
  )
}
