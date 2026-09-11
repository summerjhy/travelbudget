export interface Trip {
  id: string
  code: string
  name: string
  start_date: string
  end_date: string | null
  destinations: string[]
  /** IANA 시간대. 목적지 나라에서 정해진다. '오늘' 판정 기준. */
  tz: string
  base_currency: string
  spend_currencies: string[]
  /** 모임통장(공금) 관리자. trip_members.id. 최종 정산 시 예산 잔여/초과분의 이체 방향 기준점. */
  treasurer_member_id: string | null
  created_at: string
}

export interface Person {
  id: string
  name: string
  created_at: string
}

export interface TripMember {
  id: string
  trip_id: string
  person_id: string
  /** 이름 앞에 붙는 이모지. 안 골랐으면 빈 문자열. */
  emoji: string
  active: boolean
  sort: number
  created_at: string
  person?: Person
}

export interface Budget {
  id: string
  trip_id: string
  date: string
  /**
   * 원화 환산액. prepaid 면 original_amount * rate 로 고정된 값이고,
   * 아니면 입력 당시 시세로 계산한 참고용 스냅샷이라 화면에서는 그날 시세로 다시 환산한다.
   */
  amount: number
  /** 입력할 때 쓴 통화. 예전 행과 원화 입력은 KRW. */
  currency: string
  /** 입력한 그대로의 외화 금액. 원화로 넣었으면 null. */
  original_amount: number | null
  /** 환전 시점 환율(1 currency 당 원화). prepaid 가 아니면 null 이고 그날 시세를 쓴다. */
  rate: number | null
  /**
   * 외화 예산일 때만 의미가 있다.
   * true  = 미리 환전해둔 돈. 지갑의 외화도, 치른 원화도 시세와 무관하게 고정.
   * false = 실시간 환율로 결제되는 한도. 외화 금액만 고정이고 원화는 시세를 따라간다.
   * 예전 행은 null 로 올 수 있고 그때는 true(환전해둔 것)로 읽는다.
   */
  prepaid: boolean | null
  memo: string | null
  created_at: string
}

export interface Entry {
  id: string
  trip_id: string
  date: string
  title: string
  category: string
  member_id: string | null
  krw: number
  /** 외화 금액. 어느 통화인지는 currency 를 봐야 한다 (마이그레이션 0003 주석 참고). */
  cny: number
  /** cny 의 통화 코드. 예전 행은 null 로 올 수 있고 그때는 CNY 다. */
  currency: string | null
  /** 1 currency 당 원화. 저장 당시 값으로 고정된다 (설정에서 환율을 고쳐도 안 바뀐다). */
  rate: number | null
  /** cash / credit / travel. 마이그레이션 0004 이전 행은 cash 로 채워졌다. */
  payment_method: string
  /** 실제로 돈을 낸 사람 (trip_members.id). member_id(공금/개인 구분)와 다르다. */
  paid_by: string | null
  source: 'text' | 'image' | 'manual'
  created_by: string | null
  /** 입력 시각(HH:MM, 여행 목적지 시간대). 마이그레이션 0011 이전 행은 null. */
  time: string | null
  created_at: string
  updated_at: string
}
