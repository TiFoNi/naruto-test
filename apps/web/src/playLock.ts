import { useCallback, useEffect, useRef, useState } from 'react'

const LOCK = 'nanda-play'
const WHERE = 'nanda-play-where'

export type PlaySpot = { game: string; mode: string; daily: boolean }
export type PlayLockState = 'pending' | 'held' | 'blocked'

const readSpot = (): PlaySpot | null => {
  try {
    return JSON.parse(localStorage.getItem(WHERE) ?? 'null')
  } catch {
    return null
  }
}

const writeSpot = (spot: PlaySpot) => {
  try {
    localStorage.setItem(WHERE, JSON.stringify(spot))
  } catch {}
}

const supported = () => typeof navigator !== 'undefined' && 'locks' in navigator

export function usePlayLock(spot: PlaySpot) {
  const [state, setState] = useState<PlayLockState>('pending')
  const [other, setOther] = useState<PlaySpot | null>(null)
  const spotRef = useRef(spot)
  spotRef.current = spot
  const held = useRef(false)
  const release = useRef<(() => void) | null>(null)
  const waiting = useRef<AbortController | null>(null)
  const alive = useRef(true)

  const block = useCallback(() => {
    setOther(readSpot())
    setState('blocked')
  }, [])

  const grant = useCallback(() => {
    if (!alive.current) return
    held.current = true
    writeSpot(spotRef.current)
    setState('held')
    return new Promise<void>((resolve) => {
      release.current = resolve
    })
  }, [])

  const queue = useCallback(() => {
    const control = new AbortController()
    waiting.current = control
    navigator.locks.request(LOCK, { signal: control.signal }, grant).then(
      () => undefined,
      () => {
        if (!alive.current || control.signal.aborted) return
        held.current = false
        release.current = null
        block()
        queue()
      },
    )
    void navigator.locks.query().then((snapshot) => {
      if (alive.current && !held.current && snapshot.held?.some((lock) => lock.name === LOCK)) block()
    })
  }, [grant, block])

  const take = useCallback(() => {
    if (!supported()) return
    waiting.current?.abort()
    const control = new AbortController()
    waiting.current = control
    navigator.locks.request(LOCK, { steal: true }, grant).then(
      () => undefined,
      () => {
        if (!alive.current || control.signal.aborted) return
        held.current = false
        release.current = null
        block()
        queue()
      },
    )
  }, [grant, block, queue])

  useEffect(() => {
    if (!supported()) return setState('held')
    alive.current = true
    queue()
    const onStorage = (event: StorageEvent) => {
      if (event.key === WHERE && !held.current) setOther(readSpot())
    }
    window.addEventListener('storage', onStorage)
    return () => {
      alive.current = false
      held.current = false
      waiting.current?.abort()
      release.current?.()
      release.current = null
      window.removeEventListener('storage', onStorage)
    }
  }, [queue])

  const key = `${spot.game}:${spot.mode}:${spot.daily}`
  useEffect(() => {
    if (state === 'held') writeSpot(spotRef.current)
  }, [key, state])

  return { state, other, take }
}
