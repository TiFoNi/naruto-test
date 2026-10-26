'use client'

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

export const STAGE_WIDTH = 1120

export const STAGE_RATIO = 3.85

export const STAGE_HEIGHT = STAGE_WIDTH / STAGE_RATIO

export const STAGE_MIN = 145

const PHONE_SCREEN = 390

const PHONE_MAX = 620

const gutter = (screen: number) => Math.min(34, Math.max(20, screen * 0.034))

const ratioOn = (screen: number, low: number) => (screen - gutter(screen) * 2) / low

export function usePhoneRatio(low: number) {
  const [ratio, setRatio] = useState(() => ratioOn(PHONE_SCREEN, low))

  useEffect(() => {
    const sync = () => setRatio(ratioOn(window.innerWidth <= PHONE_MAX ? window.innerWidth : PHONE_SCREEN, low))
    sync()
    window.addEventListener('resize', sync)
    return () => window.removeEventListener('resize', sync)
  }, [low])

  return ratio
}

const BOOST_MAX = 1.1

const TEXT_MAX = 1.68

export default function ProfileStage({ art, children }: { art: ReactNode; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const node = box.current
    if (!node || typeof ResizeObserver === 'undefined') return
    const fit = () => {
      const wide = node.clientWidth
      const scale = Math.max(wide / STAGE_RATIO, STAGE_MIN) / STAGE_HEIGHT
      node.style.setProperty('--stage-scale', String(scale))
      node.style.setProperty('--stage-width', `${wide / scale}px`)
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
