import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { PUBLIC } from './lib.mjs'

const FOLDER = path.join(PUBLIC, 'frames')
const SIZE = 512
const HOLE = 0.75

function opening(data, info) {
  const { width, height, channels } = info
  const alpha = (x, y) => data[(y * width + x) * channels + 3]
  const row = Math.floor(height / 2)
  const col = Math.floor(width / 2)

  let left = 0
  while (left < width && alpha(left, row) < 40) left++
  while (left < width && alpha(left, row) >= 40) left++
  let right = width - 1
  while (right > 0 && alpha(right, row) < 40) right--
  while (right > 0 && alpha(right, row) >= 40) right--

  let top = 0
  while (top < height && alpha(col, top) < 40) top++
  while (top < height && alpha(col, top) >= 40) top++
  let bottom = height - 1
  while (bottom > 0 && alpha(col, bottom) < 40) bottom--
  while (bottom > 0 && alpha(col, bottom) >= 40) bottom--

  return { left, right, top, bottom }
}

const clear = { r: 0, g: 0, b: 0, alpha: 0 }

for (const file of (await fs.readdir(FOLDER)).filter((name) => name.endsWith('.webp'))) {
  const source = path.join(FOLDER, file)
  const flat = await sharp(source).ensureAlpha().png().toBuffer()
  const { data, info } = await sharp(flat).raw().toBuffer({ resolveWithObject: true })
  const hole = opening(data, info)

  const centerX = (hole.left + hole.right) / 2
  const centerY = (hole.top + hole.bottom) / 2
  const pad = {
    left: Math.max(0, Math.round(info.width - 2 * centerX)),
    right: Math.max(0, Math.round(2 * centerX - info.width)),
    top: Math.max(0, Math.round(info.height - 2 * centerY)),
    bottom: Math.max(0, Math.round(2 * centerY - info.height)),
  }

  const centered = await sharp(flat).extend({ ...pad, background: clear }).png().toBuffer()
  const meta = await sharp(centered).metadata()
  const side = Math.max(meta.width ?? 0, meta.height ?? 0)
  const square = await sharp(centered)
    .extend({
      left: Math.floor((side - (meta.width ?? 0)) / 2),
      right: Math.ceil((side - (meta.width ?? 0)) / 2),
      top: Math.floor((side - (meta.height ?? 0)) / 2),
      bottom: Math.ceil((side - (meta.height ?? 0)) / 2),
      background: clear,
    })
    .png()
    .toBuffer()

  const width = hole.right - hole.left
  const target = Math.round(width / HOLE)
  const grow = Math.max(0, target - side)
  const padded = await sharp(square)
    .extend({ left: Math.floor(grow / 2), right: Math.ceil(grow / 2), top: Math.floor(grow / 2), bottom: Math.ceil(grow / 2), background: clear })
    .resize(SIZE, SIZE, { fit: 'contain', background: clear })
    .webp({ quality: 90 })
    .toBuffer()

  await fs.writeFile(source, padded)

  const check = await sharp(padded).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const after = opening(check.data, check.info)
  console.log(
    `${file.padEnd(14)} отвір ${(((after.right - after.left) / SIZE) * 100).toFixed(1)}% ширини, центр ${(((after.left + after.right) / 2 / SIZE) * 100).toFixed(1)}% / ${(((after.top + after.bottom) / 2 / SIZE) * 100).toFixed(1)}%`,
  )
}
