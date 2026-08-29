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

// 리마인더 알림. send-journal-reminders / deliver-journal Edge Function 이 보낸 푸시를 받아 띄운다.
self.addEventListener('push', (event) => {
  let title = '🔍 비밀친구 관찰일지'
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
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: 'travelnote-notify',
    }),
  )
})

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
