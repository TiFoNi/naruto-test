import { useCallback, useEffect, useRef, useState } from 'react'
import { api, apiMode, apiUrl } from './api'
import { deviceId, deviceName } from './device'
import type { PlaySpot } from './playLock'
import { watchPlayPush } from './roundPush'

const BEAT_MS = 30_000

export type DeviceSpot = PlaySpot & { name: string | null }
export type DeviceLockState = 'pending' | 'held' | 'blocked'

export function useDeviceLock(spot: PlaySpot, enabled: boolean) {
  const [state, setState] = useState<DeviceLockState>('pending')
  const [other, setOther] = useState<DeviceSpot | null>(null)
  const spotRef = useRef(spot)
  spotRef.current = spot
  const held = useRef(false)
  const asking = useRef(false)

  const hold = useCallback(async (take = false) => {
    const device = deviceId()
    if (!device) return setState('held')
    if (asking.current && !take) return
    asking.current = true
    try {
      const { ok, data } = await api<{ state: string; other?: DeviceSpot }>('play/hold', {
        ...spotRef.current,
        device,
        deviceName: deviceName(),
        ...(take ? { take: true } : {}),
      })
      if (ok && data.state === 'blocked') {
        held.current = false
        setOther(data.other ?? null)
        setState('blocked')
      } else {
        held.current = ok
        setOther(null)
        setState('held')
      }
    } catch {
      setState((was) => (was === 'pending' ? 'held' : was))
    } finally {
      asking.current = false
    }
  }, [])

  const key = `${spot.game}:${spot.mode}:${spot.daily}`

  useEffect(() => {
    if (!enabled) return
    void hold()
  }, [enabled, key, hold])

  useEffect(() => {
    if (!enabled) return
    const check = () => document.visibilityState === 'visible' && void hold()
    const timer = setInterval(check, BEAT_MS)
    const stop = watchPlayPush((push) => {
      if (push.device !== deviceId()) void hold()
    })
    document.addEventListener('visibilitychange', check)
    window.addEventListener('focus', check)
    return () => {
      clearInterval(timer)
      stop()
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('focus', check)
    }
  }, [enabled, hold])

  useEffect(() => {
    if (!enabled) return
    const leave = () => {
      const device = deviceId()
      if (!held.current || !device) return
      held.current = false
      void fetch(apiUrl('play/hold'), {
        method: 'POST',
        keepalive: true,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ device, leave: true }),
        credentials: apiMode(),
      }).catch(() => undefined)
    }
    window.addEventListener('pagehide', leave)
    return () => {
      window.removeEventListener('pagehide', leave)
      leave()
    }
  }, [enabled])

  const take = useCallback(() => void hold(true), [hold])

  return { state: enabled ? state : ('held' as const), other, take }
}
