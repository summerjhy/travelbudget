interface Props {
  size?: number
  pose?: 'wave' | 'peek' | 'wink' | 'love'
  className?: string
}

/**
 * .design/sample 레퍼런스(통통한 핑크 토끼, 점 눈 + 단순한 입)를 참고해
 * 그린 캐릭터. 팔을 넣었더니 얼굴 옆에 붕 뜬 이상한 덩어리처럼 보여서
 * (사용자 피드백) 전부 제거하고 얼굴만 남긴 단순한 형태로 다시 그렸다.
 * 포즈는 표정(눈/입)만으로 구분한다.
 */
export function Bunny({ size = 96, pose = 'wave', className }: Props) {
  return (
    <svg viewBox="0 0 120 130" width={size} height={size} className={className} aria-hidden="true">
      {/* 귀 */}
      <ellipse cx="42" cy="26" rx="13" ry="28" fill="#F4A4A0" transform="rotate(-16 42 26)" />
      <ellipse cx="78" cy="26" rx="13" ry="28" fill="#F4A4A0" transform="rotate(16 78 26)" />
      <ellipse cx="42" cy="30" rx="6.5" ry="17" fill="#FCE4E2" transform="rotate(-16 42 30)" />
      <ellipse cx="78" cy="30" rx="6.5" ry="17" fill="#FCE4E2" transform="rotate(16 78 30)" />

      {/* 얼굴 */}
      <circle cx="60" cy="78" r="42" fill="#F4A4A0" />

      {/* 볼터치 */}
      <circle cx="34" cy="86" r="7" fill="#FCE4E2" />
      <circle cx="86" cy="86" r="7" fill="#FCE4E2" />

      {/* 눈/입 — 포즈별 표정만 다르다 */}
      {pose === 'wink' ? (
        <>
          <circle cx="48" cy="76" r="4.5" fill="#4A3728" />
          <path d="M68 74 q6 4 0 6" stroke="#4A3728" strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="48" cy="76" r="4.5" fill="#4A3728" />
          <circle cx="72" cy="76" r="4.5" fill="#4A3728" />
        </>
      )}
      {pose === 'love' ? (
        <path d="M50 90 q10 10 20 0" stroke="#4A3728" strokeWidth="3" fill="none" strokeLinecap="round" />
      ) : (
        <path d="M54 90 q6 5 12 0" stroke="#4A3728" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      )}
    </svg>
  )
}
