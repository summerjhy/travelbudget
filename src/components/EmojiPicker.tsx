import { MEMBER_EMOJIS } from '../lib/memberEmoji'

/**
 * 참여자 이모지 고르기.
 *
 * 목록에서 고르거나 직접 입력할 수 있다. 목록만 두면 원하는 게 없을 때
 * 갇히고, 입력칸만 두면 데스크톱에서 이모지를 넣기가 번거롭다.
 *
 * 안 고르는 것(빈 문자열)도 선택지로 둔다 — 한번 고른 뒤 지울 방법이
 * 없으면 곤란하다.
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
  // 목록에 없는 걸 직접 넣었는지 — 그러면 입력칸에 그 값을 보여준다.
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
          // 이모지 하나만 받는다. 여러 글자를 넣으면 이름이 밀려 레이아웃이 깨진다.
          maxLength={4}
          value={isCustom ? value : ''}
          placeholder="직접 입력 (키보드 이모지)"
          onChange={(e) => onChange(pickFirstEmoji(e.target.value))}
          style={{ flex: 1, fontSize: 15 }}
        />
        <span className="note" style={{ flex: '0 0 auto' }}>
          {value ? <span className="mname-emoji">{value}</span> : '없음'}
        </span>
      </div>
    </div>
  )
}

/**
 * 입력값에서 이모지 하나만 남긴다.
 *
 * 사람이 붙여넣기로 여러 개를 넣거나 글자를 섞어 넣을 수 있다.
 * Intl.Segmenter 로 자소 단위를 끊어 첫 덩어리만 쓴다 — 국기나 피부색
 * 같은 결합 이모지도 한 글자로 세어야 하기 때문이다.
 */
function pickFirstEmoji(raw: string): string {
  const s = raw.trim()
  if (!s) return ''
  try {
    const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    const first = [...seg.segment(s)][0]?.segment ?? ''
    return first
  } catch {
    // Segmenter 가 없는 구형 브라우저 — 코드포인트 단위로 자른다.
    return [...s][0] ?? ''
  }
}
