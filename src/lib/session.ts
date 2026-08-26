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
