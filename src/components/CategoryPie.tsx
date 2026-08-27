import { won } from '../lib/format'

export interface Slice {
  label: string
  amount: number
}

/**
 * 카테고리별 지출 원형 그래프.
 *
 * 공금 지출만 넣는다 — 개인 지출은 각자 돈이라 예산과 무관하다.
 * 통화가 섞여도 원화는 언제나 더할 수 있어 원화 기준으로 낸다.
 *
 * 조각 색은 강조색 하나를 밝기만 바꿔 쓴다. 카테고리마다 다른 색을 주면
 * 여덟 가지 색이 화면에서 싸우고, 테마를 바꿔도 따라오지 않는다.
 */
export function CategoryPie({ slices }: { slices: Slice[] }) {
  const total = slices.reduce((s, x) => s + x.amount, 0)

  // 큰 것부터. 조각이 많으면 뒤쪽을 '기타'로 묶어 원판이 실처럼 쪼개지지 않게 한다.
  const shown = (() => {
    const sorted = [...slices].filter((s) => s.amount > 0).sort((a, b) => b.amount - a.amount)
    if (sorted.length <= 6) return sorted
    const head = sorted.slice(0, 5)
    const rest = sorted.slice(5).reduce((s, x) => s + x.amount, 0)
    return [...head, { label: '그 외', amount: rest }]
  })()

  if (total <= 0) {
    return <div className="empty">아직 공금 지출이 없어요.</div>
  }

  // conic-gradient 로 원판을 그린다. SVG 보다 짧고 반응형에 강하다.
  // 렌더 중 변수를 다시 대입하지 않도록 누적값을 reduce 로 만든다.
  const withPct = shown.reduce<{ label: string; amount: number; pct: number; color: string; from: number }[]>(
    (acc, s, i) => {
      const pct = (s.amount / total) * 100
      // 앞쪽(큰 조각)일수록 진하게. 0.92 -> 0.28 사이로 떨어뜨린다.
      const alpha = 0.92 - (i / Math.max(1, shown.length - 1)) * 0.64
      const color = `color-mix(in srgb, var(--jade) ${Math.round(alpha * 100)}%, var(--card))`
      const from = acc.length ? acc[acc.length - 1].from + acc[acc.length - 1].pct : 0
      acc.push({ ...s, pct, color, from })
      return acc
    },
    [],
  )
  const stops = withPct.map((s) => `${s.color} ${s.from}% ${s.from + s.pct}%`)

  return (
    <div className="pie-wrap">
      <div
        className="pie"
        style={{ background: `conic-gradient(${stops.join(', ')})` }}
        role="img"
        aria-label={`카테고리별 공금 지출. ${withPct.map((s) => `${s.label} ${s.pct.toFixed(0)}퍼센트`).join(', ')}`}
      >
        <div className="pie-hole">
          <span className="pie-total">{won(total)}</span>
          <span className="pie-cap">공금 지출</span>
        </div>
      </div>

      <ul className="pie-legend">
        {withPct.map((s) => (
          <li key={s.label}>
            <i style={{ background: s.color }} aria-hidden="true" />
            <span className="l">{s.label}</span>
            <span className="p">{s.pct.toFixed(1)}%</span>
            <span className="a">{won(s.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
