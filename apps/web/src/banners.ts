const LIVE: Record<string, { spot?: string; clips: string[] }> = {
  sharingan: { spot: 'center 45%', clips: ['webm', 'mp4'] },
}

export const isLive = (id: string) => id in LIVE

export const bannerPic = (id: string, medium = false) => `/banners/${id}${medium ? '-md' : ''}.webp`

export const bannerSet = (id: string) => `/banners/${id}-xs.webp 800w, /banners/${id}-sm.webp 1200w, /banners/${id}-md.webp 1600w`

export const BOARD_SIZES = { first: '(max-width: 560px) 100vw, 800px', rest: '(max-width: 560px) 100vw, 400px' }

export const bannerSpot = (id: string) => LIVE[id]?.spot

export const bannerClips = (id: string) =>
  (LIVE[id]?.clips ?? []).map((kind) => ({ src: `/banners/${id}.${kind}`, type: `video/${kind}` }))
