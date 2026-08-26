export const PAYMENT_METHODS = [
  { code: 'cash', label: '현금' },
  { code: 'credit', label: '신용카드' },
  { code: 'travel', label: '트래블카드' },
] as const

/** DB의 entries_payment_method_check 제약과 같은 값만 허용한다. */
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]['code']

export const DEFAULT_PAYMENT_METHOD: PaymentMethod = 'cash'

const LABELS = new Map<string, string>(PAYMENT_METHODS.map((m) => [m.code, m.label]))

/** `cash` → `현금`. 모르는 값이 오면 코드를 그대로 보여준다. */
export function paymentLabel(code: string | null | undefined): string {
  if (!code) return '현금'
  return LABELS.get(code) ?? code
}

export function isPaymentMethod(v: string | null | undefined): v is PaymentMethod {
  return !!v && LABELS.has(v)
}
