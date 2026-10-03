export const TIER_FRAMES = ['bronze', 'silver', 'gold', 'diamond'] as const

export const WORLD_FRAMES = ['naruto', 'onepiece', 'aot', 'bleach', 'kny', 'jjk', 'csm', 'bc', 'dn'] as const

export const FRAMES = [...TIER_FRAMES, ...WORLD_FRAMES] as const

export type Frame = (typeof FRAMES)[number]

export const isFrame = (value: unknown): value is Frame => typeof value === 'string' && (FRAMES as readonly string[]).includes(value)
