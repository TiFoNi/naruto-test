export type CoinPack = { id: string; usd: number; stars: number; base: number; bonus: number; art: string; grow: number }

export const COIN_PACKS: CoinPack[] = [
  { id: 'small', usd: 1.99, stars: 80, base: 250, bonus: 50, art: 'coins-big', grow: 0.78 },
  { id: 'mid', usd: 5.99, stars: 250, base: 1000, bonus: 150, art: 'coins-big', grow: 1 },
  { id: 'big', usd: 17.99, stars: 750, base: 3000, bonus: 500, art: 'coins-big', grow: 1.22 },
]

export const packOf = (id: unknown): CoinPack | null => COIN_PACKS.find((one) => one.id === id) ?? null

export const coinsOf = (pack: CoinPack) => pack.base + pack.bonus

export type PayCoin = { id: string; label: string; note: string }

export const PAY_COINS: PayCoin[] = [
  { id: 'usdttrc20', label: 'USDT', note: 'TRC-20' },
  { id: 'trx', label: 'TRX', note: 'Tron' },
  { id: 'ltc', label: 'LTC', note: 'Litecoin' },
]

export const coinOf = (id: unknown): PayCoin | null => PAY_COINS.find((one) => one.id === id) ?? null

export type PayWay = 'crypto' | 'stars'

export const wayOf = (value: unknown): PayWay | null => (value === 'crypto' || value === 'stars' ? value : null)
