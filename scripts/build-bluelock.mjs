import fs from 'node:fs/promises'
import path from 'node:path'
import {
  ROOT,
  cachedDownload,
  cachedJson,
  categoryMembers,
  infobox,
  keepNotable,
  plain,
  pool,
  pruneImages,
  ruName,
  wikiPages,
  wikiImageUrls,
  wikiQuery,
  writeAtlas,
  writeFullAndThumb,
} from './lib.mjs'
import { transliterate } from './ru.mjs'

const API = 'https://bluelock.fandom.com/api.php'
const CACHE = path.join(ROOT, '.cache', 'bluelock')
const THUMBS = path.join(CACHE, 'thumb')
const OUT_IMG = path.join(ROOT, 'public', 'bluelock')
const OUT_JSON = path.join(ROOT, 'src', 'data', 'bluelock.json')
const OUT_ATLAS = path.join(ROOT, 'src', 'data', 'bluelock-atlas.json')
const ANSWER_POOL_SIZE = 45
const KEEP = 60
const EXCLUDE = new Set(['Characters', 'List of Characters', 'Birthdays', 'Hirotoshi Buratsuta'])

const ARCS = [
  [1, 'Начало'],
  [5, 'Первый отбор'],
  [39, 'Второй отбор'],
  [87, 'Третий отбор'],
  [109, 'Матч с U-20'],
  [152, 'Лига Нео Эгоистов'],
  [303, 'Чемпионат мира U-20'],
]

const POSITION_RULES = [
  ['Нападающий', /forward|striker/i],
  ['Вингер', /wing(?!\s*-?\s*back)|winger/i],
  ['Полузащитник', /midfielder/i],
  ['Защитник', /back\b|defender|wing-?back/i],
  ['Вратарь', /goalkeeper/i],
]

const CLUBS = [
  ['Бастард Мюнхен', /bastard m[üu]nchen/i],
  ['Пари Экс Жен', /paris x gen|\bpxg\b/i],
  ['Маншайн Сити', /manshine city/i],
  ['Уберс', /\bubers\b/i],
  ['ФК Барча', /fc barcha/i],
]

const COUNTRIES = [
  ['Япония', /japan/i],
  ['Англия', /england/i],
  ['Германия', /germany/i],
  ['Франция', /france/i],
  ['Италия', /italy/i],
  ['Испания', /spain/i],
  ['Бразилия', /brazil/i],
  ['Аргентина', /argentina/i],
  ['Нигерия', /nigeria/i],
  ['Мальта', /malta/i],
]

const CLUB_OVERRIDES = { 'Tabito Karasu': 'Пари Экс Жен' }
const NO_CLUB = 'Не в NEL'

const COUNTRY_OVERRIDES = { 'Michael Kaiser': 'Германия', 'Alexis Ness': 'Германия', 'Noel Noa': 'Франция', 'Julien Loki': 'Франция' }

const NAMES = {
  'Yoichi Isagi': 'Ёичи Исаги',
  'Seishiro Nagi': 'Сейширо Наги',
  'Shoei Baro': 'Шоэй Бароу',
  'Ryusei Shido': 'Рюсей Шидо',
  'Michael Kaiser': 'Михаэль Кайзер',
  'Alexis Ness': 'Алексис Несс',
  'Noel Noa': 'Ноэль Ноа',
  'Julien Loki': 'Жюльен Локи',
  'Don Lorenzo': 'Дон Лоренцо',
  'Chris Prince': 'Крис Принс',
  'Charles Chevalier': 'Шарль Шевалье',
  'Marc Snuffy': 'Марк Снаффи',
  'Lavinho': 'Лавиньо',
  'Pablo Cavasoz': 'Пабло Кавасос',
  'Adam Blake': 'Адам Блейк',
  'Leonardo Luna': 'Леонардо Луна',
  'Ignacio Lara': 'Игнасио Лара',
  'Dada Silva': 'Дада Силва',
  'Innocent Onazi': 'Инносент Онази',
  'Igor Schneider': 'Игорь Шнайдер',
  'Erik Gesner': 'Эрик Геснер',
  'Frederick Kaiser': 'Фредерик Кайзер',
  'Teddy Knight': 'Тедди Найт',
  'Vivien Hugo': 'Вивьен Юго',
  Rooke: 'Рук',
  'Mick Moon': 'Мик Мун',
  Camus: 'Камю',
  Lockhart: 'Локхарт',
  'Anri Teieri': 'Анри Тейэри',
  'Hazime Nishioka': 'Хаджиме Нишиока',
}

function field(text, name) {
  const raw = infobox(text, name) ?? ''
  let depth = 0
  for (let i = 0; i < raw.length - 1; i++) {
    const pair = raw.slice(i, i + 2)
    if (pair === '{{') depth++, i++
    else if (pair === '}}') {
      if (depth === 0) return raw.slice(0, i)
      depth--, i++
    }
  }
  return raw
}

const firstMatch = (rules, text) => rules.find(([, re]) => re.test(text))?.[0]
const matchRules = (rules, text) => rules.filter(([, re]) => re.test(text)).map(([label]) => label)

function debutChapter(text) {
  const m = field(text, 'manga debut').match(/Chapter (\d+)(?! \(Episode)/i)
  return m ? Number(m[1]) : null
}

const arcIndexOf = (chapter) => ARCS.reduce((idx, [start], i) => (chapter >= start ? i : idx), 0)

function animeFile(text) {
  const gallery = text.match(/\|\s*image\s*=\s*<gallery>([\s\S]*?)<\/gallery>/i)?.[1] ?? ''
  const line = gallery.split('\n').find((l) => /\|\s*anime\b/i.test(l))
  return line?.split('|')[0].trim() || null
}

function role(name, texts) {
  const { occupation, affiliations, teams } = texts
  const blueLock = /blue lock|side-b|top 6/i.test(affiliations) || /\[\[Team [A-Z]\]\]|blue lock eleven/i.test(teams)
  const staff = /coach|trainer|director|manager|jfu|chairman|agent/i.test(`${occupation} ${affiliations}`) || /jfu member/i.test(texts.position)
  if (staff && !/football player|student/i.test(occupation)) return 'Персонал'
  if (blueLock) return 'Игрок Блю Лока'
  if (/football player/i.test(occupation) || /u-20|national team|\bfc\b|city|m[üu]nchen|gen\b|ubers|re al/i.test(teams)) return 'Футболист'
  return 'Другое'
}

async function main() {
  await fs.mkdir(path.join(CACHE, 'img'), { recursive: true })
  await fs.mkdir(THUMBS, { recursive: true })
  await fs.mkdir(path.join(OUT_IMG, 'full'), { recursive: true })

  const names = (await cachedJson(CACHE, 'members.json', () => categoryMembers(API, 'Characters'))).filter((n) => !EXCLUDE.has(n))
  const pages = await cachedJson(CACHE, 'pages.json', () => wikiPages(API, names))
  const candidates = names.filter((n) => pages[n]?.text && /\{\{Character/i.test(pages[n].text) && debutChapter(pages[n].text) !== null)
  const images = await cachedJson(CACHE, 'images.json', async () => {
    const res = await wikiQuery(API, candidates, 'prop=pageimages&piprop=original')
    return Object.fromEntries(Object.entries(res).map(([t, p]) => [t, p.original?.source ?? null]))
  })
  const animeFiles = Object.fromEntries(candidates.map((n) => [n, animeFile(pages[n].text)]).filter(([, f]) => f))
  const animeUrls = await cachedJson(CACHE, 'anime-images.json', () => wikiImageUrls(API, Object.values(animeFiles)))

  const result = []
  await pool(candidates, 10, async (name) => {
    const { id, text, ru, length } = pages[name]
    if (!images[name] || /no.?image/i.test(images[name])) return console.warn('no image', name)
    const buf = await cachedDownload(path.join(CACHE, 'img'), `${id}-v2`, [animeUrls[animeFiles[name]], images[name]])
    if (!buf) return console.warn('no image', name)
    try {
      await writeFullAndThumb(buf, path.join(OUT_IMG, 'full', `${id}.webp`), path.join(THUMBS, `${id}.webp`), 96)
    } catch (e) {
      return console.warn('image failed', name, e.message)
    }
    const texts = {
      occupation: plain(field(text, 'occupation')),
      affiliations: plain(`${field(text, 'affiliation')}\n${field(text, 'f. affiliation')}`),
      teams: `${field(text, 'team')}\n${field(text, 'f. team')}`,
      position: plain(field(text, 'position')),
    }
    const found = role(name, texts)
    const player = found !== 'Персонал' && found !== 'Другое'
    const country =
      COUNTRY_OVERRIDES[name] ??
      firstMatch(COUNTRIES, plain(field(text, 'affiliation'))) ??
      firstMatch(COUNTRIES, plain(texts.teams).replace(/japan u-20/gi, found === 'Игрок Блю Лока' ? 'Japan' : '')) ??
      'Япония'
    const kind = found === 'Игрок Блю Лока' && country !== 'Япония' ? 'Футболист' : found
    const chapter = debutChapter(text)
    const arcIndex = arcIndexOf(chapter)
    result.push({
      id,
      name: NAMES[name] ?? ruName(name, ru, transliterate),
      nameEn: name,
      role: kind,
      positions: player ? matchRules(POSITION_RULES, texts.position) : [],
      country,
      club: CLUB_OVERRIDES[name] ?? (player ? (firstMatch(CLUBS, plain(texts.teams)) ?? NO_CLUB) : NO_CLUB),
      arc: ARCS[arcIndex][1],
      arcIndex,
      length,
    })
  })

  result.sort((a, b) => b.length - a.length)
  let picked = 0
  for (const c of result) {
    c.answer = picked < ANSWER_POOL_SIZE && c.role !== 'Другое'
    if (c.answer) picked++
    delete c.length
  }
  const kept = keepNotable(result, KEEP)
  result.length = 0
  result.push(...kept)
  result.sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  await writeAtlas(result, THUMBS, path.join(OUT_IMG, 'thumbs.webp'), OUT_ATLAS, 12, 96)
  await pruneImages(path.join(OUT_IMG, 'full'), result)
  await fs.writeFile(OUT_JSON, JSON.stringify(result, null, 1))
  console.log(`wrote ${result.length} characters (${result.filter((c) => c.answer).length} answerable)`)
}

main()
