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
  wikiImageUrls,
  wikiPages,
  wikiQuery,
  writeAtlas,
  writeFullAndThumb,
} from './lib.mjs'
import { transliterate } from './ru.mjs'
import { dropDeleted, onlyAnswers } from './dropped.mjs'

const API = 'https://fireforce.fandom.com/api.php'
const CACHE = path.join(ROOT, '.cache', 'ff')
const THUMBS = path.join(CACHE, 'thumb')
const OUT_IMG = path.join(ROOT, 'public', 'ff')
const OUT_JSON = path.join(ROOT, 'src', 'data', 'ff.json')
const OUT_ATLAS = path.join(ROOT, 'src', 'data', 'ff-atlas.json')
const ANSWER_POOL_SIZE = 55
const KEEP = 65

const ARCS = [
  [0, 'Вступление'],
  [13, 'Против 5-й роты'],
  [21, 'Против 1-й роты'],
  [33, 'Асакуса'],
  [52, 'Мастерская Вулкана'],
  [67, 'Преисподняя'],
  [91, 'Пятый столп'],
  [112, 'Китайский полуостров'],
  [131, 'Хаиджима'],
  [152, 'Совместное расследование'],
  [175, 'Спасение Оби'],
  [206, 'Каменные столпы'],
  [230, 'Последний столп'],
  [251, 'Великий катаклизм'],
]

const GENERATION_RULES = [
  ['Первое', /^Category:First Generation$|^Category:Infernal$/],
  ['Второе', /^Category:Second Generation$/],
  ['Третье', /^Category:Third Generation$/],
  ['Четвёртое', /^Category:Fourth Generation$/],
  ['Без силы', /^Category:Non-Powered$/],
]

const TYPE_GENERATION = { 1: 'Первое', 2: 'Второе', 3: 'Третье', 4: 'Четвёртое' }

const AFFILIATION_RULES = [
  ['1-я рота', /company 1\b/i],
  ['2-я рота', /company 2\b/i],
  ['3-я рота', /company 3\b/i],
  ['4-я рота', /company 4\b/i],
  ['5-я рота', /company 5\b/i],
  ['6-я рота', /company 6\b/i],
  ['7-я рота', /company 7\b/i],
  ['8-я рота', /company 8\b/i],
  ['Белые Одежды', /white.clad|knights of the ashen flame|knights of the purple smoke/i],
  ['Хаиджима', /haijima/i],
  ['Храм Святого Солнца', /holy sol/i],
  ['Токийская армия', /tokyo army|fire defence agency|fire defense agency/i],
  ['Асакуса', /asakusa/i],
  ['Герои мира', /world heroes/i],
  ['Асакуса', /ōze|oze family|danrou|takigi|madoka/i],
  ['Храм Святого Солнца', /raffles/i],
]

const AFFILIATION_OVERRIDES = { Amaterasu: ['Адолла'], 'Shinra Kusakabe': ['8-я рота', 'Герои мира'] }

const RANK_RULES = [
  ['Капитан', /^Category:Captains$/],
  ['Лейтенант', /^Category:Lieutenants$/],
  ['Пожарный', /^Category:Fire Soldier$/],
]

const RANK_FIELD_RULES = [
  ['Капитан', /captain/i],
  ['Командир', /commander|chief|general/i],
  ['Лейтенант', /lieutenant|sergeant/i],
  ['Пожарный', /fire soldier|fire officer|private/i],
  ['Священник', /priest|sister|nun|preacher/i],
]

const NAMES = {
  'Shinra Kusakabe': 'Шинра Кусакабэ',
  'Arthur Boyle': 'Артур Бойл',
  'Akitaru Ōbi': 'Акитару Оби',
  'Takehisa Hinawa': 'Такехиса Хинава',
  'Maki Oze': 'Маки Озэ',
  Iris: 'Айрис',
  'Tamaki Kotatsu': 'Тамаки Котацу',
  'Vulcan Joseph': 'Вулкан Джозеф',
  'Victor Licht': 'Виктор Лихт',
  'Viktor Licht': 'Виктор Лихт',
  'Raffles III': 'Раффлс III',
  'Raffles Smith': 'Раффлс Смит',
  'Madoka Oze': 'Мадока Озэ',
  'Takigi Oze': 'Такиги Озэ',
  'Danrou Oze': 'Данро Озэ',
  'Daikoku Oguru': 'Дайкоку Огуру',
  'Tōjō': 'Тодзё',
  'Setsuo Miyamoto': 'Сэцуо Миямото',
  'Karin Sasaki': 'Карин Сасаки',
  'Gureo Haijima': 'Гурэо Хайджима',
  'Inca Kasugatani': 'Инка Касугатани',
  Evangelist: 'Евангелист',
  Onyango: 'Оньянго',
  Orochi: 'Орочи',
  Hikage: 'Хикагэ',
  Hinata: 'Хината',
  Kantarō: 'Кантаро',
  Saki: 'Саки',
  'Benimaru Shinmon': 'Бенимару Шинмон',
  'Shō Kusakabe': 'Шо Кусакабэ',
  'Sōichirō Hague': 'Соитиро Хааг',
  'Leonard Burns': 'Леонард Бёрнс',
  'Karim Flam': 'Карим Флам',
  'Huo Yan Li': 'Хуо Янь Ли',
  'Rekka Hoshimiya': 'Рэкка Хошимия',
  'Princess Hibana': 'Принцесса Хибана',
  'Konro Sagamiya': 'Конро Сагамия',
  'Hikage Shinmon': 'Хикагэ Шинмон',
  'Hinata Shinmon': 'Хината Шинмон',
  'Gustav Honda': 'Густав Хонда',
  'Foien Li': 'Фоень Ли',
  'Pan Ko Paat': 'Пан Ко Паат',
  'Joker (Fire Force)': 'Джокер',
  Joker: 'Джокер',
  'Haumea': 'Хаумеа',
  'Charon': 'Харон',
  'Inca': 'Инка',
  'Sho Kusakabe': 'Шо Кусакабэ',
  'Yona': 'Иона',
  'Dr. Giovanni': 'Доктор Джованни',
  'Giovanni': 'Джованни',
  'Kurono Yūichirō': 'Юитиро Куроно',
  'Yūichirō Kurono': 'Юитиро Куроно',
  'Sumire': 'Сумирэ',
  'Nataku Son': 'Натаку Сон',
  'Ogun Montgomery': 'Огун Монтгомери',
  'Tōru Kishiri': 'Тору Кишири',
  'Juggernaut': 'Джаггернаут',
  'Flail': 'Флейл',
  'Lisa Isaribi': 'Лиза Исариби',
  'Mirage': 'Мираж',
  'Assault': 'Ассолт',
  'Arrow': 'Эрроу',
  'Ritsu': 'Рицу',
  'Scop': 'Скоп',
  'Carol': 'Кэрол',
  'Schop': 'Шоп',
  'Hajiki': 'Хаджики',
  'Amon Hajiki': 'Амон Хаджики',
  'Mari Kusakabe': 'Мари Кусакабэ',
  'Asako Hague': 'Асако Хааг',
  'Akitaru Obi': 'Акитару Оби',
  'Kayoko Huang': 'Каёко Хуан',
  'Nozomi': 'Нодзоми',
  'Shinmon Benimaru': 'Бенимару Шинмон',
  'Hibana': 'Хибана',
  'Sasori': 'Сасори',
  'Kirino': 'Кирино',
  'Nō': 'Но',
  'Tempe': 'Темпе',
  'Ōze Family': 'Семья Озэ',
  'Takigi Ōze': 'Такиги Озэ',
  'Shinra': 'Шинра',
  'Amaterasu': 'Аматэрасу',
  'Dragon': 'Дракон',
  'Lieutenant Rekka': 'Рэкка',
  'Burns': 'Бёрнс',
  'Waka': 'Вака',
  'Licht': 'Лихт',
}

const EXCLUDE = new Set([
  'Shinrabanshōman',
  'Beauty',
  'Panda',
  'Sancho',
  'Masao',
  'Mikako',
  'Schop',
  'Saeko',
  'Yo-chan',
  'Mamoru',
  'Q',
  'Race',
  'Conehead',
  'Faerie',
  'Gold',
  'Iron',
  'Jonas',
  'Haran',
  'Furakuchu',
  'Fire Defence Agency Chief',
  "Holy Sol's Shadow Captain",
  'Mr. Boyle',
  'Mrs. Boyle',
  'God',
  'Dragon',
  'Yū',
])

const matchRules = (rules, values) => rules.filter(([, re]) => values.some((v) => re.test(v))).map(([label]) => label)

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

const arcIndexOf = (chapter) => ARCS.reduce((idx, [start], i) => (chapter >= start ? i : idx), 0)

async function chapterTitles() {
  const all = []
  let cont
  do {
    const res = await fetch(`${API}?format=json&action=query&list=categorymembers&cmtitle=Category:Chapters&cmlimit=500${cont ? `&cmcontinue=${encodeURIComponent(cont)}` : ''}`)
    const json = await res.json()
    all.push(...json.query.categorymembers.map((x) => x.title))
    cont = json.continue?.cmcontinue
  } while (cont)
  const titles = {}
  for (let i = 0; i < all.length; i += 40) {
    const res = await fetch(`${API}?format=json&action=query&prop=revisions&rvprop=content&rvslots=main&titles=${encodeURIComponent(all.slice(i, i + 40).join('|'))}`)
    for (const page of Object.values((await res.json()).query.pages)) {
      const text = page.revisions?.[0]?.slots?.main['*'] ?? ''
      const number = Number(text.match(/\|\s*chapter\s*=\s*(\d+)/)?.[1])
      const title = text.match(/\{\{translation\|'''([^']+)'''/)?.[1]
      if (title && Number.isFinite(number)) titles[title] = number
    }
  }
  return titles
}

async function arcChapters() {
  const res = await fetch(`${API}?format=json&action=query&list=categorymembers&cmtitle=Category:Arcs&cmlimit=100`)
  const arcs = (await res.json()).query.categorymembers.map((x) => x.title).filter((t) => / arc$/i.test(t))
  const query = await fetch(`${API}?format=json&action=query&prop=revisions&rvprop=content&rvslots=main&titles=${encodeURIComponent(arcs.join('|'))}`)
  const numbers = {}
  for (const page of Object.values((await query.json()).query.pages)) {
    const text = page.revisions?.[0]?.slots?.main['*'] ?? ''
    const raw = text.match(/\|\s*chapters\s*=([\s\S]*?)\n\|/)?.[1] ?? ''
    for (const m of raw.matchAll(/\[\[([^\]|]+)\|(\d+)\]\]|\[\[Chapter (\d+)\]\]/g)) numbers[m[1] ?? `Chapter ${m[3]}`] = Number(m[2] ?? m[3])
  }
  return numbers
}

const normalizeTitle = (title) => title.toLowerCase().replace(/\s*\((chapter|episode)[^)]*\)/i, '').replace(/^the /, '').replace(/[^a-z0-9]/g, '')

async function chapterNumbers(titles) {
  const numbers = { ...(await arcChapters()), ...(await chapterTitles()) }
  const normalized = Object.fromEntries(Object.entries(numbers).map(([t, n]) => [normalizeTitle(t), n]))
  for (let i = 0; i < titles.length; i += 40) {
    const batch = titles.slice(i, i + 40)
    const res = await fetch(
      `${API}?format=json&action=query&redirects=1&prop=revisions&rvprop=content&rvslots=main&titles=${encodeURIComponent(batch.join('|'))}`,
    )
    const query = (await res.json()).query
    const resolved = Object.fromEntries((query.redirects ?? []).map((r) => [r.from, r.to]))
    const content = {}
    for (const page of Object.values(query.pages ?? {})) content[page.title] = page.revisions?.[0]?.slots?.main['*'] ?? ''
    for (const title of batch) {
      const target = resolved[title] ?? title
      const direct = target.match(/^Chapter (\d+)$/)
      const inBox = content[target]?.match(/\|\s*chapter\s*=\s*(\d+)/)
      if (direct) numbers[title] = Number(direct[1])
      else if (inBox) numbers[title] = Number(inBox[1])
      else if (normalized[normalizeTitle(title)] !== undefined) numbers[title] = normalized[normalizeTitle(title)]
    }
  }
  return numbers
}

async function main() {
  await fs.mkdir(path.join(CACHE, 'img'), { recursive: true })
  await fs.mkdir(THUMBS, { recursive: true })
  await fs.mkdir(path.join(OUT_IMG, 'full'), { recursive: true })

  const names = await cachedJson(CACHE, 'members.json', () => categoryMembers(API, 'Characters'))
  const pages = await cachedJson(CACHE, 'pages.json', () => wikiPages(API, names))
  const boxes = await cachedJson(CACHE, 'boxes.json', () => wikiPages(API, names.map((n) => `Infobox:${n}`)))
  const candidates = names.filter((n) => boxes[`Infobox:${n}`]?.text && pages[n]?.text && !/doppelg/i.test(n) && !EXCLUDE.has(n))
  const debuts = [...new Set(candidates.map((n) => plain(field(boxes[`Infobox:${n}`].text, 'manga')).split('\n')[0].trim()).filter(Boolean))]
  const chapters = await cachedJson(CACHE, 'chapters.json', () => chapterNumbers(debuts))
  const categories = await cachedJson(CACHE, 'categories.json', async () => {
    const res = await wikiQuery(API, candidates, 'prop=categories&cllimit=500')
    return Object.fromEntries(Object.entries(res).map(([t, p]) => [t, (p.categories ?? []).map((c) => c.title)]))
  })
  const boxImages = Object.fromEntries(
    candidates.map((n) => [n, (plain(field(boxes[`Infobox:${n}`].text, 'image')) || '').split(',').map((s) => s.split(';')[0].trim()).filter(Boolean)]),
  )
  const fileUrls = await cachedJson(CACHE, 'files.json', () => wikiImageUrls(API, [...new Set(Object.values(boxImages).flat())]))

  const result = []
  await pool(candidates, 8, async (name) => {
    const { id, ru, length } = pages[name]
    const box = boxes[`Infobox:${name}`].text
    const cats = categories[name] ?? []
    const sources = boxImages[name].map((f) => fileUrls[f]).filter(Boolean)
    const buf = await cachedDownload(path.join(CACHE, 'img'), String(id), sources)
    if (!buf) return console.warn('no image', name)
    try {
      await writeFullAndThumb(buf, path.join(OUT_IMG, 'full', `${id}.webp`), path.join(THUMBS, `${id}.webp`), 96)
    } catch (e) {
      return console.warn('image failed', name, e.message)
    }
    const debut = plain(field(box, 'manga')).split('\n')[0].trim()
    const chapter = chapters[debut] ?? (debut.match(/^Chapter (\d+)$/)?.[1] !== undefined ? Number(debut.match(/^Chapter (\d+)$/)[1]) : null)
    if (chapter === null) return console.warn('no chapter', name, debut)
    const arcIndex = arcIndexOf(chapter)
    const typeField = plain(field(box, 'type')).trim()
    const byType = [...typeField].map((d) => TYPE_GENERATION[d]).filter(Boolean)
    const generations = matchRules(GENERATION_RULES, cats)
    const affiliationText = `${plain(field(box, 'affiliation'))} ${cats.join(' ')}`
    const rankField = plain(field(box, 'rank')) + ' ' + plain(field(box, 'occupation'))
    const gender = cats.includes('Category:Female Characters')
      ? 'Женский'
      : cats.includes('Category:Male Characters')
        ? 'Мужской'
        : /female/i.test(plain(field(box, 'gender')))
          ? 'Женский'
          : /male/i.test(plain(field(box, 'gender')))
            ? 'Мужской'
            : 'Другое'
    result.push({
      id,
      name: NAMES[name] ?? ruName(name.replace(/\s*\(.*\)$/, ''), ru, transliterate),
      nameEn: name.replace(/\s*\(.*\)$/, ''),
      gender,
      generations: (byType.length ? byType : generations).length ? (byType.length ? byType : generations) : ['Без силы'],
      affiliations: AFFILIATION_OVERRIDES[name] ?? (matchRules(AFFILIATION_RULES, [`${affiliationText} ${name}`]).length ? matchRules(AFFILIATION_RULES, [`${affiliationText} ${name}`]) : ['Гражданские']),
      rank: matchRules(RANK_RULES, cats)[0] ?? RANK_FIELD_RULES.find(([, re]) => re.test(rankField))?.[0] ?? 'Нет',
      side: cats.includes('Category:Antagonists') ? 'Злодей' : cats.includes('Category:Former Antagonists') ? 'Бывший злодей' : 'Герой',
      status: cats.includes('Category:Deceased') || /deceased/i.test(plain(field(box, 'status'))) ? 'Мёртв' : 'Жив',
      arc: ARCS[arcIndex][1],
      arcIndex,
      length,
    })
  })

  result.sort((a, b) => b.length - a.length)
  let picked = 0
  for (const c of result) {
    c.answer = picked < ANSWER_POOL_SIZE
    if (c.answer) picked++
    delete c.length
  }
  const kept = keepNotable(result, KEEP)
  result.length = 0
  result.push(...kept)
  dropDeleted(result, 'ff')
  onlyAnswers(result)
  result.sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  await writeAtlas(result, THUMBS, path.join(OUT_IMG, 'thumbs.webp'), OUT_ATLAS, 12, 96)
  await pruneImages(path.join(OUT_IMG, 'full'), result)
  await fs.writeFile(OUT_JSON, JSON.stringify(result, null, 1))
  console.log(`wrote ${result.length} characters (${result.filter((c) => c.answer).length} answerable)`)
}

main()
