import type { BannerLook } from '@nanda/game'
import { uiUrl } from './pics'

const LIVE: Record<string, { spot?: string; clips: string[] }> = {
  sharingan: { spot: 'center 45%', clips: ['webm', 'mp4'] },
  lotus: { clips: ['webm', 'mp4'] },
  clouds: { clips: ['webm', 'mp4'] },
  byakugan: { clips: ['webm', 'mp4'] },
}

export const isLive = (id: string) => id in LIVE

const REDRAWN: Record<string, number> = { blockhome: 3, moonvortex: 3, moonfield: 2, ronaldo: 2, castle: 3, poppies: 3, pain: 3, levelup: 3, snakes: 3, glowmeadow: 2 }

const SPOTS: Record<string, string> = { moonfield: 'center 88%' }

const file = (id: string, suffix = '', kind = 'webp') => uiUrl(`banners/${id}${suffix}.${kind}${REDRAWN[id] ? `?v=${REDRAWN[id]}` : ''}`)

export const bannerPic = (id: string, medium = false) => file(id, medium ? '-md' : '')

export const bannerSet = (id: string) =>
  `${file(id, '-xs')} 800w, ${file(id, '-sm')} 1200w, ${file(id, '-md')} 1600w, ${file(id)} 2800w`

const BOARD_WIDTH = { first: 1000, rest: 480 }

export const boardSizes = (first: boolean, zoom = 1) => {
  const scale = Math.max(1, zoom)
  return `(max-width: 560px) ${Math.round(100 * scale)}vw, ${Math.round(BOARD_WIDTH[first ? 'first' : 'rest'] * scale)}px`
}

export const bannerSpot = (id: string) => LIVE[id]?.spot ?? SPOTS[id]

const SPOT_WORDS: Record<string, number> = { left: 0, top: 0, center: 50, right: 100, bottom: 100 }

const spotPart = (part: string | undefined, fallback: number) => {
  if (!part) return fallback
  if (part in SPOT_WORDS) return SPOT_WORDS[part]!
  const value = parseFloat(part)
  return Number.isFinite(value) ? value : fallback
}

export const spotLook = (id: string): BannerLook => {
  const [x, y] = (bannerSpot(id) ?? '50% 28%').trim().split(/\s+/)
  return { x: spotPart(x, 50), y: spotPart(y, 28), z: 1 }
}

export const bannerClips = (id: string) =>
  (LIVE[id]?.clips ?? []).map((kind) => ({ src: file(id, '', kind), type: `video/${kind}` }))
