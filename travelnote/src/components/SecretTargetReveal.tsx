import { useState } from 'react'

/**
 * 비밀친구 이름을 "누르고 있는 동안만" 보여준다.
 *
 * 탭 한 번으로 켜고 끄는 방식은 옆 사람이 화면을 보고 있을 때 실수로
 * 노출될 위험이 있다 — 버스나 숙소에서 다른 참여자가 지나가다 볼 수
 * 있다는 실제 사용 중 피드백으로 누르는 동안만(mouse/touch down~up) 보이게
 * 바꿨다. 손을 떼거나 손가락이 버튼 밖으로 나가면 즉시 다시 가려진다.
 */
export function SecretTargetReveal({ name }: { name: string }) {
  const [revealed, setRevealed] = useState(false)

  function show() {
    setRevealed(true)
  }
  function hide() {
    setRevealed(false)
  }

  return (
    <button
      type="button"
      className="reveal-btn"
      onMouseDown={show}
      onMouseUp={hide}
      onMouseLeave={hide}
      onTouchStart={show}
      onTouchEnd={hide}
      onTouchCancel={hide}
      onContextMenu={(e) => e.preventDefault()}
    >
      {revealed ? (
        <span className="reveal-name">{name}</span>
      ) : (
        <span className="reveal-hidden">👀 눌러서 확인하기 (손 떼면 다시 가려져요)</span>
      )}
    </button>
  )
}
