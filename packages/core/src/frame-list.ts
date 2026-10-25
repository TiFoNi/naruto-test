export const PLACE_FRAMES = ['top1'] as const

export const SEASON_FRAMES: Record<number, string> = { 5: 'cosmos' }

export const championFrame = (season: number) => SEASON_FRAMES[season] ?? PLACE_FRAMES[0]

export const AWARD_FRAMES = [...PLACE_FRAMES, 'cosmos'] as const

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
  'dn',
  'hxh',
  'jojo',
] as const

export const NATURE_FRAMES = ['pond', 'maple', 'crows', 'blossom', 'fireflies'] as const

export const OTHER_FRAMES = ['top10'] as const

export const FRAMES = [...AWARD_FRAMES, ...WORLD_FRAMES, ...NATURE_FRAMES, ...OTHER_FRAMES] as const

export type Frame = (typeof FRAMES)[number]

export const isFrame = (value: unknown): value is Frame => typeof value === 'string' && (FRAMES as readonly string[]).includes(value)
