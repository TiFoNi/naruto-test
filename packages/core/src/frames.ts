export const FRAMES = ['bronze', 'silver', 'gold', 'diamond'] as const

export type Frame = (typeof FRAMES)[number]

export const isFrame = (value: unknown): value is Frame => typeof value === 'string' && (FRAMES as readonly string[]).includes(value)
