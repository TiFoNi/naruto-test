'use client'

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

export const STAGE_WIDTH = 1120

export const STAGE_RATIO = 3.85

const BOOST_MAX = 1.1

const TEXT_MAX = 1.68

export default function ProfileStage({ art, children }: { art: ReactNode; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const node = box.current
    if (!node || typeof ResizeObserver === 'undefined') return
    const fit = () => {
      const scale = node.clientWidth / STAGE_WIDTH
      node.style.setProperty('--stage-scale', String(scale))
      const boost = Math.min(BOOST_MAX, scale < 1 ? scale ** -0.35 : 1)
      const text = Math.min(TEXT_MAX, scale < 1 ? scale ** -0.7 : 1)
      node.style.setProperty('--stage-boost', String(boost))
      node.style.setProperty('--stage-text', String(text / boost))
    }
    fit()
    const watch = new ResizeObserver(fit)
    watch.observe(node)
    return () => watch.disconnect()
  }, [])

  return (
    <div className="profile-stage" ref={box}>
      <div className="profile-canvas">
        {art}
        <div className="profile-hero-body is-canvas">{children}</div>
      </div>
    </div>
  )
}

const NARROW = '(max-width: 900px)'

export function useNarrow() {
  const [narrow, setNarrow] = useState(false)

  useEffect(() => {
    const query = window.matchMedia(NARROW)
    const sync = () => setNarrow(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  return narrow
}
