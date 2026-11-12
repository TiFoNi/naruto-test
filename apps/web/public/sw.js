const OFFLINE = 'nanda-offline-v2'
const FALLBACK = '/offline.html'

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(OFFLINE).then((store) => store.add(FALLBACK)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) =>
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(names.filter((name) => name !== OFFLINE).map((name) => caches.delete(name)))
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable().catch(() => undefined)
      await self.clients.claim()
    })(),
  ),
)

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return
  event.respondWith(
    (async () => {
      try {
        return (await event.preloadResponse) || (await fetch(event.request))
      } catch {
        return (await caches.match(FALLBACK)) ?? Response.error()
      }
    })(),
  )
})

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = {}
  }

  const title = data.title || 'NandaGuessr'
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/badge-96.png',
    tag: data.tag || 'nanda',
    renotify: true,
    timestamp: data.at || Date.now(),
    data: { url: data.url || '/' },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('pushsubscriptionchange', (event) => {
  const key = event.oldSubscription?.options?.applicationServerKey
  if (!key) return

  event.waitUntil(
    self.registration.pushManager
      .subscribe({ userVisibleOnly: true, applicationServerKey: key })
      .then((subscription) => {
        const raw = subscription.toJSON()
        return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
          for (const client of list) client.postMessage({ type: 'push-renewed', endpoint: raw.endpoint, keys: raw.keys })
        })
      })
      .catch(() => undefined),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href

  event.waitUntil(
    (async () => {
      const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const same = list.find((client) => client.url === target)
      if (same) return same.focus()
      const ours = list.find((client) => 'navigate' in client && new URL(client.url).origin === self.location.origin)
      if (ours) {
        try {
          const shown = await ours.focus()
          return await (shown || ours).navigate(target)
        } catch {}
      }
      return self.clients.openWindow(target)
    })(),
  )
})
