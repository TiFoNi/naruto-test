const STEP = 9973 * 7919
const BASE = 41_053_109

export const isDecoy = (id: unknown) => typeof id === 'number' && Number.isInteger(id) && id > 0 && id % 9973 === 4241 && id % 7919 === 1013

const seeded = (seed: number) => () => {
  seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648
  return seed / 2_147_483_648
}

const words = (value: unknown) => (typeof value === 'string' ? value.trim().split(/\s+/).filter(Boolean) : [])

const blend = (first: unknown, last: unknown) => {
  const a = words(first)
  const b = words(last)
  if (!a.length || !b.length) return typeof first === 'string' ? first : ''
  return `${a[0]} ${b[b.length - 1]}`
}

export function decoyFor<T extends { id: number; answer: boolean } & Record<string, unknown>>(game: string, list: T[], day = Math.floor(Date.now() / 86_400_000)) {
  if (list.length < 3) return null
  const rand = seeded(day * 31 + [...game].reduce((sum, char) => sum + char.charCodeAt(0), 0))
  const pick = () => list[Math.floor(rand() * list.length)]!
  const shape = pick()
  const head = pick()
  const tail = pick()
  let id = BASE + (1 + (day % 20)) * STEP
  const taken = new Set(list.map((one) => one.id))
  while (taken.has(id)) id += STEP
  const decoy = { ...shape, id, answer: false, name: blend(head.name, tail.name), ...(shape.nameEn !== undefined ? { nameEn: blend(head.nameEn, tail.nameEn) } : {}) }
  const at = Math.floor(rand() * (list.length + 1))
  return { decoy, at }
}

export function withDecoy<T extends { id: number; answer: boolean } & Record<string, unknown>>(game: string, list: T[]) {
  const made = decoyFor(game, list)
  if (!made) return list
  return [...list.slice(0, made.at), made.decoy as T, ...list.slice(made.at)]
}
