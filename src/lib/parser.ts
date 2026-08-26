import { guessCategory } from './categories'

export interface ParsedEntry {
  title: string
  category: string
  personName: string | null
  date: string | null
  amount: number
  currency: 'KRW' | 'CNY'
}

const KRW_UNITS = ['원', '₩', 'won', 'krw']
const AMOUNT_RE = /(\d[\d,]*(?:\.\d+)?)\s*(원|₩|won|krw|위안|元|rmb|cny|yuan|块|콰이)?/i
const DATE_RE = /(?:^|\s)(\d{1,2})[/.\-](\d{1,2})(?=\s)/

export function parseLine(raw: string, memberNames: string[], year: string): ParsedEntry | null {
  let s = ` ${raw.trim()} `
  if (!s.trim()) return null

  let personName: string | null = null
  for (const name of memberNames) {
    if (s.includes(name)) {
      personName = name
      s = s.split(name).join(' ')
    }
  }

  let date: string | null = null
  const dm = s.match(DATE_RE)
  if (dm) {
    date = `${year}-${dm[1].padStart(2, '0')}-${dm[2].padStart(2, '0')}`
    s = s.replace(dm[0], ' ')
  }

  const am = s.match(AMOUNT_RE)
  if (!am) return null
  const amount = parseFloat(am[1].replace(/,/g, ''))
  if (!(amount > 0)) return null
  const unit = (am[2] || '').toLowerCase()
  const isKRW = KRW_UNITS.includes(unit) || (!unit && amount >= 10000)
  s = s.replace(am[0], ' ')

  return {
    title: s.replace(/\s+/g, ' ').trim() || '지출',
    category: guessCategory(raw),
    personName,
    date,
    amount,
    currency: isKRW ? 'KRW' : 'CNY',
  }
}

export function parseText(text: string, memberNames: string[], year: string): ParsedEntry[] {
  return text
    .split('\n')
    .map((line) => parseLine(line, memberNames, year))
    .filter((p): p is ParsedEntry => p !== null)
}
