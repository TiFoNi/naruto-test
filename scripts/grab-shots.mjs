import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { ROOT } from './lib.mjs'

const [slug, wiki] = process.argv.slice(2)
const everywhere = process.argv.includes('--all')
const limit = Number(process.argv.find((one) => one.startsWith('--max='))?.slice(6) ?? 60)
if (!slug || !wiki) {
  console.log('використання: node scripts/grab-shots.mjs <slug> <вікі-хост> [--all] [--max=60]')
  console.log('приклад:      node scripts/grab-shots.mjs death-note deathnote')
  console.log('--all — шукати по всій вікі, а не лише в категоріях локацій')
  process.exit(1)
}

const OUT = path.join(ROOT, 'seeds', 'shots', slug, 'location', '_grabbed')
const CATEGORIES = ['Locations', 'Places', 'Settings', 'Anime Locations', 'Buildings']
const MIN_WIDTH = 640
const MIN_RATIO = 1.2
const MIN_COLOUR = 14
const SKIP = /site-logo|wordmark|favicon|\.svg|icon|badge|placeholder|spoiler/i

const api = async (params) => {
  const url = `https://${wiki}.fandom.com/api.php?${new URLSearchParams({ ...params, format: 'json' })}`
  const res = await fetch(url, { headers: { 'User-Agent': 'nandaguessr-build/1.0' } })
  if (!res.ok) throw new Error(`вікі ${wiki} відповіла ${res.status}`)
  return res.json()
}

const colourful = async (body) => {
  const { channels } = await sharp(body).stats()
  if (channels.length < 3) return 0
  const [r, g, b] = channels.map((one) => one.mean)
  return Math.max(r, g, b) - Math.min(r, g, b)
}

async function everyImage() {
  const found = []
  let token
  do {
    const page = await api({ action: 'query', list: 'allimages', ailimit: '500', aiprop: 'url|size', ...(token ? { aicontinue: token } : {}) })
    for (const one of page.query?.allimages ?? []) {
      if (one.width >= MIN_WIDTH && one.width / one.height >= MIN_RATIO && !SKIP.test(one.title)) found.push(one.title)
    }
    token = page.continue?.aicontinue
  } while (token && found.length < 3000)
  return found
}

const pages = []
for (const category of everywhere ? [] : CATEGORIES) {
  const found = await api({ action: 'query', list: 'categorymembers', cmtitle: `Category:${category}`, cmlimit: '60' })
  pages.push(...(found.query?.categorymembers ?? []).filter((one) => one.ns === 0))
}
const titles = [...new Set(pages.map((one) => one.title))]

const images = new Set()
for (const title of titles) {
  const data = await api({ action: 'query', titles: title, prop: 'images', imlimit: '40' })
  for (const one of Object.values(data.query?.pages ?? {})) for (const img of one.images ?? []) images.add(img.title)
}

const found = everywhere ? await everyImage() : [...images].filter((one) => !SKIP.test(one))
// беремо рівномірно по всьому списку, інакше вийдуть самі перші літери алфавіту
const step = Math.max(1, Math.floor(found.length / limit))
const list = step > 1 ? found.filter((_, i) => i % step === 0) : found
await fs.mkdir(OUT, { recursive: true })

let saved = 0
let grey = 0
let small = 0
for (let i = 0; i < list.length; i += 20) {
  const info = await api({ action: 'query', titles: list.slice(i, i + 20).join('|'), prop: 'imageinfo', iiprop: 'url|size' })
  for (const one of Object.values(info.query?.pages ?? {})) {
    const meta = one.imageinfo?.[0]
    if (!meta) continue
    if (meta.width < MIN_WIDTH || meta.width / meta.height < MIN_RATIO) {
      small++
      continue
    }
    if (saved >= limit) break
    const body = Buffer.from(await fetch(meta.url, { headers: { 'User-Agent': 'nandaguessr-build/1.0' } }).then((r) => r.arrayBuffer()))
    if ((await colourful(body)) < MIN_COLOUR) {
      grey++
      continue
    }
    await fs.writeFile(path.join(OUT, one.title.replace(/^File:/, '').replace(/[^\w.-]+/g, '_')), body)
    saved++
  }
}

console.log(everywhere ? `зображень на вікі (великі, широкі): ${list.length}` : `сторінок локацій: ${titles.length}, зображень: ${list.length}`)
console.log(`збережено: ${saved}, відсіяно чорно-білих: ${grey}, дрібних або вертикальних: ${small}`)
console.log(saved ? `лежать у seeds/shots/${slug}/location/_grabbed — розклади по hard/medium/easy/very_easy` : 'нічого придатного')
