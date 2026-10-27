import { LEVEL_CHAPTER, LEVEL_LAST, levelCoins } from '@nanda/game'

export type RewardKind = 'coins' | 'pile' | 'title' | 'avatar' | 'frame' | 'banner' | 'chest'

export type Tier = 'bronze' | 'silver' | 'gold' | 'legend' | 'mythic' | 'secret'

export type Reward = { level: number; kind: RewardKind; coins: number; tier: Tier }

export const CHAPTER = LEVEL_CHAPTER

export const CHAPTERS = Math.ceil(LEVEL_LAST / CHAPTER)

const TIERS: Tier[] = ['bronze', 'silver', 'gold', 'legend', 'mythic', 'secret']

const SPOTS: Record<number, RewardKind> = {
  5: 'pile',
  10: 'avatar',
  15: 'pile',
  20: 'title',
  25: 'frame',
  30: 'avatar',
  35: 'pile',
  40: 'banner',
  45: 'pile',
  50: 'chest',
}


export function rewardAt(level: number): Reward {
  const chapter = Math.floor((level - 1) / CHAPTER)
  const spot = level - chapter * CHAPTER
  const kind = SPOTS[spot] ?? 'coins'
  const tier = TIERS[Math.min(chapter, TIERS.length - 1)]!
  const coins = levelCoins(level)
  return { level, kind, coins, tier }
}

export const chapterOf = (index: number) => {
  const from = index * CHAPTER + 1
  const to = Math.min(LEVEL_LAST, from + CHAPTER - 1)
  return { index, from, to, tier: TIERS[Math.min(index, TIERS.length - 1)]!, rewards: Array.from({ length: to - from + 1 }, (_, one) => rewardAt(from + one)) }
}
