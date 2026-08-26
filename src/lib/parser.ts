import { guessCategory } from './categories'
import { currencySuffix } from './currencies'
import { BASE_CURRENCY } from './tripCurrency'

export interface ParsedEntry {
  title: string
  category: string
  personName: string | null
  date: string | null
  amount: number
  /** 실제 통화 코드. 단위를 안 적었으면 화면에서 고른 기본 통화가 들어온다. */
  currency: string
}

const KRW_UNITS = ['원', '₩', 'won', 'krw']

/** 통화별로 추가로 알아들을 표기. 코드와 기호는 아래에서 자동으로 넣는다. */
const EXTRA_ALIASES: Record<string, string[]> = {
  KRW: ['원', '₩', 'won'],
  CNY: ['위안', 'rmb', 'yuan', '块', '콰이'],
  JPY: ['엔', 'yen'],
  USD: ['달러', '불', 'dollar'],
  EUR: ['유로', 'euro'],
  TWD: ['대만달러', '대만 달러', 'nt$', 'ntd'],
  HKD: ['홍콩달러', '홍콩 달러', 'hk$'],
  THB: ['바트', 'baht'],
  VND: ['동', 'dong'],
  TRY: ['리라', 'lira'],
  GBP: ['파운드', 'pound'],
  SGD: ['싱가포르달러', 's$', 'sgd'],
  PHP: ['페소', 'peso'],
  IDR: ['루피아', 'rupiah'],
  INR: ['루피', 'rupee'],
  MYR: ['링깃', 'ringgit'],
  AUD: ['호주달러', 'a$'],
  CHF: ['프랑', 'franc'],
  MOP: ['파타카', 'pataca'],
  CAD: ['캐나다달러', 'c$'],
}

export interface ParserConfig {
  /** 표기 → 통화 코드. 긴 표기부터 매칭한다. */
  unitMap: Map<string, string>
  /** 단위를 안 적었을 때 쓸 통화. 화면의 통화 선택 버튼에서 고른 값. */
  defaultCurrency: string
}

/**
 * 그 여행에서 쓰는 통화들로 파서를 만든다.
 *
 * 단위를 적지 않은 숫자는 무조건 `defaultCurrency` 로 읽는다. 예전에는 "10000 넘으면
 * 원화" 같은 추정이 있었지만, 통화를 눈에 보이게 고르는 지금은 추정이 오히려 헷갈린다.
 */
export function parserConfig(currencies: string[], defaultCurrency: string): ParserConfig {
  const unitMap = new Map<string, string>()
  const add = (unit: string, code: string) => {
    const key = unit.toLowerCase().trim()
    if (key && !unitMap.has(key)) unitMap.set(key, code)
  }

  // 원화는 여행 설정과 무관하게 항상 알아듣는다 (해외에서도 원화로 긁는 건이 있다).
  for (const u of KRW_UNITS) add(u, BASE_CURRENCY)

  for (const code of currencies) {
    add(code, code)
    add(currencySuffix(code), code)
    for (const alias of EXTRA_ALIASES[code] ?? []) add(alias, code)
  }

  return { unitMap, defaultCurrency }
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function amountRe(config: ParserConfig): RegExp {
  const units = Array.from(config.unitMap.keys())
    .sort((a, b) => b.length - a.length) // 긴 표기부터. 'nt$' 가 '$' 에 먹히면 안 된다
    .map(escapeRe)
    .join('|')
  return new RegExp(`(\\d[\\d,]*(?:\\.\\d+)?)\\s*(${units})?`, 'i')
}

const DATE_RE = /(?:^|\s)(\d{1,2})[/.\-](\d{1,2})(?=\s)/

export function parseLine(
  raw: string,
  memberNames: string[],
  year: string,
  config: ParserConfig,
): ParsedEntry | null {
  let s = ` ${raw.trim()} `
  if (!s.trim()) return null

  let personName: string | null = null
  for (const name of memberNames) {
    // 빈 이름을 그냥 두면 s.includes('') 가 항상 참이라 split('') 로 글자가 다 쪼개진다.
    if (!name) continue
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

  const am = s.match(amountRe(config))
  if (!am) return null
  const amount = parseFloat(am[1].replace(/,/g, ''))
  if (!(amount > 0)) return null
  const unit = (am[2] || '').toLowerCase()
  const currency = unit ? config.unitMap.get(unit) ?? config.defaultCurrency : config.defaultCurrency
  s = s.replace(am[0], ' ')

  return {
    title: s.replace(/\s+/g, ' ').trim() || '지출',
    category: guessCategory(raw),
    personName,
    date,
    amount,
    currency,
  }
}

export function parseText(
  text: string,
  memberNames: string[],
  year: string,
  config: ParserConfig,
): ParsedEntry[] {
  return text
    .split('\n')
    .map((line) => parseLine(line, memberNames, year, config))
    .filter((p): p is ParsedEntry => p !== null)
}
