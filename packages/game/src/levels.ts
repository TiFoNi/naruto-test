export const LEVEL_BIG = 10
export const LEVEL_MID = 5
export const LEVEL_LAST = 300

export const levelCoins = (level: number) => {
  if (!Number.isInteger(level) || level < 1 || level > LEVEL_LAST) return 0
  const step = level <= 100 ? 100 : level <= 200 ? 200 : 300
  return level % LEVEL_BIG === 0 ? step : level % LEVEL_MID === 0 ? step / 4 : 0
}
