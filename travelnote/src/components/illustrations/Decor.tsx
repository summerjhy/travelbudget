interface DecorProps {
  size?: number
  className?: string
  style?: React.CSSProperties
}

/** .design/sample 배경에 흩뿌려진 별/구름/하트 장식. 카드 모서리 장식용. */
export function Star({ size = 20, className, style }: DecorProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} style={style} aria-hidden="true">
      <path d="M12 2 L14.5 9 L22 9 L16 13.5 L18 21 L12 16.5 L6 21 L8 13.5 L2 9 L9.5 9 Z" fill="#FDE68A" />
    </svg>
  )
}

export function Heart({ size = 18, className, style }: DecorProps) {
  return (
    <svg viewBox="0 0 24 22" width={size} height={size} className={className} style={style} aria-hidden="true">
      <path
        d="M12 20 C4 14 1 9.5 1 6.2 C1 2.8 3.6 1 6.3 1 C8.4 1 10.4 2.3 12 4.6 C13.6 2.3 15.6 1 17.7 1 C20.4 1 23 2.8 23 6.2 C23 9.5 20 14 12 20 Z"
        fill="#F4A4A0"
      />
    </svg>
  )
}

export function Cloud({ size = 40, className, style }: DecorProps) {
  return (
    <svg viewBox="0 0 60 34" width={size} height={size} className={className} style={style} aria-hidden="true">
      <path
        d="M14 28 Q2 28 2 18 Q2 9 12 9 Q14 1 24 1 Q34 1 36 9 Q46 8 48 17 Q58 17 58 26 Q58 30 52 30 L14 30 Z"
        fill="#FFFFFF"
      />
    </svg>
  )
}
