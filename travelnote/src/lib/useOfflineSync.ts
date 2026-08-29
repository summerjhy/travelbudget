import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { getQueuedOps, removeQueuedOp } from './offlineQueue'

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

/** @returns 큐에 있던 모든 작업이 성공적으로 반영됐는지 (하나라도 실패해 중단됐으면 false) */
async function flushQueue(tripId: string): Promise<boolean> {
  const ops = await getQueuedOps(tripId)
  for (const queued of ops) {
    try {
      if (queued.op.type === 'insert') {
        await supabase.from('journal_notes').insert(queued.op.item)
      } else if (queued.op.type === 'update') {
        await supabase.from('journal_notes').update(queued.op.patch).eq('id', queued.op.noteId)
      } else if (queued.op.type === 'delete') {
        await supabase.from('journal_notes').delete().eq('id', queued.op.noteId)
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
