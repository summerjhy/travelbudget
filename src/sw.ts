/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { NetworkOnly, CacheFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

declare let self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)

// Supabase REST/Edge Function 호출은 캐시하지 않는다 — 오프라인 큐(IndexedDB)가 별도로 처리한다.
registerRoute(
  ({ url }) => url.pathname.startsWith('/rest/v1/') || url.pathname.startsWith('/functions/v1/'),
  new NetworkOnly(),
)

registerRoute(
  ({ url }) => url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com'),
  new CacheFirst({
    cacheName: 'google-fonts',
    plugins: [new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 })],
  }),
)

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

async function storeSharedFiles(files: File[]) {
  const db = await openShareDB()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(SHARE_STORE, 'readwrite')
    tx.objectStore(SHARE_STORE).put(files, 'pending')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

// 안드로이드 공유 시트에서 이 앱으로 캡쳐를 공유하면 여기로 POST된다 (manifest share_target 참고).
registerRoute(
  ({ url, request }) => url.pathname === '/share-target' && request.method === 'POST',
  async ({ request }) => {
    const formData = await request.formData()
    const files = formData.getAll('images').filter((f): f is File => f instanceof File)
    if (files.length > 0) {
      await storeSharedFiles(files)
    }
    return Response.redirect('/?share-target=1', 303)
  },
  'POST',
)

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
