import { uiUrl } from './pics'

const LIVE: Record<string, { spot?: string; clips: string[] }> = {
  sharingan: { spot: 'center 45%', clips: ['webm', 'mp4'] },
}

export const isLive = (id: string) => id in LIVE

export const bannerPic = (id: string, medium = false) => uiUrl(`banners/${id}${medium ? '-md' : ''}.webp`)

export const bannerSet = (id: string) =>
  `${uiUrl(`banners/${id}-xs.webp`)} 800w, ${uiUrl(`banners/${id}-sm.webp`)} 1200w, ${uiUrl(`banners/${id}-md.webp`)} 1600w, ${uiUrl(`banners/${id}.webp`)} 2800w`

const BOARD_WIDTH = { first: 1000, rest: 480 }

export const boardSizes = (first: boolean, zoom = 1) => {
  const scale = Math.max(1, zoom)
  return `(max-width: 560px) ${Math.round(100 * scale)}vw, ${Math.round(BOARD_WIDTH[first ? 'first' : 'rest'] * scale)}px`
}

export const bannerSpot = (id: string) => LIVE[id]?.spot

export const bannerClips = (id: string) =>
  (LIVE[id]?.clips ?? []).map((kind) => ({ src: uiUrl(`banners/${id}.${kind}`), type: `video/${kind}` }))
