import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { PUBLIC } from './lib.mjs'

const FOLDER = path.join(PUBLIC, 'frames')
const SIZE = 512
const HOLE = 0.78

function hole(data, info) {
  const { width, height, channels } = info
  const clearAt = (at) => data[at * channels + 3] < 60

  const outside = new Uint8Array(width * height)
  const stack = []
  for (let x = 0; x < width; x++) {
    stack.push(x, (height - 1) * width + x)
  }
  for (let y = 0; y < height; y++) {
    stack.push(y * width, y * width + width - 1)
  }

  while (stack.length) {
    const at = stack.pop()
    if (outside[at] || !clearAt(at)) continue
    outside[at] = 1
    const x = at % width
    const y = (at - x) / width
    if (x > 0) stack.push(at - 1)
    if (x < width - 1) stack.push(at + 1)
    if (y > 0) stack.push(at - width)
    if (y < height - 1) stack.push(at + width)
  }

  let left = width
  let right = 0
  let top = height
  let bottom = 0
  for (let at = 0; at < width * height; at++) {
    if (outside[at] || !clearAt(at)) continue
    const x = at % width
    const y = (at - x) / width
    if (x < left) left = x
    if (x > right) right = x
    if (y < top) top = y
    if (y > bottom) bottom = y
  }

  return { left, right, top, bottom }
}

const clear = { r: 0, g: 0, b: 0, alpha: 0 }

const sources = process.argv.slice(2)
if (sources.length) await fs.mkdir(FOLDER, { recursive: true })

const files = sources.length
  ? sources.map((one) => { const [from, name] = one.split('='); return { from, name: `${name ?? path.basename(from).split('.')[0]}.webp` } })
  : (await fs.readdir(FOLDER)).filter((name) => name.endsWith('.webp')).map((name) => ({ from: path.join(FOLDER, name), name }))

for (const { from, name } of files) {
  const flat = await sharp(from).ensureAlpha().png().toBuffer()
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
