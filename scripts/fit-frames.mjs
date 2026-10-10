import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { PUBLIC } from './lib.mjs'

const FOLDER = path.join(PUBLIC, 'frames')
const SIZE = 768
const PALE = Number(process.argv.find((one) => one.startsWith('--pale='))?.slice(7) ?? 232)
const EDGE_PASSES = 3
const INK = 16
const HUG = 0.88
const KEEP = 0.76
const MAP = path.join(PUBLIC, '..', 'src', 'frames-fit.json')

async function cutout(file) {
  const flat = await sharp(file).ensureAlpha().png().toBuffer()
  const { data, info } = await sharp(flat).raw().toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info

  let clear = false
  for (let at = 0; at < width * height && !clear; at++) if (data[at * channels + 3] < 250) clear = true
  if (clear) return flat

  const pale = (at) => {
    const r = data[at * channels]
    const g = data[at * channels + 1]
    const b = data[at * channels + 2]
    return Math.min(r, g, b) >= PALE && Math.max(r, g, b) - Math.min(r, g, b) < 14
  }

  const seen = new Uint8Array(width * height)
  const stack = []
  for (let x = 0; x < width; x++) stack.push(x, (height - 1) * width + x)
  for (let y = 0; y < height; y++) stack.push(y * width, y * width + width - 1)
  stack.push(Math.floor(height / 2) * width + Math.floor(width / 2))

  while (stack.length) {
    const at = stack.pop()
    if (seen[at] || !pale(at)) continue
    seen[at] = 1
    const x = at % width
    const y = (at - x) / width
    if (x > 0) stack.push(at - 1)
    if (x < width - 1) stack.push(at + 1)
    if (y > 0) stack.push(at - width)
    if (y < height - 1) stack.push(at + width)
  }

  const faded = (at) => {
    const r = data[at * channels]
    const g = data[at * channels + 1]
    const b = data[at * channels + 2]
    return Math.min(r, g, b) >= PALE - 46 && Math.max(r, g, b) - Math.min(r, g, b) < 26
  }

  for (let pass = 0; pass < EDGE_PASSES; pass++) {
    const grown = []
    for (let at = 0; at < width * height; at++) {
      if (seen[at] || !faded(at)) continue
      const x = at % width
      const y = (at - x) / width
      const touches =
        (x > 0 && seen[at - 1]) || (x < width - 1 && seen[at + 1]) || (y > 0 && seen[at - width]) || (y < height - 1 && seen[at + width])
      if (touches) grown.push(at)
    }
    if (!grown.length) break
    for (const at of grown) seen[at] = 1
  }

  for (let at = 0; at < width * height; at++) if (seen[at]) data[at * channels + 3] = 0

  return sharp(data, { raw: { width, height, channels } }).png().toBuffer()
}

function hole(data, info) {
  const { width, height, channels } = info
  const clear = (x, y) => data[(y * width + x) * channels + 3] < 60
  const middle = (list) => list.sort((a, b) => a - b)[Math.floor(list.length / 2)]

  const centerX = Math.floor(width / 2)
  const centerY = Math.floor(height / 2)

  const lefts = []
  const rights = []
  for (let step = -6; step <= 6; step++) {
    const y = centerY + Math.round((step * height) / 40)
    if (y < 0 || y >= height || !clear(centerX, y)) continue
    let left = centerX
    while (left > 0 && clear(left - 1, y)) left--
    let right = centerX
    while (right < width - 1 && clear(right + 1, y)) right++
    lefts.push(left)
    rights.push(right)
  }

  const tops = []
  const bottoms = []
  for (let step = -6; step <= 6; step++) {
    const x = centerX + Math.round((step * width) / 40)
    if (x < 0 || x >= width || !clear(x, centerY)) continue
    let top = centerY
    while (top > 0 && clear(x, top - 1)) top--
    let bottom = centerY
    while (bottom < height - 1 && clear(x, bottom + 1)) bottom++
    tops.push(top)
    bottoms.push(bottom)
  }

  return {
    left: lefts.length ? middle(lefts) : 0,
    right: rights.length ? middle(rights) : width - 1,
    top: tops.length ? middle(tops) : 0,
    bottom: bottoms.length ? middle(bottoms) : height - 1,
  }
}

const clear = { r: 0, g: 0, b: 0, alpha: 0 }

const sources = process.argv.slice(2).filter((one) => !one.startsWith('--'))
if (sources.length) await fs.mkdir(FOLDER, { recursive: true })

const onlyMap = process.argv.includes('--map')

const files = onlyMap
  ? []
  : sources.length
  ? sources.map((one) => { const [from, name] = one.split('='); return { from, name: `${name ?? path.basename(from).split('.')[0]}.webp` } })
  : (await fs.readdir(FOLDER)).filter((name) => name.endsWith('.webp')).map((name) => ({ from: path.join(FOLDER, name), name }))

function inked(data, info) {
  const { width, height, channels } = info
  let left = width
  let right = -1
  let top = height
  let bottom = -1

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * channels + 3] < INK) continue
      if (x < left) left = x
      if (x > right) right = x
      if (y < top) top = y
      if (y > bottom) bottom = y
    }
  }

  return right < 0 ? { left: 0, top: 0, right: width - 1, bottom: height - 1 } : { left, top, right, bottom }
}

for (const { from, name } of files) {
  const flat = await cutout(from)
  const { data, info } = await sharp(flat).raw().toBuffer({ resolveWithObject: true })
  const art = inked(data, info)

  const width = art.right - art.left + 1
  const height = art.bottom - art.top + 1
  const side = Math.max(width, height)

  const square = await sharp(flat)
    .extract({ left: art.left, top: art.top, width, height })
    .extend({
      left: Math.floor((side - width) / 2),
      right: Math.ceil((side - width) / 2),
      top: Math.floor((side - height) / 2),
      bottom: Math.ceil((side - height) / 2),
      background: clear,
    })
    .png()
    .toBuffer()

  const fitted = await sharp(square).resize(SIZE, SIZE, { fit: 'fill' }).webp({ quality: 90 }).toBuffer()
  await fs.writeFile(path.join(FOLDER, name), fitted)

  const check = await sharp(fitted).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const after = hole(check.data, check.info)
  console.log(
    `${name.padEnd(14)} отвір ${(((after.right - after.left) / SIZE) * 100).toFixed(1)}% × ${(((after.bottom - after.top) / SIZE) * 100).toFixed(1)}%`,
  )
}

const round = (value) => Math.round(value * 1000) / 1000

const insets = {}
for (const name of (await fs.readdir(FOLDER)).filter((one) => one.endsWith('.webp')).sort()) {
  const shot = await sharp(path.join(FOLDER, name)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const gap = hole(shot.data, shot.info)
  const across = (gap.right - gap.left) / shot.info.width
  const down = (gap.bottom - gap.top) / shot.info.height
  const snug = (HUG / across - 1) / 2
  const safe = (KEEP / down - 1) / 2

  const pad = Math.min(0.3, Math.max(0.04, snug, safe))

  insets[name.replace('.webp', '')] = {
    pad: round(pad),
    x: round(0.5 - (gap.left + gap.right) / 2 / shot.info.width),
    y: round(0.5 - (gap.top + gap.bottom) / 2 / shot.info.height),
  }
}

await fs.writeFile(MAP, `${JSON.stringify(insets, null, 2)}\n`)
console.log(
  `посадка рамок: ${Object.entries(insets)
    .map(([id, one]) => `${id} ${(one.pad * 100).toFixed(0)}%${one.y ? ` ${one.y > 0 ? '↓' : '↑'}${Math.abs(one.y * 100).toFixed(0)}%` : ''}`)
    .join(', ')}`,
)
