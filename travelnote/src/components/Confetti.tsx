const PIECES = [
  { color: '#F4A4A0', left: '8%', delay: '0s', duration: '1.1s', rotate: '20deg' },
  { color: '#FDE68A', left: '22%', delay: '.1s', duration: '1.3s', rotate: '-15deg' },
  { color: '#A8D8EA', left: '38%', delay: '.05s', duration: '1s', rotate: '30deg' },
  { color: '#F4A4A0', left: '55%', delay: '.15s', duration: '1.2s', rotate: '-25deg' },
  { color: '#FDE68A', left: '70%', delay: '.02s', duration: '1.05s', rotate: '10deg' },
  { color: '#A8D8EA', left: '84%', delay: '.12s', duration: '1.25s', rotate: '-20deg' },
  { color: '#F4A4A0', left: '15%', delay: '.2s', duration: '1.15s', rotate: '35deg' },
  { color: '#FDE68A', left: '46%', delay: '.08s', duration: '1.1s', rotate: '-10deg' },
  { color: '#A8D8EA', left: '63%', delay: '.18s', duration: '1.3s', rotate: '18deg' },
  { color: '#F4A4A0', left: '92%', delay: '.06s', duration: '1s', rotate: '-30deg' },
] as const

/** 팝업이 뜰 때 톡톡 터지는 색종이 효과. 짧게 한 번만 재생되고 반복하지 않는다. */
export function Confetti() {
  return (
    <div className="confetti-wrap" aria-hidden="true">
      {PIECES.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: p.left,
            background: p.color,
            animationDelay: p.delay,
            animationDuration: p.duration,
            // @ts-expect-error 커스텀 CSS 변수
            '--rot': p.rotate,
          }}
        />
      ))}
    </div>
  )
}
