import { useEffect, useState } from 'react'
import { useNote } from '../context/NoteContext'
import { deliverJournal } from '../lib/deliverJournal'
import { shareText } from '../lib/shareText'
import { useReceivedDelivery } from '../lib/useReceivedDelivery'
import { Bunny } from '../components/illustrations/Bunny'
import { Squirrel } from '../components/illustrations/Squirrel'
import { Heart, Star } from '../components/illustrations/Decor'

export function DeliverTab() {
  const { trip, member } = useNote()
  const { delivery, loading: receivedLoading } = useReceivedDelivery(trip?.id, member?.id)

  const [sending, setSending] = useState(false)
  const [sentText, setSentText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copyNotice, setCopyNotice] = useState<string | null>(null)
  const [checkedExisting, setCheckedExisting] = useState(false)

  // journal_deliveries는 RLS가 target_member_id 기준으로만 조회를 허용해서
  // (발송한 사람은 자기가 보낸 걸 다시 못 읽는다 — 그 정책은 "받은 사람만
  // 보임"을 위한 것) 새로고침하면 로컬 state가 날아간다. deliver-journal은
  // 이미 보낸 경우 재요청해도 부작용 없이(재발송 없이) 그때 텍스트를
  // alreadyDelivered:true로 돌려주므로, 마운트 시 한 번 불러 복원한다.
  useEffect(() => {
    if (!trip?.matched_at || !trip || !member) return
    deliverJournal(trip.code, member.id).then((result) => {
      if (result.ok && result.alreadyDelivered) setSentText(result.text)
      setCheckedExisting(true)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip?.id, member?.id])

  async function handleDeliver() {
    if (!trip || !member) return
    setSending(true)
    setError(null)
    const result = await deliverJournal(trip.code, member.id)
    setSending(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setSentText(result.text)
  }

  async function handleShare(text: string) {
    const result = await shareText(text)
    if (result.ok && result.method === 'clipboard') {
      setCopyNotice('클립보드에 복사했어요. 카톡에 붙여넣기 해주세요.')
    } else if (!result.ok) {
      setCopyNotice('공유에 실패했어요. 직접 복사해주세요.')
    }
  }

  if (!trip?.matched_at) {
    return (
      <section className="pad">
        <div className="empty">아직 제비뽑기 전이에요.</div>
      </section>
    )
  }

  if (!checkedExisting) {
    return (
      <section className="pad">
        <p className="note">불러오는 중...</p>
      </section>
    )
  }

  return (
    <section className="pad">
      <div className="sec first">💌 비밀친구에게 발송</div>
      {!sentText ? (
        <>
          <div className="secret-card">
            <Heart size={16} className="decor" style={{ left: 14, top: 14 }} />
            <Heart size={12} className="decor" style={{ right: 20, top: 24 }} />
            <Star size={16} className="decor" style={{ right: 12, bottom: 10 }} />
            <div className="illust">
              <Bunny size={92} pose="love" />
            </div>
            <p className="msg">준비됐다면 발송해보세요</p>
            <p className="note" style={{ marginTop: 8 }}>
              지금까지 쓴 메모 전체가 비밀친구에게 전달돼요. 한 번 발송하면 되돌릴 수 없어요.
            </p>
          </div>
          <button className="btn" onClick={handleDeliver} disabled={sending}>
            {sending ? '발송 중...' : '비밀친구에게 발송하기'}
          </button>
          {error && <p className="err">{error}</p>}
        </>
      ) : (
        <>
          <div className="box" style={{ padding: '13px 14px' }}>
            <p className="note" style={{ whiteSpace: 'pre-line', color: 'var(--ink)' }}>{sentText}</p>
          </div>
          <button className="btn sky" style={{ marginTop: 10 }} onClick={() => handleShare(sentText)}>
            📋 텍스트로 공유하기 (카톡용)
          </button>
          {copyNotice && <p className="note" style={{ marginTop: 8 }}>{copyNotice}</p>}
        </>
      )}

      <div className="sec">📬 내가 받은 관찰일지</div>
      {receivedLoading ? (
        <p className="note">불러오는 중...</p>
      ) : !delivery ? (
        <div className="empty">
          <Squirrel size={64} />
          <p style={{ marginTop: 8 }}>아직 받은 게 없어요. 비밀친구가 발송하면 여기에 나타나요.</p>
        </div>
      ) : (
        <div className="box" style={{ padding: '13px 14px' }}>
          <p className="note" style={{ whiteSpace: 'pre-line', color: 'var(--ink)' }}>{delivery.body}</p>
        </div>
      )}
      <div style={{ height: 20 }} />
    </section>
  )
}
