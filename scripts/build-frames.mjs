import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { PUBLIC, ROOT } from './lib.mjs'

const RAW = path.join(ROOT, '.cache', 'frames')
const OUT = path.join(PUBLIC, 'frames')
const SIDE = 1024
const HARD = 26
const SOFT = 10
const SOLID = 60
const MARGIN = 1.02

const keyOf = (name) => (name.includes('.magenta') ? 'magenta' : name.includes('.fill') ? 'fill' : 'green')

const STEP = 12

function flood(data, width, height) {
  const seen = new Uint8Array(width * height)
  const queue = []
  const push = (x, y) => {
    const spot = y * width + x
    if (seen[spot]) return
    seen[spot] = 1
    queue.push(spot)
  }

  for (let x = 0; x < width; x++) {
    push(x, 0)
    push(x, height - 1)
  }
  for (let y = 0; y < height; y++) {
    push(0, y)
    push(width - 1, y)
  }

  while (queue.length) {
    const spot = queue.pop()
    const at = spot * 4
    data[at + 3] = 0
    const x = spot % width
    const y = (spot - x) / width
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      const next = (ny * width + nx) * 4
      if (seen[ny * width + nx]) continue
      const close = Math.abs(data[next] - data[at]) <= STEP && Math.abs(data[next + 1] - data[at + 1]) <= STEP && Math.abs(data[next + 2] - data[at + 2]) <= STEP
      if (close) push(nx, ny)
    }
  }
}

const lead = (key, r, g, b) => (key === 'magenta' ? Math.min(r, b) - g : g - Math.max(r, b))

const RAYS = 360

function reachOf(data, width, height) {
  const spans = []
  for (let ray = 0; ray < RAYS; ray++) {
    const angle = (ray / RAYS) * Math.PI * 2
    const dx = Math.cos(angle)
    const dy = Math.sin(angle)
    for (let span = 4; span < width; span += 1) {
      const x = Math.round(width / 2 + dx * span)
      const y = Math.round(height / 2 + dy * span)
      if (x < 0 || y < 0 || x >= width || y >= height) break
      if (data[(y * width + x) * 4 + 3] > SOLID) {
        spans.push(span)
        break
      }
    }
  }
  spans.sort((a, b) => a - b)
  return spans[spans.length >> 1] / (width / 2)
}

async function cut(file) {
  const key = keyOf(file)
  const image = sharp(path.join(RAW, file)).ensureAlpha()
  const { width, height } = await image.metadata()
  const { data } = await image.raw().toBuffer({ resolveWithObject: true })

  if (key === 'fill') flood(data, width, height)
  const tint = key === 'magenta' ? 'magenta' : 'green'

  for (let at = 0; at < data.length; at += 4) {
    const r = data[at]
    const g = data[at + 1]
    const b = data[at + 2]
    if (!data[at + 3]) continue
    const spill = lead(tint, r, g, b)
    if (spill > HARD) {
      data[at + 3] = 0
    } else if (spill > SOFT) {
      data[at + 3] = Math.round(255 * (1 - (spill - SOFT) / (HARD - SOFT)))
    }

    const flat = (r + b) / 2
    if (tint === 'magenta') {
      const mid = (g + Math.min(r, b)) / 2
      if (r > mid && b > mid) {
        data[at] = Math.round(mid)
        data[at + 2] = Math.round(mid)
      }
    } else if (g > flat) {
      data[at + 1] = Math.round(flat + (g - flat) * 0.45)
    }
  }

  const id = file.replace(/\.(magenta|green|fill)\.png$/i, '').replace(/\.png$/i, '')
  const target = path.join(OUT, `${id}.webp`)
  const fit = reachOf(data, width, height)

  await sharp(data, { raw: { width, height, channels: 4 } })
    .resize(SIDE, SIDE, { kernel: 'lanczos3' })
    .webp({ quality: 92, alphaQuality: 100, effort: 6 })
    .toFile(target)

  const { size } = await fs.stat(target)
  console.log(`  ${id.padEnd(12)} ${key.padEnd(8)} отвір ${(fit * 100).toFixed(1)}% кадру  ${Math.round(size / 1024)} КБ`)
  return [id, Number(fit.toFixed(4))]
}

await fs.mkdir(OUT, { recursive: true })
const files = (await fs.readdir(RAW).catch(() => [])).filter((name) => name.endsWith('.png'))
if (!files.length) console.log(`поклади згенеровані png у ${path.relative(ROOT, RAW)}`)

const fits = {}
for (const file of files.sort()) {
  const [id, fit] = await cut(file)
  fits[id] = fit
}

const MAP = path.join(ROOT, 'apps', 'web', 'src', 'frames-fit.json')
await fs.writeFile(MAP, `${JSON.stringify(fits, null, 1)}\n`)
console.log(`готово: ${files.length}`)
