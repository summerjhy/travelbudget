interface Props {
  size?: number
  pose?: 'wave' | 'peek' | 'wink' | 'love'
  className?: string
}

/**
 * .design/sample 레퍼런스(통통한 핑크 토끼, 점 눈 + 단순한 입, 손동작으로
 * 감정 표현)를 참고해 새로 그린 캐릭터. 포즈별로 팔/눈 모양만 바꾼 변형.
 * viewBox는 팔이 뻗어나가는 여유분(좌우 상하 20px씩)까지 포함해 잡았다 —
 * 처음엔 몸통 기준으로만 잡아 wave/love 포즈의 팔 끝이 잘렸었다.
 */
export function Bunny({ size = 96, pose = 'wave', className }: Props) {
  return (
    <svg viewBox="-10 0 140 130" width={size} height={size} className={className} aria-hidden="true">
      {/* 귀 */}
      <ellipse cx="42" cy="26" rx="13" ry="28" fill="#F4A4A0" transform="rotate(-16 42 26)" />
      <ellipse cx="78" cy="26" rx="13" ry="28" fill="#F4A4A0" transform="rotate(16 78 26)" />
      <ellipse cx="42" cy="30" rx="6.5" ry="17" fill="#FCE4E2" transform="rotate(-16 42 30)" />
      <ellipse cx="78" cy="30" rx="6.5" ry="17" fill="#FCE4E2" transform="rotate(16 78 30)" />

      {/* 몸통/얼굴 */}
      <circle cx="60" cy="78" r="42" fill="#F4A4A0" />

      {/* 볼터치 */}
      <circle cx="34" cy="86" r="7" fill="#FCE4E2" />
      <circle cx="86" cy="86" r="7" fill="#FCE4E2" />

      {/* 눈/입 — 포즈별 */}
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
        <path d="M52 92 q8 8 16 0" stroke="#4A3728" strokeWidth="3" fill="none" strokeLinecap="round" />
      ) : (
        <path d="M54 90 q6 5 12 0" stroke="#4A3728" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      )}

      {/* 팔 — 몸통(반지름 42, 중심 60,78) 가장자리 바깥에서 시작해 확실히 보이게 한다 */}
      {pose === 'wave' && (
        <path d="M96 82 Q118 78 112 52" stroke="#F4A4A0" strokeWidth="13" fill="none" strokeLinecap="round" />
      )}
      {pose === 'peek' && (
        <path d="M24 82 Q2 78 8 106" stroke="#F4A4A0" strokeWidth="13" fill="none" strokeLinecap="round" />
      )}
      {pose === 'love' && (
        <>
          <path d="M30 92 Q46 118 66 108" stroke="#F4A4A0" strokeWidth="12" fill="none" strokeLinecap="round" />
          <path d="M90 92 Q74 118 54 108" stroke="#F4A4A0" strokeWidth="12" fill="none" strokeLinecap="round" />
        </>
      )}
    </svg>
  )
}
