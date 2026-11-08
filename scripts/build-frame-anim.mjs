import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { PUBLIC } from './lib.mjs'

const OUT = path.join(PUBLIC, 'frames')
const STILL_SIZES = [
  { suffix: '', side: 1024, animated: false, quality: 92 },
  { suffix: '-md', side: 512, animated: false, quality: 92 },
  { suffix: '-sm', side: 192, animated: false, quality: 90 },
]
const SIZES = [
  { suffix: '', side: 512, animated: true, quality: 80 },
  { suffix: '-md', side: 256, animated: true, quality: 80 },
  { suffix: '-sm', side: 192, animated: false, quality: 90 },
  { suffix: '-xs', side: 128, animated: true, quality: 80 },
]
const FLOOR = 6
const GAIN = 1.1
const CURVE = 0.85
const EMPTY = 4
const MARGIN = 1.04

const args = process.argv.slice(2)
const only = args.find((arg) => arg.startsWith('--only='))?.slice('--only='.length).split(',')
const [id, from, fpsArg, alphaArg] = args.filter((arg) => !arg.startsWith('--'))
if (!id || !/^[a-z0-9-]+$/.test(id) || !from) {
  console.error('usage: node scripts/build-frame-anim.mjs <id> <frames-dir> [fps] [alpha-quality] [--only=-xs,-md]')
  process.exit(1)
}
const fps = Number(fpsArg) || 24
const alphaQuality = Math.min(100, Math.max(1, Number(alphaArg) || 100))
const delay = Math.round(1000 / fps)

const names = (await fs.readdir(from)).filter((name) => /\.(png|webp|jpe?g)$/i.test(name)).sort()
if (!names.length) throw new Error(`no frames in ${from}`)

async function keyed(file) {
  if ((await sharp(file).metadata()).hasAlpha) {
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    return { data, width: info.width, height: info.height }
  }
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const out = Buffer.alloc(info.width * info.height * 4)
  for (let at = 0, to = 0; at < data.length; at += 3, to += 4) {
    const r = data[at]
    const g = data[at + 1]
    const b = data[at + 2]
    const peak = Math.max(r, g, b)
    const alpha = peak <= FLOOR ? 0 : Math.round(Math.pow(Math.min(1, ((peak - FLOOR) * GAIN) / (255 - FLOOR)), CURVE) * 255)
    if (!alpha) continue
    out[to] = Math.min(255, Math.round((r * 255) / peak))
    out[to + 1] = Math.min(255, Math.round((g * 255) / peak))
    out[to + 2] = Math.min(255, Math.round((b * 255) / peak))
    out[to + 3] = alpha
  }
  return { data: out, width: info.width, height: info.height }
}

const ownAlpha = (await sharp(path.join(from, names[0])).metadata()).hasAlpha
const frames = []
for (const name of names) frames.push(await keyed(path.join(from, name)))
const reach = (() => {
  const { width, height } = frames[0]
  let far = 0
  for (const frame of frames) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (frame.data[(y * width + x) * 4 + 3] <= EMPTY) continue
        far = Math.max(far, Math.abs(x + 0.5 - width / 2), Math.abs(y + 0.5 - height / 2))
      }
    }
  }
  return Math.min(Math.ceil(far * MARGIN), Math.floor(Math.min(width, height) / 2))
})()
const box = { left: Math.round(frames[0].width / 2 - reach), top: Math.round(frames[0].height / 2 - reach), width: reach * 2, height: reach * 2 }
const width = box.width
const height = box.height
for (const frame of frames) {
  frame.data = await sharp(frame.data, { raw: { width: frame.width, height: frame.height, channels: 4 } }).extract(box).raw().toBuffer()
  frame.width = width
  frame.height = height
}

const still = frames.length === 1
for (const size of (still ? STILL_SIZES : SIZES).filter((one) => !only || only.includes(one.suffix || 'full'))) {
  const into = path.join(OUT, `${id}${size.suffix}.webp`)
  const resized = await Promise.all(
    (size.animated ? frames : frames.slice(0, 1)).map((frame) =>
      sharp(frame.data, { raw: { width, height, channels: 4 } })
        .resize(size.side, size.side, { kernel: 'lanczos3' })
        .raw()
        .toBuffer(),
    ),
  )
  const strip = Buffer.concat(resized)
  const pages = resized.length
  await sharp(strip, { raw: { width: size.side, height: size.side * pages, channels: 4, pageHeight: size.side } })
    .webp({ quality: ownAlpha && !still ? Math.min(size.quality, 75) : size.quality, alphaQuality, effort: 4, smartSubsample: true, loop: 0, ...(pages > 1 ? { delay: Array(pages).fill(delay) } : {}) })
    .toFile(into)
  const kb = Math.round((await fs.stat(into)).size / 1024)
  console.log(`${path.basename(into).padEnd(18)} ${size.side}px ${pages} frame${pages > 1 ? 's' : ''} ${kb}K`)
}
