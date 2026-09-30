import { api } from './api'

export type PushState = { supported: boolean; permission: NotificationPermission | 'unsupported'; on: boolean; key: string | null }

const decodeKey = (key: string) => {
  const padded = (key + '='.repeat((4 - (key.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  return Uint8Array.from(raw, (char) => char.charCodeAt(0))
}

export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

async function worker() {
  const existing = await navigator.serviceWorker.getRegistration('/sw.js')
  return existing ?? (await navigator.serviceWorker.register('/sw.js', { scope: '/' }))
}

export async function pushState(): Promise<PushState> {
  if (!pushSupported()) return { supported: false, permission: 'unsupported', on: false, key: null }
  const { ok, data } = await api<{ key: string | null; on: boolean }>('push')
  const local = await worker()
    .then((registration) => registration.pushManager.getSubscription())
    .catch(() => null)
  return {
    supported: true,
    permission: Notification.permission,
    on: Boolean(ok && data.on && local),
    key: ok ? data.key : null,
  }
}

export async function enablePush(key: string) {
  if (!pushSupported()) return false
  const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
  if (permission !== 'granted') return false

  const registration = await worker()
  await navigator.serviceWorker.ready
  const existing = await registration.pushManager.getSubscription()
  const subscription =
    existing ?? (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeKey(key) }))
  const raw = subscription.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
  if (!raw.endpoint || !raw.keys?.p256dh || !raw.keys.auth) return false

  const { ok } = await api('push', { endpoint: raw.endpoint, keys: raw.keys })
  return ok
}

export async function disablePush() {
  if (!pushSupported()) return
  const registration = await navigator.serviceWorker.getRegistration('/sw.js')
  const subscription = await registration?.pushManager.getSubscription()
  await api('push', { action: 'off', endpoint: subscription?.endpoint ?? '' })
  await subscription?.unsubscribe().catch(() => undefined)
}
