import fs from 'node:fs/promises'
import path from 'node:path'
import { PUBLIC, ROOT, cachedJson, getJson, pool, pruneImages, writeAtlas, writeFullAndThumb } from './lib.mjs'

const CACHE = path.join(ROOT, '.cache', 'football')
const THUMBS = path.join(CACHE, 'thumb')
const OUT_IMG = path.join(PUBLIC, 'football')
const OUT_JSON = path.join(ROOT, 'packages', 'game', 'data', 'football.json')
const OUT_ATLAS = path.join(ROOT, 'packages', 'game', 'data', 'football-atlas.json')
const OUT_TERMS = path.join(ROOT, 'scripts', 'data', 'football-terms.json')

const WANTED = 300
const LEGENDS = 180
const POOL_SIZE = 650

const GOALKEEPER = 'Вратарь'
const DEFENDER = 'Защитник'
const MIDFIELDER = 'Полузащитник'
const FORWARD = 'Нападающий'

const ROLE_WORDS = [
  ['вратар', GOALKEEPER],
  ['голкипер', GOALKEEPER],
  ['полузащитник', MIDFIELDER],
  ['вингер', MIDFIELDER],
  ['хавбек', MIDFIELDER],
  ['защитник', DEFENDER],
  ['либеро', DEFENDER],
  ['нападающ', FORWARD],
  ['форвард', FORWARD],
  ['инсайд', FORWARD],
]

const EUROPE = 'Европа'
const SOUTH_AMERICA = 'Южная Америка'
const AFRICA = 'Африка'
const NORTH_AMERICA = 'Северная Америка'
const ASIA = 'Азия'

const PARTS = {
  [EUROPE]: ['Англия', 'Франция', 'Германия', 'Испания', 'Италия', 'Португалия', 'Нидерланды', 'Бельгия', 'Хорватия', 'Польша',
    'Украина', 'Россия', 'Швеция', 'Норвегия', 'Дания', 'Швейцария', 'Австрия', 'Шотландия', 'Уэльс', 'Ирландия',
    'Северная Ирландия', 'Чехия', 'Чехословакия', 'Словакия', 'Венгрия', 'Румыния', 'Болгария', 'Сербия', 'Югославия',
    'Греция', 'Турция', 'Словения', 'Босния и Герцеговина', 'Черногория', 'Северная Македония', 'Албания', 'Финляндия',
    'Исландия', 'Грузия', 'Армения', 'Беларусь', 'Латвия', 'Литва', 'Эстония', 'Люксембург', 'Республика Ирландия',
    'Королевство Нидерландов', 'СССР', 'Советский Союз', 'ФРГ', 'ГДР', 'Датское королевство', 'Великобритания',
    'Социалистическая Федеративная Республика Югославия', 'Сербия и Черногория', 'Союзная Республика Югославия',
    'Королевство Югославия', 'Чешская Республика', 'Ирландия (государство)', 'Молдавия', 'Азербайджан', 'Кипр', 'Мальта'],
  [SOUTH_AMERICA]: ['Аргентина', 'Бразилия', 'Уругвай', 'Колумбия', 'Чили', 'Перу', 'Парагвай', 'Эквадор', 'Боливия', 'Венесуэла'],
  [AFRICA]: ['Египет', 'Камерун', 'Нигерия', 'Сенегал', 'Кот-д’Ивуар', 'Кот-д\'Ивуар', 'Гана', 'Алжир', 'Марокко', 'Тунис',
    'ЮАР', 'Либерия', 'Того', 'Мали', 'Габон', 'ДР Конго', 'Демократическая Республика Конго', 'Гвинея', 'Буркина-Фасо'],
  [NORTH_AMERICA]: ['США', 'Мексика', 'Канада', 'Коста-Рика', 'Ямайка', 'Гондурас', 'Панама', 'Тринидад и Тобаго'],
  [ASIA]: ['Самоа', 'Новая Зеландия', 'Япония', 'Южная Корея', 'Корея', 'Китай', 'Иран', 'Ирак', 'Саудовская Аравия', 'Катар', 'Австралия', 'Узбекистан',
    'Израиль', 'ОАЭ', 'Объединённые Арабские Эмираты', 'Республика Корея', 'КНДР', 'Индонезия', 'Таиланд', 'Вьетнам'],
}

const PART_OF = new Map(Object.entries(PARTS).flatMap(([part, list]) => list.map((country) => [country, part])))

const RETIRED = 'Завершил карьеру'
const PLAYING = 'Играет'

const sparql = async (query) => {
  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`
  return getJson(url)
}

const GAP = 500
const BATCH = 40

const waiting = new Map()
let running = false

const flush = async () => {
  if (running) return
  running = true
  while (waiting.size) {
    await new Promise((r) => setTimeout(r, GAP))
    const batch = [...waiting.keys()].slice(0, BATCH)
    const jobs = batch.map((qid) => waiting.get(qid))
    for (const qid of batch) waiting.delete(qid)
    const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=labels|aliases|claims&languages=ru|uk|en&ids=${batch.join('|')}`
    let data = null
    for (let attempt = 0; attempt < 5 && !data; attempt++) {
      data = await getJson(url).catch(() => null)
      if (!data) await new Promise((r) => setTimeout(r, 8000 * (attempt + 1)))
    }
    if (data) batch.forEach((qid, i) => jobs[i].resolve(shrink(data.entities[qid])))
    else jobs.forEach((job) => job.reject(new Error('wikidata недоступна')))
  }
  running = false
}

const fetchEntity = (qid) =>
  new Promise((resolve, reject) => {
    waiting.set(qid, { resolve, reject })
    void flush()
  })

const entity = async (qid) =>
  cachedJson(CACHE, `${qid}.json`, async () => fetchEntity(qid))

const shrink = (one) => {
    return {
      labels: Object.fromEntries(['ru', 'uk', 'en'].map((l) => [l, one.labels?.[l]?.value ?? null])),
      aliases: (one.aliases?.ru ?? []).map((a) => a.value).slice(0, 4),
      claims: Object.fromEntries(
        Object.entries(one.claims ?? {}).map(([prop, list]) => [
          prop,
          list.map((c) => ({
            value: c.mainsnak?.datavalue?.value ?? null,
            rank: c.rank,
            qualifiers: Object.fromEntries(
              Object.entries(c.qualifiers ?? {}).map(([q, vals]) => [q, vals.map((v) => v.datavalue?.value ?? null)]),
            ),
          })),
        ]),
      ),
    }
}

const straight = (name) => {
  const [family, given] = name.split(', ')
  if (!given) return name
  const plain = given.split(' ').filter((part) => !/(ович|евич|івна|овна|евна)$/.test(part))
  return `${plain.join(' ')} ${family}`
}

const id = (claim) => claim?.value?.id ?? null
const ids = (list) => (list ?? []).filter((c) => c.rank !== 'deprecated').map(id).filter(Boolean)

async function roleOf(qid, seen = new Set()) {
  if (seen.has(qid) || seen.size > 4) return null
  seen.add(qid)
  const data = await entity(qid)
  const label = (data.labels.ru ?? data.labels.en ?? '').toLowerCase()
  for (const [word, role] of ROLE_WORDS) if (label.includes(word)) return role
  for (const parent of ids(data.claims.P279)) {
    const found = await roleOf(parent, seen)
    if (found) return found
  }
  return null
}

const NATIONAL = ['Q6979593', 'Q135408445']
const CLUB = ['Q476028', 'Q847017', 'Q15944511', 'Q103229495', 'Q20639856']

const isClub = async (qid) => {
  const data = await entity(qid)
  const label = `${data.labels.ru ?? ''} ${data.labels.en ?? ''}`.toLowerCase()
  if (/сборн|national team|олимпийск|olympic|молодёжн|молодежн|юношеск|under-?\d/.test(label)) return false

  const kinds = [...ids(data.claims.P31), ...ids(data.claims.P279)]
  if (kinds.some((k) => NATIONAL.includes(k))) return false
  return kinds.some((k) => CLUB.includes(k))
}

const year = (claim) => {
  const time = claim?.value?.time
  return time ? Number(time.slice(1, 5)) : null
}

const PLAYING_AGE = 42

async function clubOf(player, birth) {
  const teams = (player.claims.P54 ?? []).filter((c) => c.rank !== 'deprecated' && id(c))
  const scored = []
  for (const team of teams) {
    const qid = id(team)
    if (!(await isClub(qid))) continue
    const started = team.qualifiers?.P580?.[0]?.time ?? ''
    const ended = team.qualifiers?.P582?.[0]?.time ?? null
    scored.push({
      qid,
      preferred: team.rank === 'preferred',
      started,
      ended,
      years: started && ended ? Number(ended.slice(1, 5)) - Number(started.slice(1, 5)) : 0,
    })
  }
  if (!scored.length) return { qid: null, active: false }

  const retired = new Date().getFullYear() - birth > PLAYING_AGE
  if (!retired) {
    const current = scored
      .filter((t) => !t.ended && (t.started || t.preferred))
      .sort((a, b) => Number(b.preferred) - Number(a.preferred) || b.started.localeCompare(a.started))[0]
    if (current) return { qid: current.qid, active: true }
  }

  const longest = [...scored].sort((a, b) => b.years - a.years || (b.ended ?? '').localeCompare(a.ended ?? ''))[0]
  return { qid: longest.qid, active: false }
}

const main = async () => {
  await fs.mkdir(CACHE, { recursive: true })
  await fs.mkdir(THUMBS, { recursive: true })
  for (const dir of ['full', 'card']) await fs.mkdir(path.join(OUT_IMG, dir), { recursive: true })

  const query = `SELECT ?p ?links WHERE { ?p wdt:P106 wd:Q937857 ; wikibase:sitelinks ?links . FILTER(?links > 60) } ORDER BY DESC(?links) LIMIT ${POOL_SIZE}`
  const list = await cachedJson(CACHE, 'top.json', () => sparql(query))
  const fame = new Map(list.results.bindings.map((b) => [b.p.value.split('/').pop(), Number(b.links.value)]))
  const qids = [...fame.keys()]
  console.log(`кандидатів з Wikidata: ${qids.length}`)

  const rows = []
  await Promise.all(qids.map(async (qid) => rows.push({ qid, player: await entity(qid) })))
  rows.sort((a, b) => qids.indexOf(a.qid) - qids.indexOf(b.qid))

  const linked = new Set()
  for (const { player } of rows)
    for (const prop of ['P413', 'P54', 'P1532', 'P27']) for (const qid of ids(player.claims[prop])) linked.add(qid)
  console.log(`пов'язаних сутностей: ${linked.size}`)
  await Promise.all([...linked].map((qid) => entity(qid).catch(() => null)))

  const terms = new Map()
  const remember = async (qid, ruFallback) => {
    if (!qid) return ruFallback
    const data = await entity(qid)
    const ru = data.labels.ru ?? data.labels.en ?? ruFallback
    if (ru && data.labels.uk && data.labels.en) terms.set(ru, [data.labels.uk, data.labels.en])
    return ru
  }

  const ranked = []
  for (const { qid, player } of rows) {
    const job = ids(player.claims.P106)[0]
    if (job !== 'Q937857') continue

    const birth = year((player.claims.P569 ?? [])[0])
    const image = (player.claims.P18 ?? [])[0]?.value
    if (!birth || !image || typeof image !== 'string') continue

    const tall = (player.claims.P2048 ?? [])[0]?.value
    const raw = Number(tall?.amount ?? 0)
    const height = Math.round(tall?.unit?.endsWith('Q11573') ? raw * 100 : raw)
    if (height < 140 || height > 220) continue

    const roles = []
    for (const role of ids(player.claims.P413)) {
      const mapped = await roleOf(role)
      if (mapped && !roles.includes(mapped)) roles.push(mapped)
    }
    if (!roles.length) continue

    const nationQid = id((player.claims.P1532 ?? [])[0]) ?? id((player.claims.P27 ?? [])[0])
    const country = await remember(nationQid, null)
    if (!country) continue

    const club = await clubOf(player, birth)
    const clubName = club.qid ? await remember(club.qid, null) : null

    const part = PART_OF.get(country)
    if (!part) console.log('невідома частина світу:', country)

    ranked.push({
      fame: fame.get(qid) ?? 0,
      id: Number(qid.slice(1)),
      name: straight(player.labels.ru ?? player.labels.en),
      nameEn: player.labels.en,
      nameUk: player.labels.uk ?? undefined,
      aliases: player.aliases.join(', ') || undefined,
      country,
      part: part ?? EUROPE,
      roles,
      club: clubName ?? 'Неизвестно',
      status: club.active ? PLAYING : RETIRED,
      height,
      birth,
      image,
      answer: true,
      thumb: 0,
    })
  }

  const picked = ranked.slice(0, LEGENDS)
  const chosen = new Set(picked.map((e) => e.id))
  for (const player of ranked.slice(LEGENDS)) {
    if (picked.length >= WANTED) break
    if (player.status === PLAYING) {
      picked.push(player)
      chosen.add(player.id)
    }
  }
  for (const player of ranked.slice(LEGENDS)) {
    if (picked.length >= WANTED) break
    if (!chosen.has(player.id)) picked.push(player)
  }
  const entities = picked.sort((a, b) => b.fame - a.fame)
  for (const player of entities) delete player.fame

  const active = entities.filter((e) => e.status === PLAYING).length
  console.log(`зібрано гравців: ${entities.length} (грають ${active}, завершили ${entities.length - active})`)
  console.log(`порог упізнаваності: від ${Math.min(...picked.map((e) => fame.get('Q' + e.id) ?? 0))} мовних версій`)

  await pool(entities, 2, async (e) => {
    const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(e.image)}?width=900`
    const file = path.join(CACHE, `img-${e.id}`)
    let buf = await fs.readFile(file).catch(() => null)
    for (let attempt = 0; attempt < 4 && !buf; attempt++) {
      await new Promise((r) => setTimeout(r, 400 + attempt * 4000))
      const res = await fetch(url, { headers: { 'User-Agent': 'nandaguessr-build/1.0 (hello@nandaguessr.com)' } }).catch(() => null)
      if (!res?.ok) continue
      buf = Buffer.from(await res.arrayBuffer())
      await fs.writeFile(file, buf)
    }
    if (!buf) return
    await writeFullAndThumb(buf, path.join(OUT_IMG, 'full', `${e.id}.webp`), path.join(THUMBS, `${e.id}.webp`), 96)
  })

  const ready = []
  for (const e of entities) {
    try {
      await fs.access(path.join(THUMBS, `${e.id}.webp`))
      ready.push(e)
    } catch {
      console.log('без фото, пропускаю:', e.nameEn)
    }
  }

  await writeAtlas(ready, THUMBS, path.join(OUT_IMG, 'thumbs.webp'), OUT_ATLAS, 10, 96)
  await pruneImages(path.join(OUT_IMG, 'full'), ready)
  await pruneImages(path.join(OUT_IMG, 'card'), ready)

  for (const e of ready) delete e.image
  await fs.writeFile(OUT_JSON, JSON.stringify(ready, null, 1))
  await fs.writeFile(OUT_TERMS, JSON.stringify(Object.fromEntries([...terms].sort()), null, 1))
  console.log(`записано ${ready.length} гравців, термінів для словника: ${terms.size}`)
}

await main()
