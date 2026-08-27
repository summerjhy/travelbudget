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
    try {
      const formData = await request.formData()
      // manifest 에는 'images' 로 적어뒀지만, 기기·앱에 따라 다른 이름으로
      // 보내는 경우가 있어 폼 전체에서 파일을 긁어모은다.
      const files: File[] = []
      for (const value of formData.values()) {
        if (value instanceof File && value.size > 0) files.push(value)
      }
      if (files.length > 0) {
        await storeSharedFiles(files)
        return Response.redirect('/record?share-target=1', 303)
      }
      // 파일이 없으면 그냥 앱을 연다 — 빈 화면으로 떨어지는 것보다 낫다.
      return Response.redirect('/record?share-target=empty', 303)
    } catch {
      // 저장에 실패해도 앱은 열어준다. 사용자가 사진을 직접 고를 수 있다.
      return Response.redirect('/record?share-target=error', 303)
    }
  },
  'POST',
)

// 관리자 참여 알림. notify-join Edge Function 이 보낸 푸시를 받아 띄운다.
self.addEventListener('push', (event) => {
  // payload 가 없거나 깨져 있어도 알림 자체는 띄운다 — 조용히 삼키면
  // 알림이 안 오는 건지 앱이 죽은 건지 구분이 안 된다.
  let title = '🧳 여행 가계부'
  let body = '새 소식이 있어요.'
  try {
    const data = event.data?.json()
    if (data?.title) title = data.title
    if (data?.body) body = data.body
  } catch {
    // 그대로 기본 문구를 쓴다.
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      // 같은 태그면 알림이 쌓이지 않고 최신 것으로 덮인다.
      tag: 'travelbudget-notify',
    }),
  )
})

// 알림을 누르면 이미 열려 있는 창을 앞으로, 없으면 새로 연다.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) return c.focus()
      }
      return self.clients.openWindow('/')
    }),
  )
})

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
