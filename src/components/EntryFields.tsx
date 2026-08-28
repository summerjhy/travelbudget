import { CATEGORY_NAMES, categoryChip } from '../lib/categories'
import { currencyChip, currencyLabel, currencyNeedsSpace, currencySuffix } from '../lib/currencies'
import { formatAmountInput, stripAmountInput } from '../lib/format'
import { BASE_CURRENCY } from '../lib/tripCurrency'
import { PAYMENT_METHODS, paymentChip } from '../lib/payment'
import type { MemberWithName } from '../lib/useTripMembers'

export interface EntryFieldsValue {
  category: string
  currency: string
  /** 외화 금액 입력칸 문자열. currency 가 KRW 면 안 쓴다. */
  cny: string
  krw: string
  /** 비어 있으면 저장할 때 금액으로 다시 계산한다. */
  rate: string
  paymentMethod: string
  paidBy: string | null
  /** 비용 구분(회계 귀속). null 이면 공금. */
  memberId: string | null
  date: string
  /** HH:MM. 빈 문자열이면 시각 없이 저장한다. */
  time: string
}

/**
 * 기록 탭의 저장 전 미리보기 카드와 내역 탭의 수정 카드가 똑같이 쓰는
 * 필드 묶음. 두 화면에서 손 감각이 갈리지 않도록 통화·금액·환율·분류·
 * 결제수단·결제자·비용구분·날짜/시각을 여기 한 곳에서만 그린다.
 *
 * 카테고리·결제수단·결제자·비용구분은 이미 파싱/기본값으로 골라져
 * 있는 상태라, 전체 선택지를 칩으로 다 펼쳐 보일 필요가 없다 — 지금
 * 고른 값만 드롭다운으로 보여주고 필요할 때만 바꾼다. 여러 건을 한
 * 화면에서 검토할 때(미리보기) 카드 하나가 화면을 다 차지하던 문제를
 * 이렇게 줄인다. 통화는 보통 1~2개뿐이라 칩으로 그대로 둔다.
 *
 * 제목 입력칸과 화면별로 다른 하단 버튼(빼기 vs 삭제/취소/저장)은
 * 이 컴포넌트 바깥, 각 페이지에서 그린다 — 의미가 서로 다르기 때문이다.
 */
export function EntryFields({
  value,
  onChange,
  currencies,
  members,
  onRecalcRate,
  emptyRateHint,
}: {
  value: EntryFieldsValue
  onChange: (patch: Partial<EntryFieldsValue>) => void
  currencies: string[]
  members: MemberWithName[]
  onRecalcRate: () => void
  emptyRateHint: string
}) {
  const impliedRate =
    parseFloat(value.krw) > 0 && parseFloat(value.cny) > 0
      ? parseFloat(value.krw) / parseFloat(value.cny)
      : null
  const isForeign = value.currency !== BASE_CURRENCY

  return (
    <>
      {currencies.length > 1 && (
        <div className="chips" style={{ marginBottom: 8 }}>
          <span className="deflab">💱 입력 단위</span>
          {currencies.map((c) => (
            <button
              key={c}
              className={'chip' + (value.currency === c ? ' on' : '')}
              onClick={() => onChange({ currency: c })}
              title={currencyLabel(c)}
            >
              {currencyChip(c)}
            </button>
          ))}
        </div>
      )}

      <div className="money">
        {isForeign && (
          <label>
            <input
              inputMode="decimal"
              value={formatAmountInput(value.cny)}
              onChange={(ev) => onChange({ cny: stripAmountInput(ev.target.value) })}
              // 통화 기호가 없어 코드(USD, TWD 등 3글자)를 그대로 보여줄 때는
              // 기본 30px 여백으로 부족해 숫자와 글자가 겹친다.
              style={currencyNeedsSpace(value.currency) ? { paddingRight: 52 } : undefined}
            />
            <span>{currencySuffix(value.currency)}</span>
          </label>
        )}
        <label>
          <input
            inputMode="numeric"
            value={formatAmountInput(value.krw)}
            onChange={(ev) => onChange({ krw: stripAmountInput(ev.target.value) })}
          />
          <span>원</span>
        </label>
      </div>

      {isForeign && (
        <>
          <div className="money">
            <label>
              <input
                inputMode="decimal"
                value={formatAmountInput(value.rate)}
                placeholder="환율"
                onChange={(ev) => onChange({ rate: stripAmountInput(ev.target.value) })}
                // "원/CNY" 처럼 접미사가 길어서 기본 30px 여백으로는 숫자와 겹친다.
                style={{ paddingRight: 64 }}
              />
              <span>원/{value.currency}</span>
            </label>
            <button className="btn ghost sm" style={{ width: 'auto', flexShrink: 0 }} onClick={onRecalcRate}>
              이 날짜 환율로
            </button>
          </div>
          <p className="note" style={{ margin: '0 0 9px' }}>
            {impliedRate
              ? `적용환율 ${impliedRate.toFixed(2)} · 외화·원화를 둘 다 채우면 실제 청구 환율로 잡혀요`
              : emptyRateHint}
          </p>
        </>
      )}

      <div className="fieldrow">
        <span className="deflab">🗂️ 카테고리</span>
        <select className="inp sel" value={value.category} onChange={(ev) => onChange({ category: ev.target.value })}>
          {CATEGORY_NAMES.map((c) => (
            <option key={c} value={c}>{categoryChip(c)}</option>
          ))}
        </select>
      </div>

      <div className="fieldrow">
        <span className="deflab">💳 결제 수단</span>
        <select
          className="inp sel"
          value={value.paymentMethod}
          onChange={(ev) => onChange({ paymentMethod: ev.target.value })}
        >
          {PAYMENT_METHODS.map((m) => (
            <option key={m.code} value={m.code}>{paymentChip(m.code)}</option>
          ))}
        </select>
      </div>

      {members.length > 0 && (
        <>
          <div className="fieldrow">
            <span className="deflab">🙋 결제자</span>
            <select
              className="inp sel"
              value={value.paidBy ?? ''}
              onChange={(ev) => onChange({ paidBy: ev.target.value || null })}
            >
              <option value="">미지정</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.emoji ? `${m.emoji} ${m.personName}` : m.personName}</option>
              ))}
            </select>
          </div>

          <div className="fieldrow">
            <span className="deflab">🏷️ 비용 구분</span>
            <select
              className="inp sel"
              value={value.memberId ?? ''}
              onChange={(ev) => onChange({ memberId: ev.target.value || null })}
            >
              <option value="">공금</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.personName}</option>
              ))}
            </select>
          </div>
        </>
      )}

      <div className="editrow">
        <input className="inp" type="date" value={value.date} onChange={(ev) => onChange({ date: ev.target.value })} style={{ flex: 1 }} />
        <input className="inp" type="time" value={value.time} onChange={(ev) => onChange({ time: ev.target.value })} style={{ flex: '0 0 40%' }} />
      </div>
    </>
  )
}
