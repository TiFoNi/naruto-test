import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { PUBLIC } from './lib.mjs'

const FOLDER = path.join(PUBLIC, 'frames')
const SIZE = 512
const HOLE = 0.78

async function cutout(file) {
  const meta = await sharp(file).metadata()
  const flat = await sharp(file).ensureAlpha().png().toBuffer()
  if (meta.hasAlpha) return flat

  const { data, info } = await sharp(flat).raw().toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info
  const pale = (at) => {
    const r = data[at * channels]
    const g = data[at * channels + 1]
    const b = data[at * channels + 2]
    return Math.min(r, g, b) > 232 && Math.max(r, g, b) - Math.min(r, g, b) < 14
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

const sources = process.argv.slice(2)
if (sources.length) await fs.mkdir(FOLDER, { recursive: true })

const files = sources.length
  ? sources.map((one) => { const [from, name] = one.split('='); return { from, name: `${name ?? path.basename(from).split('.')[0]}.webp` } })
  : (await fs.readdir(FOLDER)).filter((name) => name.endsWith('.webp')).map((name) => ({ from: path.join(FOLDER, name), name }))

for (const { from, name } of files) {
  const flat = await cutout(from)
  const { data, info } = await sharp(flat).raw().toBuffer({ resolveWithObject: true })
  const box = hole(data, info)

  const centerX = (box.left + box.right) / 2
  const centerY = (box.top + box.bottom) / 2
  const centered = await sharp(flat)
    .extend({
      left: Math.max(0, Math.round(info.width - 2 * centerX)),
      right: Math.max(0, Math.round(2 * centerX - info.width)),
      top: Math.max(0, Math.round(info.height - 2 * centerY)),
      bottom: Math.max(0, Math.round(2 * centerY - info.height)),
      background: clear,
    })
    .png()
    .toBuffer()

  const meta = await sharp(centered).metadata()
  const side = Math.max(meta.width ?? 0, meta.height ?? 0)
  const wide = Math.max(box.right - box.left, box.bottom - box.top)
  const want = Math.max(side, Math.round(wide / HOLE))

  const padded = await sharp(centered)
    .extend({
      left: Math.round((want - (meta.width ?? 0)) / 2),
      right: Math.round((want - (meta.width ?? 0)) / 2),
      top: Math.round((want - (meta.height ?? 0)) / 2),
      bottom: Math.round((want - (meta.height ?? 0)) / 2),
      background: clear,
    })
    .png()
    .toBuffer()

  const fitted = await sharp(padded).resize(SIZE, SIZE, { fit: 'fill' }).webp({ quality: 90 }).toBuffer()

  await fs.writeFile(path.join(FOLDER, name), fitted)

  const check = await sharp(fitted).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const after = hole(check.data, check.info)
  console.log(
    `${name.padEnd(14)} отвір ${(((after.right - after.left) / SIZE) * 100).toFixed(1)}% × ${(((after.bottom - after.top) / SIZE) * 100).toFixed(1)}%, центр ${(((after.left + after.right) / 2 / SIZE) * 100).toFixed(1)} / ${(((after.top + after.bottom) / 2 / SIZE) * 100).toFixed(1)}`,
  )
}
