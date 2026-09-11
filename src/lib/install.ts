import { useEffect, useState } from 'react'

/**
 * 홈 화면 설치 관련 유틸.
 *
 * `beforeinstallprompt` 는 페이지가 뜨자마자(대개 React 마운트보다 먼저) 한 번 날아오고
 * 다시 오지 않는다. 그래서 이 모듈이 import 되는 순간 전역에서 잡아두고, 화면은
 * 나중에 `useInstallPrompt()` 로 꺼내 쓴다.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: BeforeInstallPromptEvent | null = null
let installed = false
const listeners = new Set<() => void>()

function notify() {
  for (const fn of listeners) fn()
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    // 기본 미니 인포바를 막고 우리 버튼으로 띄운다.
    e.preventDefault()
    deferred = e as BeforeInstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    installed = true
    deferred = null
    notify()
  })
}

/** 홈 화면 앱(standalone)으로 실행 중인지. 이미 설치했으면 설치 안내를 띄울 이유가 없다. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true
  // iOS Safari 는 display-mode 를 안 주고 navigator.standalone 로만 알린다.
  return (window.navigator as Navigator & { standalone?: boolean }).standalone === true
}

export type Platform = 'ios' | 'android' | 'other'

/**
 * 설치 방법이 기기마다 완전히 달라서(iOS 는 공유 시트, Android 는 설치 프롬프트)
 * 자기 기기 안내만 보여주려고 갈라놓는다.
 */
export function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'other'
  const ua = navigator.userAgent
  // iPadOS 13+ 는 UA 에 iPad 대신 Macintosh 로 나와서 터치 지원 여부로 한 번 더 본다.
  const iPadOS = /Macintosh/.test(ua) && typeof document !== 'undefined' && 'ontouchend' in document
  if (/iPad|iPhone|iPod/.test(ua) || iPadOS) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return 'other'
}

/**
 * 크롬 계열이 넘겨준 설치 프롬프트. `canPrompt` 가 true 일 때만 OS 설치창을 띄울 수 있다.
 * iOS 에는 이 이벤트가 없어서 항상 false 이고, 그때는 수동 안내를 보여줘야 한다.
 */
export function useInstallPrompt() {
  const [, setTick] = useState(0)

  useEffect(() => {
    const rerender = () => setTick((v) => v + 1)
    listeners.add(rerender)
    return () => {
      listeners.delete(rerender)
    }
  }, [])

  async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
    if (!deferred) return 'unavailable'
    const e = deferred
    await e.prompt()
    const { outcome } = await e.userChoice
    // 한 번 쓴 프롬프트는 재사용할 수 없다.
    deferred = null
    notify()
    return outcome
  }

  return { canPrompt: deferred !== null, installed, promptInstall }
}
