import { useEffect } from 'react'

const POLL_INTERVAL_MS = 12000

/**
 * 온라인이고 탭이 보이는 동안 주기적으로 refresh를 호출한다.
 * Realtime(WebSocket)은 x-trip-code 커스텀 헤더 RLS와 호환되지 않아(6-2 참고)
 * 짧은 간격 폴링으로 "다른 사람 입력 반영"을 대체한다.
 */
export function usePolling(refresh: () => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return

    const tick = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) refresh()
    }
    const interval = setInterval(tick, POLL_INTERVAL_MS)

    const onVisible = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])
}
