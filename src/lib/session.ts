const TRIP_CODE_KEY = 'travelbudget.tripCode'
const PERSON_NAME_KEY = 'travelbudget.personName'

export function getStoredTripCode(): string | null {
  return localStorage.getItem(TRIP_CODE_KEY)
}

export function setStoredTripCode(code: string) {
  localStorage.setItem(TRIP_CODE_KEY, code)
  localStorage.removeItem(PERSON_NAME_KEY)
}

export function clearStoredTripCode() {
  localStorage.removeItem(TRIP_CODE_KEY)
  localStorage.removeItem(PERSON_NAME_KEY)
}

export function getStoredPersonName(): string | null {
  return localStorage.getItem(PERSON_NAME_KEY)
}

export function setStoredPersonName(name: string) {
  localStorage.setItem(PERSON_NAME_KEY, name)
}

const CURRENCY_KEY = 'travelbudget.currency'

/**
 * 기록 탭에서 고른 통화. 여행별로 따로 기억해서, 바꾸기 전까지 계속 그 단위로 입력된다.
 */
export function getStoredCurrency(tripCode: string): string | null {
  return localStorage.getItem(`${CURRENCY_KEY}.${tripCode}`)
}

export function setStoredCurrency(tripCode: string, currency: string) {
  localStorage.setItem(`${CURRENCY_KEY}.${tripCode}`, currency)
}

const PAYMENT_KEY = 'travelbudget.payment'
const PAYER_KEY = 'travelbudget.payer'

/**
 * 기록 탭에서 고른 결제수단. 통화와 마찬가지로 여행별로 기억해서
 * 바꾸기 전까지 계속 그 수단으로 입력된다.
 */
export function getStoredPayment(tripCode: string): string | null {
  return localStorage.getItem(`${PAYMENT_KEY}.${tripCode}`)
}

export function setStoredPayment(tripCode: string, method: string) {
  localStorage.setItem(`${PAYMENT_KEY}.${tripCode}`, method)
}

/** 기록 탭에서 고른 결제자(trip_members.id). 기본값은 본인. */
export function getStoredPayer(tripCode: string): string | null {
  return localStorage.getItem(`${PAYER_KEY}.${tripCode}`)
}

export function setStoredPayer(tripCode: string, memberId: string) {
  localStorage.setItem(`${PAYER_KEY}.${tripCode}`, memberId)
}
