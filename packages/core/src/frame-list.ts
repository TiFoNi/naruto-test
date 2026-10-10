export const PLACE_FRAMES = ['top1', 'top2', 'top3'] as const

export const TOP_PLACES = PLACE_FRAMES.length

export const AWARD_FRAMES = PLACE_FRAMES

export const WORLD_FRAMES = [
  'berserk',
  'ff',
  'naruto',
  'onepiece',
  'bleach',
  'kny',
  'aot',
  'jjk',
  'csm',
  'tg',
  'hxh',
  'jojo',
] as const

export const OTHER_FRAMES = ['top10'] as const

export const FRAMES = [...AWARD_FRAMES, ...WORLD_FRAMES, ...OTHER_FRAMES] as const

export type Frame = (typeof FRAMES)[number]

export const isFrame = (value: unknown): value is Frame => typeof value === 'string' && (FRAMES as readonly string[]).includes(value)
