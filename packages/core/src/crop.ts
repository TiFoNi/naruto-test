import { createHash } from 'node:crypto'
import sharp from 'sharp'
import { GAME_SPECS, ZOOM_LEVELS, type GameId } from '@nanda/game'
import type { DuelDoc, RoundDoc } from './db'
import { gameData } from './games'

const GRID = 32
const JITTER = 0.07
const DIM = 0.22
const CACHE_MAX = 300
const SOURCE_MAX = 60

const points = new Map<string, { x: number; y: number }>()
const sources = new Map<string, Promise<Buffer | null>>()

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

export const roundSeed = (round: RoundDoc) =>
  round.daily
    ? `daily:${round.daily}:${round.game}:${round.mode}:${round.answerId}`
    : round.challenge
      ? `challenge:${round.challenge}:${round.answerId}`
      : `round:${String(round._id)}`

export const duelSeed = (duel: DuelDoc) => `duel:${duel.code}:${duel.round}:${duel.answerId}`

function keep<T>(store: Map<string, T>, key: string, value: T, limit: number) {
  store.set(key, value)
  if (store.size > limit) {
    const oldest = store.keys().next().value
    if (oldest !== undefined) store.delete(oldest)
  }
  return value
}

export async function imageBuffer(game: GameId, answerId: number) {
  const key = `${game}:${answerId}`
  const known = sources.get(key)
  if (known) return known

  const pics = process.env.PICS_URL?.replace(/\/+$/, '') ?? ''
  const entity = (await gameData(game)).byId.get(answerId)
  const tag = typeof entity?.image === 'string' ? `?v=${entity.image}` : ''
  const url = `${pics}/${GAME_SPECS[game].images}/full/${answerId}.webp${tag}`

  const pending = fetch(url)
    .then(async (response) => (response.ok ? Buffer.from(await response.arrayBuffer()) : null))
    .catch(() => null)

  keep(sources, key, pending, SOURCE_MAX)
  const buffer = await pending
  if (!buffer) sources.delete(key)
  return buffer
}

async function busiest(source: Buffer) {
  const { data } = await sharp(source).greyscale().resize(GRID, GRID, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true })

  const energy = new Float64Array(GRID * GRID)
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const at = y * GRID + x
      const right = x + 1 < GRID ? data[at + 1] : data[at]
      const below = y + 1 < GRID ? data[at + GRID] : data[at]
      energy[at] = Math.abs(data[at] - right) + Math.abs(data[at] - below)
    }
  }

  const side = Math.max(2, Math.round(GRID / ZOOM_LEVELS[0]))
  let best = { x: 0.5, y: 0.5, score: -1 }
  for (let y = 0; y + side <= GRID; y++) {
    for (let x = 0; x + side <= GRID; x++) {
      let score = 0
      for (let dy = 0; dy < side; dy++) {
        for (let dx = 0; dx < side; dx++) score += energy[(y + dy) * GRID + x + dx]
      }
      if (score > best.score) best = { x: (x + side / 2) / GRID, y: (y + side / 2) / GRID, score }
    }
  }

  return { x: best.x, y: best.y }
}

export async function focusOf(source: Buffer, seed: string) {
  const known = points.get(seed)
  if (known) return known

  const spot = await busiest(source)
  const digest = createHash('sha1').update(seed).digest()
  const shift = (at: number) => (digest.readUInt16BE(at) / 65535) * 2 * JITTER - JITTER

  return keep(points, seed, { x: clamp(spot.x + shift(0), 0.12, 0.88), y: clamp(spot.y + shift(2), 0.12, 0.88) }, CACHE_MAX)
}

export async function focusFor(game: GameId, answerId: number, seed: string) {
  const known = points.get(seed)
  if (known) return known
  const source = await imageBuffer(game, answerId)
  return source ? focusOf(source, seed) : { x: 0.5, y: 0.5 }
}

export function windowAt(width: number, height: number, focus: { x: number; y: number }, zoom: number) {
  const side = Math.max(24, Math.round(Math.max(width, height) / zoom))
  const box = { width: Math.min(side, width), height: Math.min(side, height) }
  const middle = { x: focus.x + (0.5 - focus.x) / zoom, y: focus.y + (0.5 - focus.y) / zoom }
  return {
    ...box,
    left: clamp(Math.round(middle.x * width - box.width / 2), 0, Math.max(0, width - box.width)),
    top: clamp(Math.round(middle.y * height - box.height / 2), 0, Math.max(0, height - box.height)),
  }
}

export async function maskStage(source: Buffer, seed: string, step: number) {
  const zoom = ZOOM_LEVELS[clamp(step, 0, ZOOM_LEVELS.length - 1)]
  if (zoom <= 1) return source

  const { width = 0, height = 0 } = await sharp(source).metadata()
  if (!width || !height) return source

  const focus = await focusOf(source, seed)
  const box = windowAt(width, height, focus, zoom)
  const sigma = Math.max(16, Math.round(Math.min(width, height) / 9))

  const [hidden, shown] = await Promise.all([
    sharp(source).blur(sigma).modulate({ brightness: DIM }).toBuffer(),
    sharp(source).extract(box).toBuffer(),
  ])

  return sharp(hidden)
    .composite([{ input: shown, left: box.left, top: box.top }])
    .webp({ quality: 82 })
    .toBuffer()
}
