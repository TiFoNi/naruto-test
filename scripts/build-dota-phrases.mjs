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
const MIN_LENGTH = 16
const MAX_LENGTH = 120

const fileKey = (name) => name.replace(/ /g, '_').replace(/^./, (c) => c.toUpperCase())

const clipKey = (file) => file.replace(/\.mp3$/i, '').toLowerCase().replace(/[\s-]+/g, '_')

const cyrillicNames = (hero) => (hero.aliases ?? '').split(/\s+/).filter((word) => word.length >= 4)

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

function pick(text, hero, rivals) {
  const forbidden = nameParts(hero)
  const others = rivals.filter((word) => !forbidden.includes(word))
  const seen = new Set()
  const lines = []

  for (const match of text.matchAll(/\*((?:\s*<sm2>[^<]+\.mp3<\/sm2>)+)\s*([^\n]+)/g)) {
    const file = match[1].match(/<sm2>([^<]+)<\/sm2>/)[1]
    const spoken = clean(match[2].replace(/<sm2>[^<]*<\/sm2>/g, ''))
    const low = spoken.toLowerCase()
    if (spoken.length < MIN_LENGTH || spoken.length > MAX_LENGTH) continue
    if (forbidden.some((part) => low.includes(part))) continue
    if (others.some((part) => new RegExp(`\\b${part}\\b`).test(low))) continue
    if (spoken.split(/\s+/).length < 5) continue
    if (!/[a-z]/i.test(spoken)) continue
    if (seen.has(low)) continue
    seen.add(low)
    lines.push({ file, text: spoken })
  }

  return lines.slice(0, WANTED)
}

function translations(text) {
  const rows = []
  for (const match of text.matchAll(/\*((?:\s*<sm2>[^<]+\.mp3<\/sm2>)+)\s*([^\n]+)/g)) {
    const file = match[1].match(/<sm2>([^<]+)<\/sm2>/)[1]
    rows.push({ key: clipKey(file).replace(/_ru$/, ''), text: clean(match[2].replace(/<sm2>[^<]*<\/sm2>/g, '')) })
  }
  return rows.sort((a, b) => b.key.length - a.key.length)
}

const translationOf = (rows, file, forbidden) => {
  const key = clipKey(file)
  const hit = rows.find((row) => key === row.key || key.endsWith(`_${row.key}`))
  if (!hit || !/[А-Яа-яЁё]/.test(hit.text)) return undefined
  const low = hit.text.toLowerCase()
  return forbidden.some((word) => low.includes(word)) ? undefined : hit.text
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

  const picked = new Map()
  let missing = 0
  await pool(heroes, 4, async (hero) => {
    const title = `${hero.nameEn ?? hero.name}/Responses`
    const text = await cachedJson(CACHE, `page-${hero.id}.json`, async () => ({ text: await pageText(title) }))
    const lines = pick(text.text, hero, rivals)
    if (lines.length) {
      const ru = await cachedJson(CACHE, `ru-${hero.id}.json`, async () => ({ text: await pageText(`${hero.nameEn ?? hero.name}/Реплики`, RU_API) }))
      const rows = translations(ru.text)
      const forbidden = cyrillicNames(hero)
      for (const line of lines) line.ru = translationOf(rows, line.file, forbidden)
    }
    if (lines.length < 3) {
      missing++
      console.log(`  мало фраз: ${hero.nameEn ?? hero.name} (${lines.length})`)
    }
    if (lines.length) picked.set(hero.id, lines)
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
      const ru = line.ru ?? manualRu[`${id}:${index}`]
      kept.push({ text: line.text, ...(ru ? { ru } : {}), clip: index })
    }
    if (kept.length) out[id] = kept
  })

  await fs.writeFile(OUT_JSON, JSON.stringify(out))
  const total = Object.values(out).reduce((sum, list) => sum + list.length, 0)
  const translated = Object.values(out).reduce((sum, list) => sum + list.filter((line) => line.ru).length, 0)
  console.log(`записано ${Object.keys(out).length} героїв, ${total} фраз із озвучкою, з перекладом ${translated}`)
}

await main()
