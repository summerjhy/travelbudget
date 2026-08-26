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
