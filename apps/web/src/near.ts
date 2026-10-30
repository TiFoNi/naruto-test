'use client'

import { useEffect, useRef, useState } from 'react'

const MARGIN = '900px 0px'

const listeners = new WeakMap<Element, (near: boolean) => void>()
let watcher: IntersectionObserver | null = null

const observer = () =>
  (watcher ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) listeners.get(entry.target)?.(entry.isIntersecting)
    },
    { rootMargin: MARGIN },
  ))

export function useNear<T extends Element>() {
  const ref = useRef<T>(null)
  const [near, setNear] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (typeof IntersectionObserver === 'undefined') return setNear(true)
    listeners.set(node, setNear)
    observer().observe(node)
    return () => {
      observer().unobserve(node)
      listeners.delete(node)
    }
  }, [])

  return [ref, near] as const
}
