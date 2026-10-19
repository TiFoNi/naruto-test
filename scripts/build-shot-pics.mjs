import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { PUBLIC, ROOT } from './lib.mjs'

const DATA = path.join(ROOT, 'packages', 'game', 'data', 'shots.json')
const SEEDS = path.join(ROOT, 'seeds', 'shots')
const OUT = path.join(PUBLIC, 'shots')
const SIZE = { width: 1920, height: 1080 }
const SIZE_MIN = 1280

const box = (width) => {
  const side = Math.min(SIZE.width, Math.max(SIZE_MIN, width))
  return { width: side, height: Math.round((side * 9) / 16) }
}
const CARD = { width: 288, height: 384 }
const KINDS = ['.jpg', '.jpeg', '.png', '.webp', '.avif']

const LEVELS = [
  ['hard', 'складний', '1'],
  ['medium', 'середній', '2'],
  ['easy', 'легкий', '3'],
  ['very easy', 'very_easy', 'veryeasy', 'найлегший', '4'],
]

const levelOf = (name) => LEVELS.findIndex((names) => names.includes(name.toLowerCase().trim()))

async function collect(dir) {
  const skipped = await fs
    .readFile(path.join(dir, '.ignore'), 'utf8')
    .then((text) => new Set(text.split('\n').map((line) => line.trim().toLowerCase()).filter(Boolean)))
    .catch(() => new Set())

  const found = LEVELS.map(() => [])
  const walk = async (where, level) => {
    for (const entry of await fs.readdir(where, { withFileTypes: true })) {
      const full = path.join(where, entry.name)
      if (entry.isDirectory()) {
        if (skipped.has(entry.name.toLowerCase()) || entry.name.startsWith('_')) continue
        const own = levelOf(entry.name)
        await walk(full, own >= 0 ? own : level)
      } else if (level >= 0 && KINDS.includes(path.extname(entry.name).toLowerCase())) {
        found[level].push(full)
      }
    }
  }
  await walk(dir, -1)
  return found.map((files) => files.sort((a, b) => a.localeCompare(b, 'en', { numeric: true })))
}

async function flat(dir) {
  const files = (await fs.readdir(dir))
    .filter((file) => KINDS.includes(path.extname(file).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
  return files.slice(0, LEVELS.length).map((file) => [path.join(dir, file)])
}

async function trimmed(file) {
  const plain = await sharp(file).toBuffer()
  const full = await sharp(plain).metadata()
  const cut = await sharp(plain)
    .trim({ background: '#000000', threshold: 18 })
    .toBuffer({ resolveWithObject: true })
    .catch(() => null)
  if (!cut) return plain
  const left = (cut.info.width * cut.info.height) / (full.width * full.height)
  return left > 0.5 ? cut.data : plain
}

const list = JSON.parse(await fs.readFile(DATA, 'utf8'))
const bySlug = new Map(list.map((one) => [one.slug, one]))
const byId = new Map(list.map((one) => [String(one.id), one]))

const folders = await fs.readdir(SEEDS, { withFileTypes: true }).catch(() => [])
if (!folders.length) {
  console.log('поклади кадри в seeds/shots/<slug>/<складність>/ — папки hard, medium, easy, very_easy')
  console.log(`будь-яка вкладеність усередині дозволена (character/hard, location/hard — усе зіллється в одну складність)`)
  console.log(`доступні slug: ${list.slice(0, 5).map((one) => one.slug).join(', ')} …`)
}

let ready = 0
let partial = 0

for (const folder of folders) {
  if (!folder.isDirectory()) continue
  const title = bySlug.get(folder.name) ?? byId.get(folder.name)
  if (!title) {
    console.warn(`пропускаю ${folder.name}: нема такого тайтла в shots.json`)
    continue
  }

  const dir = path.join(SEEDS, folder.name)
  let levels = await collect(dir)
  if (levels.every((files) => !files.length)) levels = await flat(dir)
  if (levels.every((files) => !files.length)) continue

  await fs.rm(path.join(OUT, 'frames', String(title.id)), { recursive: true, force: true })
  await fs.mkdir(path.join(OUT, 'card'), { recursive: true })

  const counts = []
  for (const [level, files] of levels.entries()) {
    const target = path.join(OUT, 'frames', String(title.id), String(level))
    if (files.length) await fs.mkdir(target, { recursive: true })
    for (const [index, file] of files.entries()) {
      const source = await trimmed(file)
      const { width = 0 } = await sharp(source).metadata()
      const stretched = width < SIZE_MIN
      await sharp(source)
        .resize({ ...box(width), fit: 'cover', position: 'attention', kernel: 'lanczos3' })
        // дрібні джерела доводиться розтягувати — трохи повертаємо різкість
        .sharpen(stretched ? { sigma: 1.1, m1: 0.6, m2: 2 } : { sigma: 0.5 })
        .webp({ quality: 88 })
        .toFile(path.join(target, `${index}.webp`))
    }
    counts.push(files.length)
  }

  const cover = [...levels].reverse().find((files) => files.length)?.[0]
  if (cover) {
    await sharp(await trimmed(cover))
      .resize({ ...CARD, fit: 'cover', position: 'attention' })
      .webp({ quality: 82 })
      .toFile(path.join(OUT, 'card', `${title.id}.webp`))
  }

  title.frames = counts
  title.ver = Date.now().toString(36)
  title.answer = counts.every((count) => count > 0)
  delete title.shots
  const where = counts.map((count, level) => `${LEVELS[level][0]}: ${count}`).join(', ')
  if (title.answer) {
    ready++
    console.log(`${title.slug} — ${where}`)
  } else {
    partial++
    console.warn(`${title.slug} — ${where} · не вистачає складностей, у гру не піде`)
  }
}

await fs.writeFile(DATA, JSON.stringify(list, null, 1))
console.log(`\nготових тайтлів: ${ready}${partial ? `, неповних: ${partial}` : ''}`)
console.log(`усього в грі: ${list.filter((one) => one.answer).length} зі ${list.length}`)
