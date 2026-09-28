import { createHash } from 'node:crypto'
import sharp from 'sharp'
import { ZOOM_LEVELS } from '@nanda/game'

const GRID = 32
const JITTER = 0.07
const MAX_SIDE = 900
const CACHE_MAX = 300

const points = new Map<string, { x: number; y: number }>()

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

function keep<T>(store: Map<string, T>, key: string, value: T) {
  store.set(key, value)
  if (store.size > CACHE_MAX) {
    const oldest = store.keys().next().value
    if (oldest !== undefined) store.delete(oldest)
  }
  return value
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

export async function cropPoint(source: Buffer, seed: string) {
  const known = points.get(seed)
  if (known) return known

  const spot = await busiest(source)
  const digest = createHash('sha1').update(seed).digest()
  const shift = (at: number) => (digest.readUInt16BE(at) / 65535) * 2 * JITTER - JITTER

  return keep(points, seed, { x: clamp(spot.x + shift(0), 0, 1), y: clamp(spot.y + shift(2), 0, 1) })
}

export async function cropStage(source: Buffer, seed: string, step: number) {
  const zoom = ZOOM_LEVELS[clamp(step, 0, ZOOM_LEVELS.length - 1)]
  if (zoom <= 1) return source

  const { width = 0, height = 0 } = await sharp(source).metadata()
  if (!width || !height) return source

  const point = await cropPoint(source, seed)
  const box = {
    width: Math.max(24, Math.round(width / zoom)),
    height: Math.max(24, Math.round(height / zoom)),
  }
  const left = clamp(Math.round(point.x * width - box.width / 2), 0, Math.max(0, width - box.width))
  const top = clamp(Math.round(point.y * height - box.height / 2), 0, Math.max(0, height - box.height))

  const piece = sharp(source).extract({ left, top, width: box.width, height: box.height })
  if (Math.max(box.width, box.height) > MAX_SIDE) piece.resize({ width: box.width >= box.height ? MAX_SIDE : undefined, height: box.height > box.width ? MAX_SIDE : undefined })

  return piece.webp({ quality: 82 }).toBuffer()
}
