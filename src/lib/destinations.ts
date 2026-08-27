import type { CurrencyCode } from './currencies'

export interface CountryOption {
  name: string
  /** 그 나라에서 주로 쓰는 통화. 나라를 고르면 "사용 통화"에 자동으로 추가된다. */
  currency: CurrencyCode
  /**
   * IANA 시간대. "오늘이 며칠인지" 를 이 시간대로 판정한다.
   * 오프셋 숫자가 아니라 존 이름을 쓰는 이유는 서머타임 때문이다 —
   * 유럽·미주는 여름/겨울에 오프셋이 바뀌는데 Intl 이 알아서 처리한다.
   */
  tz: string
  cities: string[]
}

export interface ContinentOption {
  name: string
  countries: CountryOption[]
}

/**
 * 목적지 선택용 대륙 → 나라 → 도시 트리.
 * 저장 형식은 기존과 동일한 문자열(`"중국 상하이"`)이고, 도시를 고르지 않으면 나라 이름만 저장된다.
 * 목록에 없는 도시는 폼의 "직접 입력"으로 넣는다.
 */
export const CONTINENTS: ContinentOption[] = [
  {
    name: '아시아',
    countries: [
      { name: '대한민국', currency: 'KRW', tz: 'Asia/Seoul', cities: ['서울', '부산', '제주', '강릉', '속초', '경주', '전주', '여수', '대구', '인천'] },
      { name: '일본', currency: 'JPY', tz: 'Asia/Tokyo', cities: ['도쿄', '오사카', '교토', '후쿠오카', '삿포로', '나고야', '오키나와', '나라', '고베', '히로시마', '벳푸', '가고시마', '센다이', '다카마쓰', '마쓰야마', '하코다테', '가나자와'] },
      { name: '중국', currency: 'CNY', tz: 'Asia/Shanghai', cities: ['상하이', '베이징', '시안', '청두', '광저우', '선전', '칭다오', '항저우', '쑤저우', '난징', '구이린', '충칭', '하얼빈', '장자제', '리장', '샤먼', '다롄', '톈진'] },
      { name: '홍콩', currency: 'HKD', tz: 'Asia/Hong_Kong', cities: ['홍콩'] },
      { name: '마카오', currency: 'MOP', tz: 'Asia/Macau', cities: ['마카오'] },
      { name: '대만', currency: 'TWD', tz: 'Asia/Taipei', cities: ['타이베이', '가오슝', '타이중', '타이난', '화롄', '지룽', '자이', '컨딩'] },
      { name: '몽골', currency: 'MNT', tz: 'Asia/Ulaanbaatar', cities: ['울란바토르', '테렐지'] },
      { name: '태국', currency: 'THB', tz: 'Asia/Bangkok', cities: ['방콕', '치앙마이', '푸껫', '파타야', '끄라비', '코사무이', '치앙라이', '후아힌', '아유타야'] },
      { name: '베트남', currency: 'VND', tz: 'Asia/Ho_Chi_Minh', cities: ['하노이', '호치민', '다낭', '나트랑', '호이안', '푸꾸옥', '하롱', '달랏', '후에', '사파'] },
      { name: '싱가포르', currency: 'SGD', tz: 'Asia/Singapore', cities: ['싱가포르'] },
      { name: '말레이시아', currency: 'MYR', tz: 'Asia/Kuala_Lumpur', cities: ['쿠알라룸푸르', '코타키나발루', '페낭', '랑카위', '말라카', '조호르바루'] },
      { name: '인도네시아', currency: 'IDR', tz: 'Asia/Jakarta', cities: ['발리', '자카르타', '족자카르타', '롬복', '반둥', '수라바야', '빈탄'] },
      { name: '필리핀', currency: 'PHP', tz: 'Asia/Manila', cities: ['세부', '마닐라', '보라카이', '팔라완', '보홀', '클락', '다바오'] },
      { name: '캄보디아', currency: 'KHR', tz: 'Asia/Phnom_Penh', cities: ['씨엠립', '프놈펜', '시아누크빌'] },
      { name: '라오스', currency: 'LAK', tz: 'Asia/Vientiane', cities: ['비엔티안', '루앙프라방', '방비엥'] },
      { name: '미얀마', currency: 'MMK', tz: 'Asia/Yangon', cities: ['양곤', '만달레이', '바간'] },
      { name: '브루나이', currency: 'BND', tz: 'Asia/Brunei', cities: ['반다르스리브가완'] },
      { name: '인도', currency: 'INR', tz: 'Asia/Kolkata', cities: ['델리', '뭄바이', '아그라', '자이푸르', '바라나시', '고아', '콜카타', '벵갈루루', '첸나이'] },
      { name: '네팔', currency: 'NPR', tz: 'Asia/Kathmandu', cities: ['카트만두', '포카라'] },
      { name: '스리랑카', currency: 'LKR', tz: 'Asia/Colombo', cities: ['콜롬보', '캔디', '갈레'] },
      { name: '몰디브', currency: 'MVR', tz: 'Indian/Maldives', cities: ['말레'] },
      { name: '우즈베키스탄', currency: 'UZS', tz: 'Asia/Tashkent', cities: ['타슈켄트', '사마르칸트', '부하라'] },
      { name: '카자흐스탄', currency: 'KZT', tz: 'Asia/Almaty', cities: ['알마티', '아스타나'] },
    ],
  },
  {
    name: '중동',
    countries: [
      { name: '아랍에미리트', currency: 'AED', tz: 'Asia/Dubai', cities: ['두바이', '아부다비', '샤르자'] },
      { name: '카타르', currency: 'QAR', tz: 'Asia/Qatar', cities: ['도하'] },
      { name: '사우디아라비아', currency: 'SAR', tz: 'Asia/Riyadh', cities: ['리야드', '제다', '알울라'] },
      { name: '오만', currency: 'OMR', tz: 'Asia/Muscat', cities: ['무스카트'] },
      { name: '이스라엘', currency: 'ILS', tz: 'Asia/Jerusalem', cities: ['텔아비브', '예루살렘'] },
      { name: '요르단', currency: 'JOD', tz: 'Asia/Amman', cities: ['암만', '페트라', '와디럼'] },
      { name: '튀르키예', currency: 'TRY', tz: 'Europe/Istanbul', cities: ['이스탄불', '카파도키아', '안탈리아', '파묵칼레', '이즈미르', '앙카라'] },
    ],
  },
  {
    name: '유럽',
    countries: [
      { name: '프랑스', currency: 'EUR', tz: 'Europe/Paris', cities: ['파리', '니스', '리옹', '마르세유', '보르도', '스트라스부르', '몽생미셸', '칸', '아비뇽'] },
      { name: '이탈리아', currency: 'EUR', tz: 'Europe/Rome', cities: ['로마', '피렌체', '베네치아', '밀라노', '나폴리', '시칠리아', '피사', '친퀘테레', '볼로냐', '토리노', '아말피'] },
      { name: '스페인', currency: 'EUR', tz: 'Europe/Madrid', cities: ['바르셀로나', '마드리드', '세비야', '그라나다', '발렌시아', '톨레도', '말라가', '이비자', '산세바스티안'] },
      { name: '포르투갈', currency: 'EUR', tz: 'Europe/Lisbon', cities: ['리스본', '포르투', '신트라', '마데이라'] },
      { name: '영국', currency: 'GBP', tz: 'Europe/London', cities: ['런던', '에든버러', '맨체스터', '리버풀', '옥스퍼드', '바스', '글래스고'] },
      { name: '아일랜드', currency: 'EUR', tz: 'Europe/Dublin', cities: ['더블린', '골웨이'] },
      { name: '독일', currency: 'EUR', tz: 'Europe/Berlin', cities: ['베를린', '뮌헨', '프랑크푸르트', '함부르크', '쾰른', '드레스덴', '하이델베르크', '뉘른베르크', '퓌센'] },
      { name: '오스트리아', currency: 'EUR', tz: 'Europe/Vienna', cities: ['빈', '잘츠부르크', '할슈타트', '인스브루크'] },
      { name: '스위스', currency: 'CHF', tz: 'Europe/Zurich', cities: ['취리히', '인터라켄', '루체른', '제네바', '체르마트', '베른', '몽트뢰'] },
      { name: '네덜란드', currency: 'EUR', tz: 'Europe/Amsterdam', cities: ['암스테르담', '로테르담', '헤이그', '잔세스칸스'] },
      { name: '벨기에', currency: 'EUR', tz: 'Europe/Brussels', cities: ['브뤼셀', '브뤼헤', '앤트워프', '겐트'] },
      { name: '체코', currency: 'CZK', tz: 'Europe/Prague', cities: ['프라하', '체스키크룸로프', '브르노'] },
      { name: '헝가리', currency: 'HUF', tz: 'Europe/Budapest', cities: ['부다페스트'] },
      { name: '폴란드', currency: 'PLN', tz: 'Europe/Warsaw', cities: ['바르샤바', '크라쿠프', '브로츠와프', '그단스크'] },
      { name: '그리스', currency: 'EUR', tz: 'Europe/Athens', cities: ['아테네', '산토리니', '미코노스', '크레타', '메테오라'] },
      { name: '크로아티아', currency: 'EUR', tz: 'Europe/Zagreb', cities: ['자그레브', '두브로브니크', '스플리트', '플리트비체'] },
      { name: '슬로베니아', currency: 'EUR', tz: 'Europe/Ljubljana', cities: ['류블랴나', '블레드'] },
      { name: '스웨덴', currency: 'SEK', tz: 'Europe/Stockholm', cities: ['스톡홀름', '예테보리'] },
      { name: '노르웨이', currency: 'NOK', tz: 'Europe/Oslo', cities: ['오슬로', '베르겐', '트롬쇠'] },
      { name: '덴마크', currency: 'DKK', tz: 'Europe/Copenhagen', cities: ['코펜하겐'] },
      { name: '핀란드', currency: 'EUR', tz: 'Europe/Helsinki', cities: ['헬싱키', '로바니에미'] },
      { name: '아이슬란드', currency: 'ISK', tz: 'Atlantic/Reykjavik', cities: ['레이캬비크'] },
      { name: '몰타', currency: 'EUR', tz: 'Europe/Malta', cities: ['발레타'] },
      { name: '루마니아', currency: 'RON', tz: 'Europe/Bucharest', cities: ['부쿠레슈티', '브라쇼브'] },
      { name: '불가리아', currency: 'BGN', tz: 'Europe/Sofia', cities: ['소피아', '플로브디프'] },
      { name: '세르비아', currency: 'RSD', tz: 'Europe/Belgrade', cities: ['베오그라드'] },
      { name: '조지아', currency: 'GEL', tz: 'Asia/Tbilisi', cities: ['트빌리시', '바투미', '카즈베기'] },
      { name: '우크라이나', currency: 'UAH', tz: 'Europe/Kyiv', cities: ['키이우', '리비우'] },
      { name: '러시아', currency: 'RUB', tz: 'Europe/Moscow', cities: ['모스크바', '상트페테르부르크', '블라디보스토크', '이르쿠츠크'] },
    ],
  },
  {
    name: '북아메리카',
    countries: [
      { name: '미국', currency: 'USD', tz: 'America/New_York', cities: ['뉴욕', '로스앤젤레스', '샌프란시스코', '라스베이거스', '시애틀', '시카고', '하와이', '보스턴', '워싱턴DC', '마이애미', '올랜도', '샌디에이고', '뉴올리언스', '덴버', '오스틴', '포틀랜드', '애틀랜타'] },
      { name: '캐나다', currency: 'CAD', tz: 'America/Toronto', cities: ['밴쿠버', '토론토', '몬트리올', '퀘벡', '캘거리', '밴프', '오타와'] },
      { name: '멕시코', currency: 'MXN', tz: 'America/Mexico_City', cities: ['칸쿤', '멕시코시티', '과나후아토', '툴룸', '플라야델카르멘'] },
      { name: '쿠바', currency: 'CUP', tz: 'America/Havana', cities: ['아바나'] },
      { name: '코스타리카', currency: 'CRC', tz: 'America/Costa_Rica', cities: ['산호세'] },
    ],
  },
  {
    name: '남아메리카',
    countries: [
      { name: '브라질', currency: 'BRL', tz: 'America/Sao_Paulo', cities: ['리우데자네이루', '상파울루', '이구아수'] },
      { name: '아르헨티나', currency: 'ARS', tz: 'America/Argentina/Buenos_Aires', cities: ['부에노스아이레스', '우수아이아', '엘칼라파테'] },
      { name: '페루', currency: 'PEN', tz: 'America/Lima', cities: ['리마', '쿠스코', '마추픽추'] },
      { name: '칠레', currency: 'CLP', tz: 'America/Santiago', cities: ['산티아고', '아타카마', '푸에르토몬트'] },
      { name: '볼리비아', currency: 'BOB', tz: 'America/La_Paz', cities: ['라파스', '우유니'] },
      { name: '콜롬비아', currency: 'COP', tz: 'America/Bogota', cities: ['보고타', '메데인', '카르타헤나'] },
      { name: '에콰도르', currency: 'USD', tz: 'America/Guayaquil', cities: ['키토', '갈라파고스'] },
    ],
  },
  {
    name: '오세아니아',
    countries: [
      { name: '호주', currency: 'AUD', tz: 'Australia/Sydney', cities: ['시드니', '멜버른', '브리즈번', '골드코스트', '케언즈', '퍼스', '애들레이드', '태즈메이니아'] },
      { name: '뉴질랜드', currency: 'NZD', tz: 'Pacific/Auckland', cities: ['오클랜드', '퀸스타운', '크라이스트처치', '웰링턴', '로토루아'] },
      { name: '괌', currency: 'USD', tz: 'Pacific/Guam', cities: ['괌'] },
      { name: '북마리아나제도', currency: 'USD', tz: 'Pacific/Saipan', cities: ['사이판'] },
      { name: '피지', currency: 'FJD', tz: 'Pacific/Fiji', cities: ['난디'] },
      { name: '팔라우', currency: 'USD', tz: 'Pacific/Palau', cities: ['코로르'] },
      { name: '프랑스령 폴리네시아', currency: 'XPF', tz: 'Pacific/Tahiti', cities: ['보라보라', '타히티'] },
    ],
  },
  {
    name: '아프리카',
    countries: [
      { name: '이집트', currency: 'EGP', tz: 'Africa/Cairo', cities: ['카이로', '룩소르', '아스완', '후르가다'] },
      { name: '모로코', currency: 'MAD', tz: 'Africa/Casablanca', cities: ['마라케시', '카사블랑카', '페스', '셰프샤우엔', '탕헤르'] },
      { name: '튀니지', currency: 'TND', tz: 'Africa/Tunis', cities: ['튀니스'] },
      { name: '남아프리카공화국', currency: 'ZAR', tz: 'Africa/Johannesburg', cities: ['케이프타운', '요하네스버그'] },
      { name: '케냐', currency: 'KES', tz: 'Africa/Nairobi', cities: ['나이로비', '마사이마라'] },
      { name: '탄자니아', currency: 'TZS', tz: 'Africa/Dar_es_Salaam', cities: ['잔지바르', '아루샤'] },
      { name: '에티오피아', currency: 'ETB', tz: 'Africa/Addis_Ababa', cities: ['아디스아바바'] },
      { name: '나미비아', currency: 'NAD', tz: 'Africa/Windhoek', cities: ['빈트후크'] },
      { name: '모리셔스', currency: 'MUR', tz: 'Indian/Mauritius', cities: ['포트루이스'] },
      { name: '세이셸', currency: 'SCR', tz: 'Indian/Mahe', cities: ['빅토리아'] },
    ],
  },
]

/** 나라 이름과 도시 이름을 저장 형식(`"중국 상하이"`)으로 합친다. 도시가 없으면 나라만. */
export function destinationLabel(country: string, city?: string | null): string {
  const c = city?.trim()
  if (!c || c === country) return country
  return `${country} ${c}`
}
