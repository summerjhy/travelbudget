/**
 * 화면 색상 테마.
 *
 * 토큰 이름(--paper/--card/--ink/--soft/--jade/--marigold/--rose/--line)은
 * 기존 것을 그대로 쓴다. 그래서 컴포넌트 CSS는 손대지 않아도 테마가 바뀐다.
 * --jade 는 이름만 옥색이고 실제로는 "그 테마의 강조색"이다.
 */
export const THEMES = [
  { code: 'green', label: '그린', swatch: '#2A6B5C' },
  { code: 'blue', label: '블루', swatch: '#2C5F7C' },
  { code: 'beige', label: '베이지', swatch: '#8A6D4F' },
  { code: 'pink', label: '핑크', swatch: '#B5657F' },
] as const

export type ThemeCode = (typeof THEMES)[number]['code']

export const DEFAULT_THEME: ThemeCode = 'green'

const CODES = new Set<string>(THEMES.map((t) => t.code))

export function isTheme(v: string | null | undefined): v is ThemeCode {
  return !!v && CODES.has(v)
}

const KEY = 'travelbudget.theme'

/**
 * 테마는 여행별이 아니라 기기별이다 — "기분따라 바꿔 쓰는" 취향 설정이라
 * 여행을 옮겨도 따라다니는 편이 자연스럽다.
 */
export function getStoredTheme(): ThemeCode {
  try {
    const v = localStorage.getItem(KEY)
    return isTheme(v) ? v : DEFAULT_THEME
  } catch {
    // 프라이빗 모드 등에서 localStorage 접근이 막혀도 화면은 떠야 한다.
    return DEFAULT_THEME
  }
}

export function setStoredTheme(theme: ThemeCode) {
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    /* 저장 못해도 이번 세션 동안은 적용된다 */
  }
}

/** <html data-theme="..."> 로 심는다. CSS 가 이 속성으로 토큰을 갈아끼운다. */
export function applyTheme(theme: ThemeCode) {
  document.documentElement.dataset.theme = theme

  // 안드로이드 상태표시줄 색. index.html 의 theme-color 는 고정값이라
  // 테마를 바꿔도 그대로 남는다 — 여기서 같이 갈아끼운다.
  const swatch = THEMES.find((t) => t.code === theme)?.swatch
  if (!swatch) return
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = 'theme-color'
    document.head.appendChild(meta)
  }
  meta.content = swatch
}
