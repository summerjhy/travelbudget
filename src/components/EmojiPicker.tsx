import { MEMBER_EMOJIS } from '../lib/memberEmoji'

/**
 * 참여자 이모지 고르기.
 *
 * 안 고르는 것(빈 문자열)도 선택지로 둔다 — 이모지를 원치 않는 사람도 있고,
 * 한번 고른 뒤 지울 방법이 없으면 갇힌다.
 */
export function EmojiPicker({
  value,
  onChange,
  label = '이모지',
}: {
  value: string
  onChange: (emoji: string) => void
  label?: string
}) {
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
    </div>
  )
}
