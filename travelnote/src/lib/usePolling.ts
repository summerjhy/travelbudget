import { useEffect } from 'react'

const POLL_INTERVAL_MS = 12000

/**
 * 온라인이고 탭이 보이는 동안 주기적으로 refresh를 호출한다.
 * Realtime(WebSocket)은 x-note-code 커스텀 헤더 RLS와 호환되지 않아
 * (travelbudget 6-2 참고, 동일한 이유) 짧은 간격 폴링으로 대체한다.
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
