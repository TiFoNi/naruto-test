'use client'

import { useEffect, useState } from 'react'

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

type Holder = Window & { __install?: InstallEvent }

let offer: InstallEvent | null = typeof window === 'undefined' ? null : ((window as Holder).__install ?? null)

const fans = new Set<() => void>()

const tell = () => fans.forEach((fan) => fan())

if (typeof window !== 'undefined') {
  const keep = (event: Event) => {
    event.preventDefault()
    offer = event as InstallEvent
    tell()
  }

  window.addEventListener('beforeinstallprompt', keep)

  window.addEventListener('nanda:install', () => {
    offer = (window as Holder).__install ?? offer
    tell()
  })

  window.addEventListener('appinstalled', () => {
    offer = null
    delete (window as Holder).__install
    tell()
  })
}

export const onPhone = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(max-width: 1024px)').matches &&
  (window.matchMedia('(pointer: coarse)').matches || window.navigator.maxTouchPoints > 0)

export const already = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true)

export const onApple = () =>
  typeof window !== 'undefined' &&
  (/iphone|ipad|ipod/i.test(window.navigator.userAgent) || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1))

export const onMacSafari = () =>
  typeof window !== 'undefined' &&
  /macintosh/i.test(window.navigator.userAgent) &&
  window.navigator.maxTouchPoints === 0 &&
  /safari/i.test(window.navigator.userAgent) &&
  !/chrome|chromium|crios|edg|firefox|opr/i.test(window.navigator.userAgent)

export const appleSafari = () => onApple() && !/crios|fxios|edgios|opt\/|yabrowser/i.test(window.navigator.userAgent)

export function useInstall() {
  const [, bump] = useState(0)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    const fan = () => bump((count) => count + 1)
    fans.add(fan)
    setInstalled(already())

    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined)

    const probe = (navigator as Navigator & { getInstalledRelatedApps?: () => Promise<unknown[]> }).getInstalledRelatedApps
    if (probe) probe.call(navigator).then((found) => found.length > 0 && setInstalled(true)).catch(() => undefined)

    const done = () => setInstalled(true)
    window.addEventListener('appinstalled', done)

    return () => {
      fans.delete(fan)
      window.removeEventListener('appinstalled', done)
    }
  }, [])

  const run = async () => {
    const live = offer
    if (!live) return false

    await live.prompt()
    const choice = await live.userChoice.catch(() => null)

    offer = null
    delete (window as Holder).__install
    tell()

    return choice?.outcome === 'accepted'
  }

  return { ready: Boolean(offer), ios: onApple(), safari: appleSafari(), mac: onMacSafari(), installed, run }
}
