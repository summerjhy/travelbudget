export interface CurrencyOption {
  /** ISO 4217 코드 */
  code: string
  /** 나라/지역 이름 (한글) */
  country: string
  /** 통화 이름 (한글) */
  unit: string
}

export interface CurrencyGroup {
  region: string
  items: CurrencyOption[]
}

/**
 * 선택 가능한 통화 목록. 여행지에서 쓸 법한 통화를 대륙별로 묶어둔다.
 * 표시 형식은 `KRW (한국 원)` — currencyLabel() 참고.
 */
export const CURRENCY_GROUPS: CurrencyGroup[] = [
  {
    region: '동아시아 · 동남아시아',
    items: [
      { code: 'KRW', country: '한국', unit: '원' },
      { code: 'JPY', country: '일본', unit: '엔' },
      { code: 'CNY', country: '중국', unit: '위안' },
      { code: 'HKD', country: '홍콩', unit: '달러' },
      { code: 'TWD', country: '대만', unit: '달러' },
      { code: 'MOP', country: '마카오', unit: '파타카' },
      { code: 'MNT', country: '몽골', unit: '투그릭' },
      { code: 'THB', country: '태국', unit: '바트' },
      { code: 'VND', country: '베트남', unit: '동' },
      { code: 'SGD', country: '싱가포르', unit: '달러' },
      { code: 'MYR', country: '말레이시아', unit: '링깃' },
      { code: 'IDR', country: '인도네시아', unit: '루피아' },
      { code: 'PHP', country: '필리핀', unit: '페소' },
      { code: 'KHR', country: '캄보디아', unit: '리엘' },
      { code: 'LAK', country: '라오스', unit: '킵' },
      { code: 'MMK', country: '미얀마', unit: '짯' },
      { code: 'BND', country: '브루나이', unit: '달러' },
    ],
  },
  {
    region: '남아시아 · 중앙아시아',
    items: [
      { code: 'INR', country: '인도', unit: '루피' },
      { code: 'NPR', country: '네팔', unit: '루피' },
      { code: 'LKR', country: '스리랑카', unit: '루피' },
      { code: 'PKR', country: '파키스탄', unit: '루피' },
      { code: 'BDT', country: '방글라데시', unit: '타카' },
      { code: 'MVR', country: '몰디브', unit: '루피야' },
      { code: 'UZS', country: '우즈베키스탄', unit: '숨' },
      { code: 'KZT', country: '카자흐스탄', unit: '텡게' },
    ],
  },
  {
    region: '중동',
    items: [
      { code: 'AED', country: '아랍에미리트', unit: '디르함' },
      { code: 'QAR', country: '카타르', unit: '리얄' },
      { code: 'SAR', country: '사우디아라비아', unit: '리얄' },
      { code: 'OMR', country: '오만', unit: '리알' },
      { code: 'ILS', country: '이스라엘', unit: '셰켈' },
      { code: 'JOD', country: '요르단', unit: '디나르' },
      { code: 'TRY', country: '튀르키예', unit: '리라' },
    ],
  },
  {
    region: '유럽',
    items: [
      { code: 'EUR', country: '유로존', unit: '유로' },
      { code: 'GBP', country: '영국', unit: '파운드' },
      { code: 'CHF', country: '스위스', unit: '프랑' },
      { code: 'SEK', country: '스웨덴', unit: '크로나' },
      { code: 'NOK', country: '노르웨이', unit: '크로네' },
      { code: 'DKK', country: '덴마크', unit: '크로네' },
      { code: 'ISK', country: '아이슬란드', unit: '크로나' },
      { code: 'CZK', country: '체코', unit: '코루나' },
      { code: 'PLN', country: '폴란드', unit: '즈워티' },
      { code: 'HUF', country: '헝가리', unit: '포린트' },
      { code: 'RON', country: '루마니아', unit: '레우' },
      { code: 'BGN', country: '불가리아', unit: '레프' },
      { code: 'RSD', country: '세르비아', unit: '디나르' },
      { code: 'GEL', country: '조지아', unit: '라리' },
      { code: 'UAH', country: '우크라이나', unit: '흐리우냐' },
      { code: 'RUB', country: '러시아', unit: '루블' },
    ],
  },
  {
    region: '아메리카',
    items: [
      { code: 'USD', country: '미국', unit: '달러' },
      { code: 'CAD', country: '캐나다', unit: '달러' },
      { code: 'MXN', country: '멕시코', unit: '페소' },
      { code: 'CUP', country: '쿠바', unit: '페소' },
      { code: 'CRC', country: '코스타리카', unit: '콜론' },
      { code: 'BRL', country: '브라질', unit: '헤알' },
      { code: 'ARS', country: '아르헨티나', unit: '페소' },
      { code: 'CLP', country: '칠레', unit: '페소' },
      { code: 'PEN', country: '페루', unit: '솔' },
      { code: 'BOB', country: '볼리비아', unit: '볼리비아노' },
      { code: 'COP', country: '콜롬비아', unit: '페소' },
    ],
  },
  {
    region: '오세아니아',
    items: [
      { code: 'AUD', country: '호주', unit: '달러' },
      { code: 'NZD', country: '뉴질랜드', unit: '달러' },
      { code: 'FJD', country: '피지', unit: '달러' },
      { code: 'XPF', country: '프랑스령 폴리네시아', unit: '프랑' },
    ],
  },
  {
    region: '아프리카',
    items: [
      { code: 'EGP', country: '이집트', unit: '파운드' },
      { code: 'MAD', country: '모로코', unit: '디르함' },
      { code: 'TND', country: '튀니지', unit: '디나르' },
      { code: 'ZAR', country: '남아프리카공화국', unit: '랜드' },
      { code: 'KES', country: '케냐', unit: '실링' },
      { code: 'TZS', country: '탄자니아', unit: '실링' },
      { code: 'ETB', country: '에티오피아', unit: '비르' },
      { code: 'NGN', country: '나이지리아', unit: '나이라' },
      { code: 'MUR', country: '모리셔스', unit: '루피' },
      { code: 'SCR', country: '세이셸', unit: '루피' },
    ],
  },
]

const BY_CODE = new Map<string, CurrencyOption>(
  CURRENCY_GROUPS.flatMap((g) => g.items).map((c) => [c.code, c]),
)

/** `KRW` → `KRW (한국 원)`. 목록에 없는 코드는 코드 그대로 돌려준다. */
export function currencyLabel(code: string): string {
  const c = BY_CODE.get(code)
  return c ? `${c.code} (${c.country} ${c.unit})` : code
}
