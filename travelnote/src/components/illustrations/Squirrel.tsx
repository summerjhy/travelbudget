interface Props {
  size?: number
  className?: string
}

/**
 * .design/sample의 갈색 다람쥐 참고. 처음엔 꼬리+몸통까지 그렸더니 얼굴
 * 옆에 그림자처럼 걸쳐 보인다는 피드백이 있어(Bunny의 팔과 같은 문제)
 * 꼬리/몸통을 없애고 얼굴만 남긴 단순한 형태로 다시 그렸다.
 */
export function Squirrel({ size = 80, className }: Props) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-hidden="true">
      {/* 귀 */}
      <circle cx="30" cy="26" r="11" fill="#C99A6B" />
      <circle cx="70" cy="26" r="11" fill="#C99A6B" />
      <circle cx="30" cy="27" r="5.5" fill="#EAD3B6" />
      <circle cx="70" cy="27" r="5.5" fill="#EAD3B6" />

      {/* 얼굴 */}
      <circle cx="50" cy="56" r="38" fill="#C99A6B" />
      <ellipse cx="50" cy="66" rx="21" ry="18" fill="#EAD3B6" />

      {/* 눈/코 */}
      <circle cx="39" cy="52" r="4.2" fill="#4A3728" />
      <circle cx="61" cy="52" r="4.2" fill="#4A3728" />
      <ellipse cx="50" cy="62" rx="3.6" ry="2.8" fill="#4A3728" />
    </svg>
  )
}
