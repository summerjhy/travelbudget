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
