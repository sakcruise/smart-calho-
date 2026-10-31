/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> }

// App shell offline
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
self.skipWaiting()
clientsClaim()

// Phone notifications from the notify function
self.addEventListener('push', (event) => {
  let data: { title?: string; body?: string; tag?: string; url?: string } = {}
  try { data = event.data?.json() ?? {} } catch { data = { title: event.data?.text() } }
  event.waitUntil(self.registration.showNotification(data.title ?? 'Family calendar', {
    body: data.body, tag: data.tag, icon: '/icon.svg', badge: '/icon.svg', data: { url: data.url ?? '/' },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data as { url?: string })?.url ?? '/'
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const open = all.find((c) => 'focus' in c) as WindowClient | undefined
    if (open) { await open.focus(); await open.navigate(url).catch(() => undefined); return }
    await self.clients.openWindow(url)
  })())
})
