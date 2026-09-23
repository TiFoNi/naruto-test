import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { ATTACK, ATTRIBUTES, HEROES, RELEASE_FALLBACK, ROLES } from './dota-heroes.mjs'

const ROOT = path.resolve(import.meta.dirname, '..')
const CACHE = path.join(ROOT, '.cache', 'dota')
const THUMBS = path.join(CACHE, 'thumb')
const OUT_IMG = path.join(ROOT, 'public', 'dota')
const OUT_JSON = path.join(ROOT, 'packages', 'game', 'data', 'dota.json')
const OUT_ATLAS_META = path.join(ROOT, 'packages', 'game', 'data', 'dota-atlas.json')
const HEROLIST = 'https://www.dota2.com/datafeed/herolist?language=english'
const OPENDOTA = 'https://api.opendota.com/api/constants/heroes'
const WIKI_API = 'https://dota2.fandom.com/api.php'
const CDN = 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes'
const UA = { 'User-Agent': 'naruto-test-build/1.0' }
const ATLAS_COLS = 12
const ATLAS_CELL = 96

async function cachedJson(name, load) {
  const file = path.join(CACHE, name)
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'))
  } catch {
    const data = await load()
    await fs.writeFile(file, JSON.stringify(data))
    return data
  }
}

const getJson = (url) =>
  fetch(url, { headers: UA }).then((r) => {
    if (!r.ok) throw new Error(`${url} ${r.status}`)
    return r.json()
  })

async function wikiQuery(titles, params) {
  const out = {}
  for (let i = 0; i < titles.length; i += 40) {
    const batch = titles.slice(i, i + 40).join('|')
    const res = await getJson(`${WIKI_API}?action=query&format=json&redirects=1&${params}&titles=${encodeURIComponent(batch)}`)
    const back = Object.fromEntries([...(res.query.normalized ?? []), ...(res.query.redirects ?? [])].map((x) => [x.to, x.from]))
    for (const page of Object.values(res.query.pages)) {
      let title = page.title
      while (back[title]) title = back[title]
      out[title] = page
    }
  }
  return out
}

const field = (text, name) => text?.match(new RegExp(`\\|\\s*${name}\\s*=\\s*([^\\n]*)`))?.[1]?.trim() || null

async function download(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { headers: UA }).catch(() => null)
    if (res?.ok) return Buffer.from(await res.arrayBuffer())
    if (res?.status === 404) return null
    await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
  }
  return null
}

async function cachedDownload(urls, key) {
  const file = path.join(CACHE, 'img', key)
  try {
    return await fs.readFile(file)
  } catch {
    for (const url of urls.filter(Boolean)) {
      const buf = await download(url)
      if (buf) {
        await fs.writeFile(file, buf)
        return buf
      }
    }
    return null
  }
}

async function main() {
  await fs.mkdir(path.join(CACHE, 'img'), { recursive: true })
  await fs.mkdir(THUMBS, { recursive: true })
  await fs.mkdir(path.join(OUT_IMG, 'full'), { recursive: true })

  const list = await cachedJson('herolist.json', async () => (await getJson(HEROLIST)).result.data.heroes)
  const opendota = await cachedJson('opendota.json', () => getJson(OPENDOTA))
  const names = list.map((h) => h.name_english_loc)

  const pages = await cachedJson('pages.json', async () => {
    const res = await wikiQuery([...names, ...names.map((n) => `${n}/Lore`)], 'prop=revisions&rvprop=content&rvslots=main')
    return Object.fromEntries(Object.entries(res).map(([t, p]) => [t, p.revisions?.[0]?.slots?.main?.['*'] ?? null]))
  })

  const loreImages = Object.fromEntries(names.map((n) => [n, field(pages[`${n}/Lore`], 'image')]))
  const imageUrls = await cachedJson('lore-images.json', async () => {
    const files = Object.values(loreImages).filter(Boolean).map((f) => `File:${f}`)
    const res = await wikiQuery(files, 'prop=imageinfo&iiprop=url')
    return Object.fromEntries(Object.entries(res).map(([t, p]) => [t.replace(/^File:/, ''), p.imageinfo?.[0]?.url ?? null]))
  })

  const result = []
  for (const hero of list) {
    const name = hero.name_english_loc
    const manual = HEROES[name]
    if (!manual) throw new Error(`no manual data for ${name}`)
    const od = opendota[hero.id]
    const short = hero.name.replace('npc_dota_hero_', '')
    const release = field(pages[name], 'releasedate')
    const year = release ? Number(release.slice(0, 4)) : RELEASE_FALLBACK[name]
    if (!year) throw new Error(`no release year for ${name}`)

    const lore = loreImages[name] && imageUrls[loreImages[name]]
    const full = await cachedDownload([lore, `${CDN}/crops/${short}.png`, `${CDN}/${short}.png`], `${hero.id}-full`)
    const portrait = await cachedDownload([`${CDN}/${short}.png`], `${hero.id}-portrait`)
    if (!full || !portrait) throw new Error(`images missing for ${name}`)

    await sharp(full)
      .resize({ width: 1000, height: 800, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 86 })
      .toFile(path.join(OUT_IMG, 'full', `${hero.id}.webp`))
    const meta = await sharp(portrait).metadata()
    const side = Math.min(meta.width, meta.height)
    await sharp(portrait)
      .extract({ left: Math.floor((meta.width - side) / 2), top: 0, width: side, height: side })
      .resize(ATLAS_CELL, ATLAS_CELL)
      .webp({ quality: 90 })
      .toFile(path.join(THUMBS, `${hero.id}.webp`))

    const [gender, species, aliases] = manual
    result.push({
      id: hero.id,
      name,
      aliases,
      gender,
      species,
      roles: od.roles.map((r) => ROLES[r] ?? r),
      attribute: ATTRIBUTES[hero.primary_attr],
      attack: ATTACK[od.attack_type],
      complexity: hero.complexity,
      year,
      answer: true,
    })
  }

  result.sort((a, b) => a.name.localeCompare(b.name))
  const rows = Math.ceil(result.length / ATLAS_COLS)
  await sharp({ create: { width: ATLAS_COLS * ATLAS_CELL, height: rows * ATLAS_CELL, channels: 3, background: '#111' } })
    .composite(
      result.map((h, i) => ({
        input: path.join(THUMBS, `${h.id}.webp`),
        left: (i % ATLAS_COLS) * ATLAS_CELL,
        top: Math.floor(i / ATLAS_COLS) * ATLAS_CELL,
      })),
    )
    .webp({ quality: 85 })
    .toFile(path.join(OUT_IMG, 'thumbs.webp'))
  result.forEach((h, i) => (h.thumb = i))

  await fs.writeFile(OUT_ATLAS_META, JSON.stringify({ cols: ATLAS_COLS, rows, cell: ATLAS_CELL }))
  await fs.writeFile(OUT_JSON, JSON.stringify(result, null, 1))
  console.log(`wrote ${result.length} heroes`)
}

main()
