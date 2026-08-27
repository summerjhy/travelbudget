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

/**
 * 배수 표기. "180만" -> 1,800,000, "3만엔" -> 30000 JPY 처럼 읽는다.
 * 통화와 무관하게 붙으므로 외화에도 그대로 적용된다.
 *
 * 억은 일부러 넣지 않는다. 여행 지출에 억 단위가 나올 일은 없는데,
 * "1억뷰 카페" 처럼 숫자+억 으로 시작하는 상호명이 오히려 흔해서
 * 得보다 失이 크다.
 */
const SCALES: [string, number][] = [
  ['만', 10000],
  ['천', 1000],
]

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function amountRe(config: ParserConfig): RegExp {
  const units = Array.from(config.unitMap.keys())
    .sort((a, b) => b.length - a.length) // 긴 표기부터. 'nt$' 가 '$' 에 먹히면 안 된다
    .map(escapeRe)
    .join('|')
  const scales = SCALES.map(([w]) => w).join('|')
  // 숫자 - (배수) - (통화 단위). "180만원" 처럼 배수와 단위가 같이 올 수 있다.
  return new RegExp(`(\\d[\\d,]*(?:\\.\\d+)?)\\s*(${scales})?\\s*(${units})?`, 'i')
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
  const base = parseFloat(am[1].replace(/,/g, ''))
  if (!(base > 0)) return null
  const scale = SCALES.find(([w]) => w === am[2])?.[1] ?? 1
  // 1.5만 같은 소수 배수도 자연스럽게 떨어지도록 반올림한다.
  const amount = scale === 1 ? base : Math.round(base * scale)
  const unit = (am[3] || '').toLowerCase()
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
