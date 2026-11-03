'use client'

import { liftCookies } from './cookieLift'

const base = (process.env.NEXT_PUBLIC_STREAM_URL ?? process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/+$/, '')

export type StreamHandlers = Record<string, (data: unknown) => void>

export function openStream(path: string, handlers: StreamHandlers, onLive?: (live: boolean) => void) {
  if (typeof EventSource === 'undefined') return () => undefined
  let close: (() => void) | null = null
  let gone = false
  void liftCookies().then(() => {
    if (!gone) close = listen(path, handlers, onLive)
  })
  return () => {
    gone = true
    close?.()
  }
}

function listen(path: string, handlers: StreamHandlers, onLive?: (live: boolean) => void) {
  const source = new EventSource(`${base}/api/${path}`, { withCredentials: Boolean(base) })

  const listeners = Object.entries(handlers).map(([event, handle]) => {
    const listener = (message: MessageEvent<string>) => {
      onLive?.(true)
      try {
        handle(JSON.parse(message.data))
      } catch {
        handle(null)
      }
    }
    source.addEventListener(event, listener)
    return () => source.removeEventListener(event, listener)
  })

  source.onopen = () => onLive?.(true)
  source.onerror = () => onLive?.(source.readyState === EventSource.OPEN)

  return () => {
    for (const off of listeners) off()
    source.onopen = null
    source.onerror = null
    source.close()
    onLive?.(false)
  }
}
