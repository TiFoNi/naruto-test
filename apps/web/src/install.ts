'use client'

import { useEffect, useState } from 'react'

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

let offer: InstallEvent | null = null

const fans = new Set<() => void>()

const tell = () => fans.forEach((fan) => fan())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    offer = event as InstallEvent
    tell()
  })

  window.addEventListener('appinstalled', () => {
    offer = null
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
  typeof window !== 'undefined' && /iphone|ipad|ipod/i.test(window.navigator.userAgent) && !/crios|fxios|edgios/i.test(window.navigator.userAgent)

export function useInstall() {
  const [, bump] = useState(0)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    const fan = () => bump((count) => count + 1)
    fans.add(fan)
    setInstalled(already())

    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined)

    const done = () => setInstalled(true)
    window.addEventListener('appinstalled', done)

    return () => {
      fans.delete(fan)
      window.removeEventListener('appinstalled', done)
    }
  }, [])

  const run = async () => {
    if (!offer) return false
    await offer.prompt()
    await offer.userChoice.catch(() => undefined)
    return true
  }

  return { ready: Boolean(offer), ios: onApple(), installed, run }
}
