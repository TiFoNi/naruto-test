export const TOP_FRAME = 'top10'

export const TOP_PLACES = 10

export const AWARD_FRAMES = [TOP_FRAME] as const

export const WORLD_FRAMES = ['berserk', 'ff', 'naruto', 'onepiece', 'bleach', 'kny'] as const

export const FRAMES = [...AWARD_FRAMES, ...WORLD_FRAMES] as const

export type Frame = (typeof FRAMES)[number]

export const isFrame = (value: unknown): value is Frame => typeof value === 'string' && (FRAMES as readonly string[]).includes(value)
