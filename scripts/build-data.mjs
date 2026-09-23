import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { keepNotable, pruneImages } from './lib.mjs'
import { AFFILIATIONS, ARCS, CLASSIFICATIONS, JUTSU, KEKKEI_GENKAI, NAMES, NATURES, OTHER_SEX, SEX, transliterate } from './ru.mjs'
import { dropDeleted, onlyAnswers } from './dropped.mjs'

const ROOT = path.resolve(import.meta.dirname, '..')
const CACHE = path.join(ROOT, '.cache')
const OUT_IMG = path.join(PUBLIC, 'characters')
const THUMBS = path.join(CACHE, 'thumb')
const OUT_JSON = path.join(ROOT, 'packages', 'game', 'data', 'characters.json')
const OUT_ATLAS_META = path.join(ROOT, 'packages', 'game', 'data', 'atlas.json')
const ATLAS_COLS = 24
const ATLAS_CELL = 96
const API = 'https://dattebayo-api.onrender.com/characters?page=1&limit=3000'
const MAX_CHAPTER = 699
const ANSWER_POOL_SIZE = 150
const KEEP = 250

const NON_CANON = /\((anime|novel|game|movie|ova|databook)[^)]*only\)|non-canon/i


const DROP_AFFILIATIONS = new Set(['Allied Shinobi Forces'])



const JUTSU_RULES = [
  [JUTSU.genjutsu, /genjutsu|demonic illusion|tsukuyomi|izanami|izanagi|sly mind|nirvana|kotoamatsukami|illusion|hell viewing/i],
  [JUTSU.taijutsu, /taijutsu|lotus|leaf (whirlwind|hurricane|gale|rising|great|drop|flash|coiling)|fist|kick|eight gates|gate of|dynamic entry|punch|lariat|heel drop|palm|eight trigrams|gentle step|heavenly spin|rotation|combo|dropkick|cherry blossom impact|chakra enhanced strength/i],
  [JUTSU.kenjutsu, /sword|blade|kenjutsu|slash|silent homicide|crescent moon dance|iaido|samehada|kubikiribōchō/i],
  [JUTSU.fuinjutsu, /seal|fūinjutsu|sealing|reaper death|tetragram/i],
  [JUTSU.senjutsu, /sage mode|sage art|senjutsu|sage transformation|frog kata/i],
  [JUTSU.dojutsu, /sharingan|byakugan|rinnegan|amaterasu|kamui|susanoo|tsukuyomi|kagutsuchi|izanagi|izanami|tenseigan|ketsuryūgan/i],
  [JUTSU.medical, /mystical palm|healing|medical|chakra scalpel|cell activation|creation rebirth|strength of a hundred/i],
]
const DOJUTSU_KG = /sharingan|byakugan|rinnegan|tenseigan|ketsuryūgan/i
const NINJUTSU_HINT = /release|clone|summoning|transformation|rasengan|chidori|technique|jutsu|substitution|shadow|body flicker|kunai|chakra/i

const OVERRIDES = {
  'Rock Lee': { jutsuTypes: [JUTSU.taijutsu] },
  'Neji Hyūga': { jutsuTypes: [JUTSU.ninjutsu, JUTSU.taijutsu, JUTSU.dojutsu] },
  Tenten: { jutsuTypes: [JUTSU.ninjutsu, JUTSU.kenjutsu, JUTSU.fuinjutsu] },
  'Kurenai Yūhi': { jutsuTypes: [JUTSU.ninjutsu, JUTSU.genjutsu] },
  'Shikamaru Nara': { jutsuTypes: [JUTSU.ninjutsu] },
  Kimimaro: { jutsuTypes: [JUTSU.taijutsu] },
  Orochimaru: { gender: SEX.Male },
  'Kaguya Ōtsutsuki': { kekkeiGenkai: ['Бьякуган', 'Риннэ-Шаринган'] },
  'Hagoromo Ōtsutsuki': { kekkeiGenkai: ['Риннеган'] },
  'Hamura Ōtsutsuki': { kekkeiGenkai: ['Бьякуган', 'Тенсейган'] },
}

const WIKI_API = 'https://naruto.fandom.com/api.php'

const asList = (v) => (v == null ? [] : Array.isArray(v) ? v : [v])
const clean = (s) => s.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim()
const canon = (arr) => asList(arr).filter((s) => typeof s === 'string' && !NON_CANON.test(s) && !s.includes('"'))
const uniq = (arr) => [...new Set(arr.filter(Boolean))]

function arcFor(chapter) {
  let arc = ARCS[0]
  for (const a of ARCS) if (chapter >= a[0]) arc = a
  return { arc: arc[1], arcIndex: ARCS.indexOf(arc) }
}

function jutsuTypes(c) {
  const jutsu = canon(c.jutsu).filter((j) => !/wiki has an article/i.test(j) && j !== c.name)
  const kg = canon(c.personal?.kekkeiGenkai).map(clean)
  const types = new Set()
  let ninjutsu = canon(c.natureType).length > 0
  for (const j of jutsu) {
    let matched = false
    for (const [type, re] of JUTSU_RULES) {
      if (re.test(j)) {
        types.add(type)
        matched = true
      }
    }
    if (!matched || NINJUTSU_HINT.test(j)) ninjutsu = true
  }
  if (kg.some((k) => DOJUTSU_KG.test(k))) types.add(JUTSU.dojutsu)
  if (ninjutsu) types.add(JUTSU.ninjutsu)
  return Object.values(JUTSU).filter((t) => types.has(t))
}

function affiliations(p) {
  return uniq(
    canon(p.affiliation)
      .map(clean)
      .filter((a) => !DROP_AFFILIATIONS.has(a))
      .map((a) => AFFILIATIONS[a] ?? transliterate(a)),
  )
}

function natures(c) {
  return uniq(canon(c.natureType).map(clean).map((n) => NATURES[n]))
}

function kekkeiGenkai(p) {
  return uniq(canon(p.kekkeiGenkai).map(clean).map((k) => KEKKEI_GENKAI[k] ?? transliterate(k)))
}

function attributes(p) {
  return uniq(canon(p.classification).map(clean).map((a) => CLASSIFICATIONS[a] ?? a))
}

const DOJUTSU_VALUES = ['Шаринган', 'Мангекьё Шаринган', 'Вечный Мангекьё Шаринган', 'Бьякуган', 'Риннеган', 'Риннэ-Шаринган', 'Тенсейган']

function consistent(c) {
  const jutsu = new Set(c.jutsuTypes)
  if (c.kekkeiGenkai.some((k) => DOJUTSU_VALUES.includes(k))) jutsu.add(JUTSU.dojutsu)
  else jutsu.delete(JUTSU.dojutsu)
  if (c.attributes.includes('Мудрец')) jutsu.add(JUTSU.senjutsu)
  if (c.natureTypes.length) jutsu.add(JUTSU.ninjutsu)
  return { ...c, jutsuTypes: Object.values(JUTSU).filter((t) => jutsu.has(t)) }
}

async function fetchArticleLengths(names) {
  const file = path.join(CACHE, 'lengths.json')
  const cached = JSON.parse(await fs.readFile(file, 'utf8').catch(() => '{}'))
  const missing = names.filter((n) => cached[n] == null)
  for (let i = 0; i < missing.length; i += 50) {
    const titles = missing.slice(i, i + 50).join('|')
    const res = await fetch(`${WIKI_API}?action=query&format=json&redirects=1&prop=info&titles=${encodeURIComponent(titles)}`, {
      headers: UA,
    }).then((r) => r.json())
    const back = Object.fromEntries([...(res.query.normalized ?? []), ...(res.query.redirects ?? [])].map((x) => [x.to, x.from]))
    for (const page of Object.values(res.query.pages)) {
      let name = page.title
      while (back[name]) name = back[name]
      cached[name] = page.length ?? 0
    }
  }
  await fs.writeFile(file, JSON.stringify(cached))
  return cached
}

async function fetchRussianTitles(names) {
  const file = path.join(CACHE, 'ru-names.json')
  const cached = JSON.parse(await fs.readFile(file, 'utf8').catch(() => '{}'))
  const missing = names.filter((n) => !(n in cached))
  for (let i = 0; i < missing.length; i += 50) {
    const titles = missing.slice(i, i + 50).join('|')
    const res = await fetch(
      `${WIKI_API}?action=query&format=json&redirects=1&prop=langlinks&lllang=ru&lllimit=500&titles=${encodeURIComponent(titles)}`,
      { headers: UA },
    ).then((r) => r.json())
    const back = Object.fromEntries([...(res.query.normalized ?? []), ...(res.query.redirects ?? [])].map((x) => [x.to, x.from]))
    for (const page of Object.values(res.query.pages)) {
      let name = page.title
      while (back[name]) name = back[name]
      cached[name] = page.langlinks?.[0]?.['*'] ?? null
    }
  }
  await fs.writeFile(file, JSON.stringify(cached))
  return cached
}

function russianNames(names, titles) {
  const full = Object.fromEntries(names.map((n) => [n, NAMES[n] ?? titles[n] ?? transliterate(n.replace(/\s*\([^)]*\)/g, ''))]))
  const short = Object.fromEntries(Object.entries(full).map(([n, ru]) => [n, ru.replace(/\s*\([^)]*\)/g, '').trim()]))
  const counts = {}
  for (const ru of Object.values(short)) counts[ru] = (counts[ru] ?? 0) + 1
  return Object.fromEntries(names.map((n) => [n, NAMES[n] ?? (counts[short[n]] > 1 ? full[n] : short[n])]))
}

async function fetchJson() {
  const file = path.join(CACHE, 'characters.json')
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'))
  } catch {
    console.log('fetching', API)
    const res = await fetch(API)
    if (!res.ok) throw new Error(`API ${res.status}`)
    const json = await res.json()
    await fs.writeFile(file, JSON.stringify(json))
    return json
  }
}

const UA = { 'User-Agent': 'naruto-test-build/1.0' }

async function download(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { headers: UA }).catch(() => null)
    if (res?.ok) return Buffer.from(await res.arrayBuffer())
    if (res?.status === 404) return null
    await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
  }
  return null
}

async function wikiImageUrls(name) {
  const fileRes = await fetch(
    `${WIKI_API}?action=query&format=json&prop=imageinfo&iiprop=url&titles=${encodeURIComponent(`File:${name}.png`)}`,
    { headers: UA },
  ).then((r) => r.json()).catch(() => null)
  const pageRes = await fetch(
    `${WIKI_API}?action=query&format=json&redirects=1&prop=pageimages&piprop=original&titles=${encodeURIComponent(name)}`,
    { headers: UA },
  ).then((r) => r.json()).catch(() => null)
  const fromFile = Object.values(fileRes?.query?.pages ?? {}).map((p) => p.imageinfo?.[0]?.url)
  const fromPage = Object.values(pageRes?.query?.pages ?? {}).map((p) => p.original?.source)
  return [...fromFile, ...fromPage].filter(Boolean)
}

async function fetchImage(c) {
  const file = path.join(CACHE, 'img', `${c.id}`)
  try {
    return await fs.readFile(file)
  } catch {
    const tried = new Set()
    const tryUrls = async (urls) => {
      for (const url of urls) {
        if (tried.has(url)) continue
        tried.add(url)
        const buf = await download(url)
        if (buf) return buf
      }
      return null
    }
    const buf = (await tryUrls(c.images ?? [])) ?? (await tryUrls(await wikiImageUrls(c.name)))
    if (buf) await fs.writeFile(file, buf)
    return buf
  }
}

async function writeImages(buf, id) {
  const trimmed = await sharp(buf).trim().png().toBuffer({ resolveWithObject: true })
  const { width, height } = trimmed.info
  await sharp(trimmed.data)
    .resize({ width: 700, height: 900, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 88 })
    .toFile(path.join(OUT_IMG, 'full', `${id}.webp`))
  const side = Math.min(width, height)
  await sharp(trimmed.data)
    .extract({ left: Math.floor((width - side) / 2), top: 0, width: side, height: side })
    .resize(96, 96, { fit: 'cover', position: sharp.strategy.attention })
    .webp({ quality: 85 })
    .toFile(path.join(THUMBS, `${id}.webp`))
}

async function writeAtlas(result) {
  const rows = Math.ceil(result.length / ATLAS_COLS)
  const composite = result.map((c, i) => ({
    input: path.join(THUMBS, `${c.id}.webp`),
    left: (i % ATLAS_COLS) * ATLAS_CELL,
    top: Math.floor(i / ATLAS_COLS) * ATLAS_CELL,
  }))
  result.forEach((c, i) => (c.thumb = i))
  await sharp({
    create: { width: ATLAS_COLS * ATLAS_CELL, height: rows * ATLAS_CELL, channels: 3, background: '#2a1a10' },
  })
    .composite(composite)
    .webp({ quality: 82 })
    .toFile(path.join(OUT_IMG, 'thumbs.webp'))
  await fs.writeFile(OUT_ATLAS_META, JSON.stringify({ cols: ATLAS_COLS, rows, cell: ATLAS_CELL }))
}

async function pool(items, size, fn) {
  let i = 0
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (i < items.length) await fn(items[i++])
    }),
  )
}

async function main() {
  await fs.mkdir(path.join(CACHE, 'img'), { recursive: true })
  await fs.mkdir(path.join(OUT_IMG, 'full'), { recursive: true })
  await fs.mkdir(THUMBS, { recursive: true })
  await fs.mkdir(path.dirname(OUT_JSON), { recursive: true })

  const { characters } = await fetchJson()
  const candidates = characters.filter((c) => {
    const m = /^Naruto Chapter #(\d+)$/.exec(c.debut?.manga?.trim() ?? '')
    return m && Number(m[1]) <= MAX_CHAPTER && c.personal && typeof c.personal === 'object' && !Array.isArray(c.personal)
  })

  const result = []
  let done = 0
  await pool(candidates, 12, async (c) => {
    const buf = await fetchImage(c)
    done++
    if (done % 50 === 0) console.log(`${done}/${candidates.length}`)
    if (!buf) {
      console.warn('no image', c.name)
      return
    }
    try {
      await writeImages(buf, c.id)
    } catch (e) {
      console.warn('image failed', c.name, e.message)
      return
    }
    const chapter = Number(/#(\d+)/.exec(c.debut.manga)[1])
    const p = c.personal
    const character = {
      id: c.id,
      name: c.name,
      gender: SEX[p.sex] ?? OTHER_SEX,
      affiliations: affiliations(p),
      jutsuTypes: jutsuTypes(c),
      kekkeiGenkai: kekkeiGenkai(p),
      natureTypes: natures(c),
      attributes: attributes(p),
      debutChapter: chapter,
      ...arcFor(chapter),
      ...OVERRIDES[c.name],
    }
    result.push(consistent(character))
  })

  const lengths = await fetchArticleLengths(result.map((c) => c.name))
  result.sort((a, b) => (lengths[b.name] ?? 0) - (lengths[a.name] ?? 0))
  result.forEach((c, i) => (c.answer = i < ANSWER_POOL_SIZE))
  const kept = keepNotable(result, KEEP)
  result.length = 0
  result.push(...kept)

  const names = result.map((c) => c.name)
  const ru = russianNames(names, await fetchRussianTitles(names))
  for (const c of result) {
    c.nameEn = c.name
    c.name = ru[c.nameEn]
  }
  dropDeleted(result, 'naruto')
  onlyAnswers(result)
  result.sort((a, b) => a.name.localeCompare(b.name, 'ru'))

  await writeAtlas(result)
  await pruneImages(path.join(OUT_IMG, 'full'), result)
  await fs.writeFile(OUT_JSON, JSON.stringify(result, null, 1))
  console.log(`wrote ${result.length} characters (${result.filter((c) => c.answer).length} answerable)`)
}

main()
