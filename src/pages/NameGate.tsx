import { useState, type FormEvent } from 'react'
import { useTrip } from '../context/TripContext'
import { EmojiPicker } from '../components/EmojiPicker'
import { withEmoji } from '../lib/memberEmoji'

export function NameGate() {
  const { trip, setPersonName } = useTrip()
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const result = await setPersonName(name, emoji)
    setSubmitting(false)
    if (!result.ok) {
      setError(result.error ?? '등록에 실패했어요.')
    }
  }

  return (
    <div className="wrap">
      <header className="head">
        <div className="eyebrow">{trip?.name}</div>
        <h1 className="title">누구세용</h1>
      </header>
      <div className="pad">
        <form onSubmit={handleSubmit}>
          <div className="field" style={{ marginTop: 16 }}>
            <label className="lab" htmlFor="personName">이름 입력해주세요</label>
            <input
              id="personName"
              className="inp"
              maxLength={10}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 소영"
              autoFocus
            />
          </div>
          <EmojiPicker value={emoji} onChange={setEmoji} label="나를 표현하는 이모지를 선택해주세요" />

          {name.trim() && (
            <p className="note" style={{ margin: '-2px 0 11px' }}>
              이렇게 보여요 — <b>{withEmoji(emoji, name.trim())}</b>
            </p>
          )}

          <button className="btn" type="submit" disabled={submitting}>
            {submitting ? '등록 중...' : '시작하기'}
          </button>
        </form>
        {error && <p className="err">{error}</p>}
        <p className="note" style={{ marginTop: 16 }}>
          10자 이하로 입력해주세요. 한 번 등록하면 다음부터는 자동으로 기억해요.
          이모지는 안 골라도 되고, 나중에 설정 탭에서 바꿀 수 있어요.
        </p>
      </div>
    </div>
  )
}
