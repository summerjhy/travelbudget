import { CONTINENTS } from './destinations'
import type { Trip } from './types'

/**
 * "오늘이 며칠인가" 는 여행 목적지의 시간대로 판정한다.
 *
 * 기기 로컬 시간대를 쓰면 사람마다 다른 날짜가 찍힌다 — 누구는 폰을 현지로
 * 바꾸고 누구는 한국 그대로라 같은 저녁 식사가 다른 날로 갈린다.
 * 한국 시각 고정도 답이 아니다. 멕시코(KST-15h)에서 현지 점심에 기록하면
 * 한국은 이미 다음 날이라 여행 첫날 지출이 둘째 날로 넘어간다.
 *
 * 목적지 시간대로 맞추면 "현지에서 점심 먹은 날 = 그 날짜" 가 항상 성립하고,
 * 4명이 각자 어느 폰으로 넣든 같은 날짜가 나온다.
 *
 * 여행 시작일·종료일은 사람이 <input type="date"> 로 고르는 고정 문자열이라
 * 시간대와 무관하다. 여기서 다루는 건 자동으로 찍히는 "오늘" 뿐이다.
 */

/** 목적지 문자열("대만 가오슝")에서 나라를 떼어내 시간대를 찾는다. */
const TZ_BY_COUNTRY = new Map<string, string>(
  CONTINENTS.flatMap((c) => c.countries.map((k) => [k.name, k.tz] as [string, string])),
)

/** 국내 여행이거나 목적지를 못 알아볼 때 쓰는 기본값. */
export const FALLBACK_TZ = 'Asia/Seoul'

/**
 * 이 여행의 기준 시간대.
 * 목적지가 여러 곳이면 첫 번째를 쓴다 — 대개 같은 나라이고, 달라도
 * 한 여행 안에서 날짜 기준이 오락가락하는 것보다 하나로 고정하는 게 낫다.
 */
export function tripTimeZone(trip: Trip | null | undefined): string {
  for (const dest of trip?.destinations ?? []) {
    // "대만 가오슝" 처럼 "나라 도시" 형식이라 앞에서부터 나라를 찾는다.
    for (const [country, tz] of TZ_BY_COUNTRY) {
      if (dest === country || dest.startsWith(country + ' ')) return tz
    }
  }
  return FALLBACK_TZ
}

/** 어떤 시각을 그 시간대의 날짜(YYYY-MM-DD)로 바꾼다. */
export function dateInZone(d: Date, tz: string): string {
  // en-CA 로케일이 YYYY-MM-DD 를 그대로 준다.
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d)
  } catch {
    // 알 수 없는 존 이름이면 한국 기준으로 떨어진다.
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: FALLBACK_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d)
  }
}

/** 이 여행 기준 오늘 (YYYY-MM-DD). */
export function todayForTrip(trip: Trip | null | undefined): string {
  return dateInZone(new Date(), tripTimeZone(trip))
}

/** 이 여행 기준 올해 (YYYY). 날짜 없는 입력의 연도 추정에 쓴다. */
export function yearForTrip(trip: Trip | null | undefined): string {
  return todayForTrip(trip).slice(0, 4)
}

/** 여행이 지금 어느 단계인지. 홈 화면 그룹과 D-day 표시에 쓴다. */
export type TripPhase = 'ongoing' | 'upcoming' | 'ended'

export function tripPhaseOf(
  start: string,
  end: string | null,
  today: string,
): TripPhase {
  if (today < start) return 'upcoming'
  if (today > (end ?? start)) return 'ended'
  return 'ongoing'
}

/** 목적지 문자열 목록에서 시간대를 찾는다. 여행을 만들 때 tz 를 정하는 데 쓴다. */
export function tzOfFirstDestination(destinations: string[]): string {
  for (const dest of destinations) {
    for (const [country, tz] of TZ_BY_COUNTRY) {
      if (dest === country || dest.startsWith(country + ' ')) return tz
    }
  }
  return FALLBACK_TZ
}
