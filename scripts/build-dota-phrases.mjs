import fs from 'node:fs/promises'
import path from 'node:path'
import { PUBLIC, ROOT, cachedJson, getJson, pool } from './lib.mjs'

const API = 'https://dota2.fandom.com/api.php'
const RU_API = 'https://dota2.fandom.com/ru/api.php'
const CACHE = path.join(ROOT, '.cache', 'dota-phrases')
const OUT_AUDIO = path.join(PUBLIC, 'dota', 'voice')
const OUT_JSON = path.join(ROOT, 'packages', 'game', 'data', 'dota-phrases.json')
const MANUAL_RU = path.join(ROOT, 'packages', 'game', 'data', 'dota-phrases-ru.json')
const HEROES = path.join(ROOT, 'packages', 'game', 'data', 'dota.json')

const WANTED = 6
const REWARDS_PAGE = 'Chat Wheel/Dota Plus'
const REWARDS_PAGE_RU = 'Колесо чата/Dota Plus'
const SKIP_SECTIONS = new Set([
  'Entering battle',
  'Beginning battle',
  'Moving',
  'Attacking',
  'Abilities',
  'Leveling up',
  'Leveling Up',
  'Ordering a spell cast',
])
const MIN_WORDS = 5
const REWARD_MIN_WORDS = 4
const REWARD_MIN_LENGTH = 14
const MIN_LENGTH = 16
const MAX_LENGTH = 120
const MIN_SPOKEN = 2
const MIN_LINES = 3
const LAUGH = /^[\s!?.,\u2026'\u2019-]*(?:(?:mwa|nya|yeah|huh|hah|heh|hee|ha|he|ho|hmm|hm|ah|uh|oh|mm|ss|m)[\s!?.,\u2026'\u2019-]*)+$/i

const fileKey = (name) => name.replace(/ /g, '_').replace(/^./, (c) => c.toUpperCase())

const clipKey = (file) => file.replace(/\.mp3$/i, '').toLowerCase().replace(/[\s-]+/g, '_')

const cyrillicNames = (hero) =>
  (hero.aliases ?? '')
    .split(/\s+/)
    .filter((word) => word.length >= 4)
    .map((word) => (word.length > 5 ? word.slice(0, 5) : word))

const clean = (line) =>
  line
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, '$2')
    .replace(/'''?/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()

const nameParts = (hero) =>
  [...hero.name.split(/[\s'-]+/), ...(hero.nameEn ?? '').split(/[\s'-]+/)]
    .map((part) => part.toLowerCase().replace(/[^a-z]/g, ''))
    .filter((part) => part.length >= 3)

const pageText = async (title, api = API) => {
  const data = await getJson(
    `${api}?action=query&format=json&redirects=1&prop=revisions&rvprop=content&rvslots=main&titles=${encodeURIComponent(title)}`,
  )
  const found = Object.values(data.query.pages)[0]
  return found?.revisions?.[0]?.slots?.main?.['*'] ?? ''
}

function usable(spoken, hero, rivals, minLength, minWords) {
  const low = spoken.toLowerCase()
  if (spoken.length < minLength || spoken.length > MAX_LENGTH) return false
  if (spoken.includes('==') || !/^[\p{L}"'\u201c\u2018]/u.test(spoken) || !/[.!?\u2026"'\u201d\u2019)]$/.test(spoken)) return false
  if (spoken.split(/\s+/).length < minWords) return false
  if (!/[a-z]/i.test(spoken)) return false
  if (hero.some((part) => low.includes(part))) return false
  return !rivals.some((part) => new RegExp(`\\b${part}\\b`).test(low))
}

function rewardLines(page, hero, forbidden, others) {
  const lines = []
  for (const row of page.get(hero.nameEn ?? hero.name) ?? []) {
    if (!usable(row.text, forbidden, others, REWARD_MIN_LENGTH, REWARD_MIN_WORDS)) continue
    lines.push({ file: row.file, text: row.text, laugh: LAUGH.test(row.text) })
  }
  return lines
}

function responseLines(text, forbidden, others) {
  const lines = []
  let section = ''
  for (const line of text.split('\n')) {
    const heading = line.match(/^==\s*([^=].*?)\s*==\s*$/)
    if (heading) {
      section = heading[1]
      continue
    }
    if (SKIP_SECTIONS.has(section)) continue
    const match = line.match(/^\*((?:\s*<sm2>[^<]+\.mp3<\/sm2>)+)\s*(.+)$/)
    if (!match) continue
    const spoken = clean(match[2].replace(/<sm2>[^<]*<\/sm2>/g, ''))
    if (!usable(spoken, forbidden, others, MIN_LENGTH, MIN_WORDS)) continue
    lines.push({ file: match[1].match(/<sm2>([^<]+)<\/sm2>/)[1], text: spoken, laugh: LAUGH.test(spoken) })
  }
  return lines
}

function pick(text, hero, rivals, rewards) {
  const forbidden = nameParts(hero)
  const others = rivals.filter((word) => !forbidden.includes(word))
  const seen = new Set()
  const lines = []
  for (const line of [...rewardLines(rewards, hero, forbidden, others), ...responseLines(text, forbidden, others)]) {
    const low = line.text.toLowerCase()
    if (seen.has(low)) continue
    seen.add(low)
    lines.push(line)
  }

  return lines
}

function choose(lines) {
  const picked = lines.slice(0, WANTED)
  if (picked.filter((line) => !line.laugh).length >= MIN_SPOKEN) return picked
  return [...lines.filter((line) => !line.laugh), ...lines.filter((line) => line.laugh)].slice(0, WANTED)
}

async function rewardsByHero() {
  const { text } = await cachedJson(CACHE, 'rewards.json', async () => ({ text: await pageText(REWARDS_PAGE) }))
  const page = new Map()
  let hero = null
  for (const line of text.split('\n')) {
    const named = line.match(/\{\{H\|([^}|]+)/)
    if (named) {
      hero = named[1].trim()
      continue
    }
    const match = line.match(/^\*((?:\s*<sm2>[^<]+\.mp3<\/sm2>)+)\s*(.+)$/)
    if (!match || !hero) continue
    const spoken = clean(match[2].replace(/<sm2>[^<]*<\/sm2>/g, ''))
    if (!page.has(hero)) page.set(hero, [])
    page.get(hero).push({ file: match[1].match(/<sm2>([^<]+)<\/sm2>/)[1], text: spoken })
  }
  return page
}

function translations(text) {
  const rows = []
  for (const match of text.matchAll(/\*((?:\s*<sm2>[^<]+\.mp3<\/sm2>)+)\s*([^\n]+)/g)) {
    const file = match[1].match(/<sm2>([^<]+)<\/sm2>/)[1]
    rows.push({ key: clipKey(file).replace(/_ru$/, ''), text: clean(match[2].replace(/<sm2>[^<]*<\/sm2>/g, '')) })
  }
  return rows.sort((a, b) => b.key.length - a.key.length)
}

const translationOf = (rows, file) => {
  const key = clipKey(file)
  const hit = rows.find((row) => key === row.key || key.endsWith(`_${row.key}`))
  if (!hit || !/[\u0410-\u042f\u0430-\u044f\u0401\u0451]/.test(hit.text)) return undefined
  if (/^(\u0441\u043c\u0435\u0445|\u0445\u043e\u0445\u043e\u0442|\u0441\u043c\u0435\u0451\u0442\u0441\u044f|\u0441\u043c\u0435\u0435\u0442\u0441\u044f|\u0432\u0437\u0434\u043e\u0445|\u0440\u044b\u0447\u0430\u043d\u0438\u0435)\.?$/i.test(hit.text)) return undefined
  return hit.text
}

async function clipUrls(files) {
  const urls = new Map()
  for (let i = 0; i < files.length; i += 50) {
    const batch = files.slice(i, i + 50)
    const data = await cachedJson(CACHE, `urls-${i}-${batch.length}-${batch[0].replace(/\W/g, '')}.json`, () =>
      getJson(`${API}?action=query&format=json&prop=imageinfo&iiprop=url&titles=${encodeURIComponent(batch.map((f) => `File:${f}`).join('|'))}`),
    )
    for (const page of Object.values(data.query?.pages ?? {})) {
      const url = page.imageinfo?.[0]?.url
      if (url) urls.set(fileKey(page.title.replace(/^File:/, '')), url.split('/revision')[0])
    }
  }
  return urls
}

async function main() {
  await fs.mkdir(CACHE, { recursive: true })
  await fs.mkdir(OUT_AUDIO, { recursive: true })
  const heroes = JSON.parse(await fs.readFile(HEROES, 'utf8'))
  const manualRu = JSON.parse(await fs.readFile(MANUAL_RU, 'utf8').catch(() => '{}'))

  const rivals = [...new Set(heroes.flatMap((other) => nameParts(other)))].filter((word) => word.length >= 4)
  const rewards = await rewardsByHero()
  const rewardsRu = translations((await cachedJson(CACHE, 'rewards-ru.json', async () => ({ text: await pageText(REWARDS_PAGE_RU, RU_API) }))).text)
  console.log(`фраз за тири героя: ${[...rewards.values()].reduce((sum, list) => sum + list.length, 0)} у ${rewards.size} героїв`)

  const picked = new Map()
  let missing = 0
  await pool(heroes, 4, async (hero) => {
    const title = `${hero.nameEn ?? hero.name}/Responses`
    const text = await cachedJson(CACHE, `page-${hero.id}.json`, async () => ({ text: await pageText(title) }))
    const candidates = pick(text.text, hero, rivals, rewards)
    const forbidden = cyrillicNames(hero)
    if (candidates.length) {
      const ru = await cachedJson(CACHE, `ru-${hero.id}.json`, async () => ({ text: await pageText(`${hero.nameEn ?? hero.name}/Реплики`, RU_API) }))
      const rows = translations(ru.text)
      for (const line of candidates) line.ru = translationOf(rows, line.file) ?? translationOf(rewardsRu, line.file) ?? manualRu[line.text]
    }
    const lines = choose(candidates.filter((line) => !forbidden.some((word) => (line.ru ?? '').toLowerCase().includes(word))))
    if (lines.length < MIN_LINES) {
      missing++
      console.log(`  мало фраз, не беремо: ${hero.nameEn ?? hero.name} (${lines.length})`)
      return
    }
    picked.set(hero.id, lines)
  })

  const files = [...new Set([...picked.values()].flat().map((l) => l.file))]
  console.log(`героїв із фразами: ${picked.size} з ${heroes.length}, файлів озвучки: ${files.length}`)

  const urls = await clipUrls(files)
  console.log(`знайдено посилань на аудіо: ${urls.size}`)

  const out = {}
  await pool([...picked.entries()], 6, async ([id, lines]) => {
    const dir = path.join(OUT_AUDIO, String(id))
    await fs.mkdir(dir, { recursive: true })
    const kept = []
    for (const [index, line] of lines.entries()) {
      const file = path.join(dir, `${index}.mp3`)
      const have = await fs.stat(file).then(() => true).catch(() => false)
      if (!have) {
        const url = urls.get(fileKey(line.file))
        if (!url) continue
        const res = await fetch(url, { headers: { 'User-Agent': 'nandaguessr-build/1.0 (hello@nandaguessr.com)' } }).catch(() => null)
        if (!res?.ok) continue
        await fs.writeFile(file, Buffer.from(await res.arrayBuffer()))
      }
      kept.push({ text: line.text, ...(line.ru ? { ru: line.ru } : {}), ...(line.laugh ? { laugh: true } : {}), clip: index })
    }
    if (kept.length) out[id] = kept
  })

  await fs.writeFile(OUT_JSON, JSON.stringify(out))
  const total = Object.values(out).reduce((sum, list) => sum + list.length, 0)
  const translated = Object.values(out).reduce((sum, list) => sum + list.filter((line) => line.ru).length, 0)
  console.log(`записано ${Object.keys(out).length} героїв, ${total} фраз із озвучкою, з перекладом ${translated}`)
}

await main()
