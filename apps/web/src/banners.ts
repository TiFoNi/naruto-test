import { uiUrl } from './pics'

const LIVE: Record<string, { spot?: string; clips: string[] }> = {
  sharingan: { spot: 'center 45%', clips: ['webm', 'mp4'] },
}

export const isLive = (id: string) => id in LIVE

export const bannerPic = (id: string, medium = false) => uiUrl(`banners/${id}${medium ? '-md' : ''}.webp`)

export const bannerSet = (id: string) => `${uiUrl(`banners/${id}-xs.webp`)} 800w, ${uiUrl(`banners/${id}-sm.webp`)} 1200w, ${uiUrl(`banners/${id}-md.webp`)} 1600w`

export const BOARD_SIZES = { first: '(max-width: 560px) 100vw, 800px', rest: '(max-width: 560px) 100vw, 400px' }

export const bannerSpot = (id: string) => LIVE[id]?.spot

export const bannerClips = (id: string) =>
  (LIVE[id]?.clips ?? []).map((kind) => ({ src: uiUrl(`banners/${id}.${kind}`), type: `video/${kind}` }))
