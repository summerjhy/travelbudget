interface Props {
  size?: number
  className?: string
}

/** .design/sample의 갈색 다람쥐 콤비 참고. Bunny와 짝을 이뤄 "함께" 장면에 쓴다. */
export function Squirrel({ size = 80, className }: Props) {
  return (
    <svg viewBox="0 0 110 130" width={size} height={size} className={className} aria-hidden="true">
      {/* 꼬리 */}
      <path
        d="M88 90 q30 -6 22 -46 q-6 -22 -28 -14 q14 8 8 24 q10 -2 10 16 q0 14 -12 20 z"
        fill="#C99A6B"
      />
      {/* 귀 */}
      <circle cx="38" cy="34" r="10" fill="#C99A6B" />
      <circle cx="62" cy="34" r="10" fill="#C99A6B" />
      <circle cx="38" cy="35" r="5" fill="#EAD3B6" />
      <circle cx="62" cy="35" r="5" fill="#EAD3B6" />

      {/* 얼굴/몸통 */}
      <circle cx="50" cy="74" r="36" fill="#C99A6B" />
      <ellipse cx="50" cy="84" rx="20" ry="17" fill="#EAD3B6" />

      {/* 눈/코 */}
      <circle cx="40" cy="70" r="4" fill="#4A3728" />
      <circle cx="60" cy="70" r="4" fill="#4A3728" />
      <ellipse cx="50" cy="80" rx="3.5" ry="2.6" fill="#4A3728" />
    </svg>
  )
}
