import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'packages', 'game', 'data', 'shots.json')
const WANT = 100
const SHOTS = 4

const ANILIST = 'https://graphql.anilist.co'
const FIELDS = `id idMal seasonYear format episodes
      title{ romaji english native }
      synonyms
      relations{ edges{ relationType node{ id type } } }`

const QUERY = `query($page:Int){
  Page(page:$page, perPage:50){
    media(type:ANIME, sort:POPULARITY_DESC, isAdult:false){ ${FIELDS} }
  }
}`

const BY_ID = `query($ids:[Int]){
  Page(page:1, perPage:50){
    media(id_in:$ids, type:ANIME){ ${FIELDS} }
  }
}`

const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

async function anilist(query, variables) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await fetch(ANILIST, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    })
    if (response.status === 429) {
      await sleep(Number(response.headers.get('retry-after') ?? 60) * 1000)
      continue
    }
    const body = await response.json()
    if (body.errors) throw new Error(body.errors[0].message)
    return body.data.Page.media
  }
  throw new Error('anilist недоступний')
}

async function shikimori(malIds) {
  const names = new Map()
  const batch = async (ids) => {
    for (let attempt = 0; attempt < 4; attempt++) {
      const response = await fetch(`https://shikimori.one/api/animes?ids=${ids.join(',')}&limit=50`, {
        headers: { 'User-Agent': 'NandaGuessr' },
      })
      if (response.ok) {
        const body = await response.json()
        for (const one of body) if (one.russian) names.set(one.id, one.russian)
        return body.length
      }
      await sleep(2000 * (attempt + 1))
    }
    return 0
  }

  for (let i = 0; i < malIds.length; i += 20) {
    await batch(malIds.slice(i, i + 20))
    await sleep(1200)
  }

  const left = malIds.filter((id) => !names.has(id))
  for (const id of left) {
    await batch([id])
    await sleep(1200)
  }
  return names
}

const slugify = (value) =>
  value
    .toLowerCase()
    .replace(/[''`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const SKIP_FORMAT = new Set(['MUSIC'])

const media = []
for (let page = 1; page <= 5; page++) {
  media.push(...(await anilist(QUERY, { page })))
  await sleep(700)
}

const known = new Map(media.map((one) => [one.id, one]))
const prequelOf = (one) =>
  (one.relations?.edges ?? []).find((edge) => edge.relationType === 'PREQUEL' && edge.node.type === 'ANIME')?.node.id ?? null

for (let round = 0; round < 6; round++) {
  const missing = [...new Set([...known.values()].map(prequelOf).filter((id) => id && !known.has(id)))]
  if (!missing.length) break
  for (let i = 0; i < missing.length; i += 50) {
    for (const one of await anilist(BY_ID, { ids: missing.slice(i, i + 50) })) known.set(one.id, one)
    await sleep(700)
  }
}

function rootOf(id) {
  const path = new Set()
  let current = id
  while (true) {
    path.add(current)
    const up = prequelOf(known.get(current) ?? {})
    if (!up || path.has(up) || !known.has(up)) return current
    current = up
  }
}

const groups = new Map()
media.forEach((one, rank) => {
  if (SKIP_FORMAT.has(one.format) || !one.title.romaji) return
  const root = rootOf(one.id)
  const group = groups.get(root) ?? { rank, best: one, parts: [] }
  if (rank < group.rank) {
    group.rank = rank
    group.best = one
  }
  group.parts.push(one)
  groups.set(root, group)
})

const picked = [...groups.values()]
  .sort((a, b) => a.rank - b.rank)
  .slice(0, WANT)
  .map((group) => group.best)

const partsOf = new Map([...groups.values()].map((group) => [group.best.id, group.parts]))

const russian = await shikimori(picked.map((one) => one.idMal).filter(Boolean))

const before = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : []
const keptId = new Map(before.map((one) => [one.slug, one.id]))
const keptFrames = new Map(before.map((one) => [one.slug, one.frames ?? []]))
let nextId = before.reduce((max, one) => Math.max(max, one.id), 0)

const list = picked.map((one) => {
  const en = one.title.english ?? one.title.romaji
  const ru = russian.get(one.idMal)
  const parts = partsOf.get(one.id) ?? []
  const aliases = [...new Set([one.title.romaji, one.title.english, one.title.native, ...(one.synonyms ?? []), ...parts.map((part) => part.title.english ?? part.title.romaji)])]
    .filter((value) => value && value !== en && value !== ru)
    .slice(0, 8)
  const slug = slugify(one.title.romaji)
  const frames = keptFrames.get(slug) ?? []
  return {
    id: keptId.get(slug) ?? ++nextId,
    slug,
    name: ru ?? en,
    nameUk: en,
    nameEn: en,
    ...(aliases.length ? { aliases: aliases.join(', ') } : {}),
    year: one.seasonYear ?? 0,
    frames,
    answer: frames.length === SHOTS && frames.every((count) => count > 0),
    thumb: 0,
  }
})

const dropped = before.filter((one) => !list.some((next) => next.slug === one.slug) && one.frames?.length)
if (dropped.length) {
  console.warn(`у цих тайтлів є кадри, але вони випали з топу — лишаю: ${dropped.map((one) => one.slug).join(', ')}`)
  list.push(...dropped)
}

fs.writeFileSync(OUT, JSON.stringify(list, null, 1))
console.log(`тайтлів: ${list.length}`)
console.log(`з російською назвою: ${list.filter((one) => /[А-Яа-я]/.test(one.name)).length}`)
console.log(`частин франшиз згорнуто: ${media.length - groups.size}`)
console.log(`готових до гри (всі ${SHOTS} складності): ${list.filter((one) => one.answer).length}`)
