/**
 * 참여자 이름 표시. 이모지가 있으면 정사각 배경 박스에 담아 앞에 붙인다.
 *
 * 문자열로 이어붙이면(`🐰 혜연`) 이모지가 본문 크기라 눈에 안 띈다.
 * 배경을 깔고 살짝 키워야 사람을 한눈에 구분할 수 있다.
 *
 * 문자열이 필요한 자리(confirm 메시지, join 으로 잇는 목록)는 여전히
 * MemberWithName.displayName 을 쓴다.
 */
export function MemberName({
  emoji,
  name,
  className,
}: {
  emoji: string | null | undefined
  name: string
  className?: string
}) {
  if (!emoji) return <>{name}</>
  return (
    <span className={'mname' + (className ? ' ' + className : '')}>
      <span className="mname-emoji" aria-hidden="true">{emoji}</span>
      {name}
    </span>
  )
}
