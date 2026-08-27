/**
 * 공유로 들어왔는지 여부. 앱이 뜨자마자 한 번만 읽어 보관한다.
 *
 * 서비스워커가 /record?share-target=1 로 리다이렉트하는데, RecordTab 은
 * 여행·이름이 로드된 뒤에야 마운트된다. 그 사이에 라우터가 URL 을 바꾸면
 * 쿼리를 놓치므로 모듈 로드 시점에 붙잡아 둔다.
 */
let pendingShare: string | null = null

if (typeof window !== 'undefined') {
  const params = new URLSearchParams(window.location.search)
  pendingShare = params.get('share-target')
  if (pendingShare) {
    window.history.replaceState({}, '', window.location.pathname)
  }
}

/** 공유 플래그를 꺼낸다. 한 번 꺼내면 사라진다. */
export function takeShareFlag(): string | null {
  const v = pendingShare
  pendingShare = null
  return v
}

const SHARE_DB_NAME = 'travelbudget-share'
const SHARE_STORE = 'shared-files'

function openShareDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(SHARE_DB_NAME, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(SHARE_STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** 서비스워커가 저장해둔 공유 이미지를 가져오고, 가져온 뒤에는 저장소를 비운다. */
export async function consumeSharedFiles(): Promise<File[]> {
  const db = await openShareDB()
  const files = await new Promise<File[]>((resolve, reject) => {
    const tx = db.transaction(SHARE_STORE, 'readwrite')
    const store = tx.objectStore(SHARE_STORE)
    const getReq = store.get('pending')
    getReq.onsuccess = () => {
      store.delete('pending')
      resolve((getReq.result as File[]) ?? [])
    }
    getReq.onerror = () => reject(getReq.error)
  })
  db.close()
  return files
}
