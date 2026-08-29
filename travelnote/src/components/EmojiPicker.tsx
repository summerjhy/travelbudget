import { MEMBER_EMOJIS } from '../lib/memberEmoji'

/** 참여자 이모지 고르기. travelbudget의 동명 컴포넌트와 동일한 패턴. */
export function EmojiPicker({
  value,
  onChange,
  label = '이모지',
}: {
  value: string
  onChange: (emoji: string) => void
  label?: string
}) {
  const isCustom = value !== '' && !MEMBER_EMOJIS.includes(value as (typeof MEMBER_EMOJIS)[number])

  return (
    <div className="field">
      <label className="lab">{label}</label>
      <div className="emoji-grid">
        <button
          type="button"
          className={'emoji-cell' + (value === '' ? ' on' : '')}
          onClick={() => onChange('')}
          aria-pressed={value === ''}
          aria-label="이모지 없음"
          title="없음"
        >
          –
        </button>
        {MEMBER_EMOJIS.map((e) => (
          <button
            key={e}
            type="button"
            className={'emoji-cell' + (value === e ? ' on' : '')}
            onClick={() => onChange(e)}
            aria-pressed={value === e}
            aria-label={e}
          >
            {e}
          </button>
        ))}
      </div>

      <div className="row2" style={{ marginTop: 7, alignItems: 'center' }}>
        <input
          className="inp"
          maxLength={4}
          value={isCustom ? value : ''}
          placeholder="직접 입력 (키보드 이모지)"
          onChange={(e) => onChange(pickFirstEmoji(e.target.value))}
          style={{ flex: 1, fontSize: 16 }}
        />
        <span className="note" style={{ flex: '0 0 auto' }}>
          {value ? <span className="mname-emoji">{value}</span> : '없음'}
        </span>
      </div>
    </div>
  )
}

function pickFirstEmoji(raw: string): string {
  const s = raw.trim()
  if (!s) return ''
  try {
    const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    const first = [...seg.segment(s)][0]?.segment ?? ''
    return first
  } catch {
    return [...s][0] ?? ''
  }
}
