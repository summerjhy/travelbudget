/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { NetworkOnly, CacheFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

declare let self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)

// Supabase REST/Edge Function 호출은 캐시하지 않는다 — 관찰 메모는 온라인
// 상태에서만 쓸 수 있으므로(13단계에서 오프라인 큐를 제거) 캐시된 응답을
// 보여줄 이유가 없다.
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
      // badge는 알림 트레이의 큰 아이콘(icon)과 달리 상태바에 뜨는 작은
      // 흑백 실루엣용이다. icon과 같은(배경이 꽉 찬 불투명) 파일을 쓰면
      // 안드로이드가 알파 채널에서 모양을 못 뽑아내 네모로 보인다.
      // 배경 없이 실루엣만 있는 전용 파일(badge-96x96.png)을 따로 쓴다.
      badge: '/badge-96x96.png',
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
