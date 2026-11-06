import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { CARD, CARD_HD, PUBLIC, ROOT, framed, pool, writeCard } from './lib.mjs'

const SKIP = new Set(['shots', 'tunes', 'worlds', 'banners', 'frames', 'awards', 'bestiary', 'promo', 'avatar-parts'])
const MATCH = 4
const force = process.argv.includes('--force')
const only = process.argv.find((one, index) => index > 1 && !one.startsWith('--'))

const print = async (buffer) => {
  const { data } = await sharp(buffer).resize(36, 48, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  return data
}

const gap = (a, b) => {
  let sum = 0
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i])
  return sum / a.length
}

async function make(raw, size, frame) {
  if (frame) return framed(raw, size.width, size.height, 82)
  return sharp(raw).resize(size.width, size.height, { fit: 'cover', position: 'top' }).webp({ quality: 80 }).toBuffer()
}

async function ways(buffer) {
  const plain = await sharp(buffer).png().toBuffer({ resolveWithObject: true })
  const trimmed = await sharp(buffer).trim().png().toBuffer({ resolveWithObject: true })
  const need = (info) => Math.max(CARD.width / info.width, CARD.height / info.height) > 1.2
  return [
    { raw: trimmed.data, frame: need(trimmed.info) },
    { raw: plain.data, frame: need(plain.info) },
  ]
}

async function walk(dir, found = new Map()) {
  for (const item of await fs.readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const target = path.join(dir, item.name)
    if (item.isDirectory()) {
      if (item.name !== 'thumb') await walk(target, found)
      continue
    }
    const key = item.name.replace(/\.[a-z0-9]+$/i, '').replace(/-(full|portrait)$/, '')
    found.set(key, [...(found.get(key) ?? []), target])
  }
  return found
}

const CACHE_OF = { characters: ['img'] }

async function sourcesFor(folder) {
  const dirs = [...(CACHE_OF[folder] ?? []), folder].map((name) => path.join(ROOT, '.cache', name))
  const found = new Map()
  for (const dir of dirs) for (const [key, list] of await walk(dir)) found.set(key, [...(found.get(key) ?? []), ...list])
  return found
}

async function main() {
  const folders = (await fs.readdir(PUBLIC, { withFileTypes: true })).filter((one) => one.isDirectory() && !SKIP.has(one.name)).map((one) => one.name)
  let made = 0
  let fresh = 0
  const missed = []
  const remade = []

  for (const folder of folders) {
    if (only && folder !== only) continue
    const cardDir = path.join(PUBLIC, folder, 'card')
    const files = (await fs.readdir(cardDir).catch(() => [])).filter((file) => file.endsWith('.webp'))
    if (!files.length) continue
    const hdDir = path.join(PUBLIC, folder, 'hd')
    await fs.mkdir(hdDir, { recursive: true })
    const sources = await sourcesFor(folder)
    let here = 0

    await pool(files, 6, async (file) => {
      const id = file.replace('.webp', '')
      const cardPath = path.join(cardDir, file)
      const hdPath = path.join(hdDir, file)
      const [card, hd] = await Promise.all([fs.stat(cardPath), fs.stat(hdPath).catch(() => null)])
      if (!force && hd && hd.mtimeMs >= card.mtimeMs) return fresh++

      const goal = await print(await fs.readFile(cardPath))
      const candidates = [path.join(PUBLIC, folder, 'full', file), ...(sources.get(id) ?? [])]
      let best = null
      for (const candidate of candidates) {
        const buffer = await fs.readFile(candidate).catch(() => null)
        if (!buffer) continue
        const options = await ways(buffer).catch(() => [])
        for (const way of options) {
          const score = gap(goal, await print(await make(way.raw, CARD, way.frame)))
          if (!best || score < best.score) best = { ...way, score }
          if (score < 1.5) break
        }
        if (best && best.score < 1.5) break
      }

      if (!best || best.score > MATCH) {
        const full = path.join(PUBLIC, folder, 'full', file)
        const meta = await sharp(full)
          .metadata()
          .catch(() => null)
        if (!meta?.width || !meta.height) {
          missed.push(`${folder}/${id}`)
          return
        }
        await writeCard(full, cardPath, Math.max(CARD.width / meta.width, CARD.height / meta.height) > 1.2)
        remade.push(`${folder}/${id}`)
        return
      }
      await fs.writeFile(hdPath, await make(best.raw, CARD_HD, best.frame))
      made++
      here++
    })
    console.log(`  ${folder.padEnd(11)} нових ${here}`)
  }

  console.log(`\nготово: створено ${made}, вже актуальних ${fresh}, перезібрано з повної картинки разом з карткою ${remade.length}, без картинки ${missed.length}`)
  if (missed.length) console.log(missed.slice(0, 40).join('\n'))
}

main()
