import { useState } from 'react'
import type { Trip } from '../lib/types'

/**
 * 여행 가계부 링크 공유.
 *
 * 참여 코드를 같이 담는다 — 링크만으로는 들어갈 수 없고 코드가 있어야 하므로,
 * 받는 사람이 두 개를 따로 챙기지 않아도 되게 한 문장으로 묶는다.
 * (코드를 아는 사람만 접근 가능하다는 보안 모델은 그대로다. 링크에 코드를
 *  넣는 게 아니라 안내 문구에 적는 것뿐이다.)
 *
 * navigator.share -> 클립보드 -> 직접 복사 순으로 내려간다. 데스크톱 브라우저는
 * 공유 시트가 없고, 클립보드도 권한이나 보안 컨텍스트에 따라 막힐 수 있다.
 */
export function ShareTripButton({ trip }: { trip: Trip }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [fallback, setFallback] = useState<string | null>(null)

  const url = window.location.origin + '/'
  const text = [
    `${trip.name} 가계부에 초대합니다.`,
    '',
    `1. ${url} 접속`,
    `2. 참여 코드 ${trip.code} 입력`,
    '3. 이름을 적으면 바로 시작',
  ].join('\n')

  async function share() {
    setBusy(true)
    setMessage(null)
    setFallback(null)

    // 공유 시트가 있으면 그게 가장 자연스럽다 (카톡으로 바로 보낼 수 있다).
    if (navigator.share) {
      try {
        await navigator.share({ title: `${trip.name} 가계부`, text, url })
        setBusy(false)
        return
      } catch (err) {
        // 사용자가 시트를 닫은 것뿐이면 다른 경로로 넘어가지 않는다.
        if (err instanceof DOMException && err.name === 'AbortError') {
          setBusy(false)
          return
        }
      }
    }

    try {
      await navigator.clipboard.writeText(text)
      setMessage('초대 문구를 복사했어요. 카톡에 붙여넣으세요.')
    } catch {
      setMessage('아래 내용을 복사해서 보내주세요.')
      setFallback(text)
    }
    setBusy(false)
  }

  return (
    <>
      <button className="btn ghost" onClick={share} disabled={busy}>
        📮 여행 가계부 공유하기
      </button>
      <p className="note" style={{ marginTop: 9 }}>
        링크와 참여 코드({trip.code})를 함께 보내요. 코드를 아는 사람만 들어올 수 있어요.
      </p>
      {message && <p className="note" style={{ marginTop: 7, color: 'var(--jade)' }}>{message}</p>}
      {fallback && (
        <textarea
          className="ta"
          readOnly
          value={fallback}
          onFocus={(e) => e.currentTarget.select()}
          style={{ marginTop: 9, minHeight: 116, fontSize: 14 }}
        />
      )}
    </>
  )
}
