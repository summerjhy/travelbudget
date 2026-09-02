import { currencyNeedsSpace, currencySuffix } from './currencies'

export function won(n: number | null | undefined): string {
  return '₩' + Math.round(n || 0).toLocaleString('ko-KR')
}

/**
 * 외화 금액. 통화 코드는 여행마다 다르므로(trips.spend_currencies) 반드시 넘겨야 한다.
 * `380元`, `380 TWD` 처럼 통화별 표기로 찍는다.
 */
export function foreign(n: number | null | undefined, code: string): string {
  const num = (Math.round((n || 0) * 100) / 100).toLocaleString('ko-KR', {
    maximumFractionDigits: 2,
  })
  return num + (currencyNeedsSpace(code) ? ' ' : '') + currencySuffix(code)
}

/**
 * 금액 입력칸에 보여줄 때 정수부에 천 단위 콤마를 넣는다. 타이핑 중이라
 * 소수점 이하는 손대지 않는다("205." 를 "205" 로 잘라버리면 입력이 막힌다).
 */
export function formatAmountInput(raw: string): string {
  if (!raw) return ''
  const negative = raw.startsWith('-')
  const body = negative ? raw.slice(1) : raw
  const dotIndex = body.indexOf('.')
  const intPart = dotIndex === -1 ? body : body.slice(0, dotIndex)
  const decPart = dotIndex === -1 ? null : body.slice(dotIndex + 1)
  const intDigits = intPart.replace(/[^\d]/g, '')
  const grouped = intDigits ? Number(intDigits).toLocaleString('ko-KR') : ''
  const decDigits = decPart === null ? '' : decPart.replace(/[^\d]/g, '')
  return (negative ? '-' : '') + grouped + (dotIndex === -1 ? '' : '.' + decDigits)
}

/** formatAmountInput 의 역변환. 콤마를 떼서 다시 순수 숫자 문자열로 만든다. */
export function stripAmountInput(formatted: string): string {
  return formatted.replace(/,/g, '')
}

/**
 * 받침 유무에 따라 조사를 골라 단어에 붙인다. "위안"+을/를 → "위안을",
 * "달러"+을/를 → "달러를". 한글이 아닌 문자로 끝나면(코드 등) 그냥 첫 조사를 쓴다.
 */
export function withJosa(word: string, withBatchim: string, withoutBatchim: string): string {
  const code = word.charCodeAt(word.length - 1) - 0xac00
  const hasBatchim = code >= 0 && code <= 11171 && code % 28 !== 0
  return `${word}${code >= 0 && code <= 11171 ? (hasBatchim ? withBatchim : withoutBatchim) : withBatchim}`
}
