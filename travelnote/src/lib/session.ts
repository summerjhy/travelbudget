const NOTE_CODE_KEY = 'travelnote.noteCode'
const PERSON_NAME_KEY = 'travelnote.personName'

export function getStoredNoteCode(): string | null {
  return localStorage.getItem(NOTE_CODE_KEY)
}

export function setStoredNoteCode(code: string) {
  localStorage.setItem(NOTE_CODE_KEY, code)
  localStorage.removeItem(PERSON_NAME_KEY)
}

export function clearStoredNoteCode() {
  localStorage.removeItem(NOTE_CODE_KEY)
  localStorage.removeItem(PERSON_NAME_KEY)
}

export function getStoredPersonName(): string | null {
  return localStorage.getItem(PERSON_NAME_KEY)
}

export function setStoredPersonName(name: string) {
  localStorage.setItem(PERSON_NAME_KEY, name)
}
