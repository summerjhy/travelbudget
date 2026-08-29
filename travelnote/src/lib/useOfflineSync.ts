import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { getQueuedOps, removeQueuedOp } from './offlineQueue'
import { isNetworkError } from './isNetworkError'

export function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  return online
}

/**
 * @returns 큐에 있던 모든 작업이 성공적으로 반영됐는지 (하나라도 실패해 중단됐으면 false)
 *
 * supabase-js는 RLS 위반 같은 진짜 서버 거부도 예외를 던지지 않고
 * {data:null, error}로 정상 반환한다. 그래서 반드시 {error}를 직접
 * 확인해야 한다 — try/catch만 믿으면(이전 버전의 버그) 실패한 요청도
 * "성공"으로 착각해 큐에서 지워버려, 사용자 모르게 데이터가 사라진다.
 */
async function flushQueue(tripId: string): Promise<boolean> {
  const ops = await getQueuedOps(tripId)
  for (const queued of ops) {
    try {
      let error: { message?: string } | null = null
      if (queued.op.type === 'insert') {
        ;({ error } = await supabase.from('journal_notes').insert(queued.op.item))
      } else if (queued.op.type === 'update') {
        ;({ error } = await supabase.from('journal_notes').update(queued.op.patch).eq('id', queued.op.noteId))
      } else if (queued.op.type === 'delete') {
        ;({ error } = await supabase.from('journal_notes').delete().eq('id', queued.op.noteId))
      }

      if (error) {
        if (isNetworkError(error)) return false // 아직 오프라인 — 다음 online 이벤트에서 재시도
        // 서버가 실제로 거부한 요청이다. 큐에서 지우지 않고 남겨둔다 —
        // 지워버리면 사용자가 알아챌 방법 없이 그 메모가 영영 사라진다.
        console.error('오프라인 큐 항목 반영 실패(서버 거부):', error.message)
        return false
      }
      await removeQueuedOp(queued.id)
    } catch {
      // 아직 오프라인이거나 일시적 실패. 큐에 남겨두고 다음 online 이벤트에서 재시도한다.
      return false
    }
  }
  return true
}

/**
 * 온라인 상태가 되면 큐를 순서대로 서버에 반영하고, 완료 후 refresh로 최신 상태를 다시 불러온다.
 */
export function useOfflineSync(
  tripId: string | undefined,
  refresh: (options?: { clearPending?: boolean }) => void,
) {
  const online = useOnlineStatus()

  useEffect(() => {
    if (!online || !tripId) return
    flushQueue(tripId).then((allFlushed) => refresh({ clearPending: allFlushed }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, tripId])

  return { online }
}
