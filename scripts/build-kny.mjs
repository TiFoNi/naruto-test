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
  wikiQuery,
  writeAtlas,
  writeFullAndThumb,
} from './lib.mjs'
import { transliterate } from './ru.mjs'
import { dropDeleted, onlyAnswers } from './dropped.mjs'

const API = 'https://kimetsu-no-yaiba.fandom.com/api.php'
const CACHE = path.join(ROOT, '.cache', 'kny')
const THUMBS = path.join(CACHE, 'thumb')
const OUT_IMG = path.join(ROOT, 'public', 'kny')
const OUT_JSON = path.join(ROOT, 'packages', 'game', 'data', 'kny.json')
const OUT_ATLAS = path.join(ROOT, 'packages', 'game', 'data', 'kny-atlas.json')
const ANSWER_POOL_SIZE = 45
const KEEP = 56
const EXCLUDE = new Set([
  'Characters',
  'Characters/Minor',
  'Ubume',
  'Kozo Kanamori',
  'Keizo',
  'Koyuki',
  'Kanata Ubuyashiki',
  'Kiriya Ubuyashiki',
  'Kuina Ubuyashiki',
  'Sumihiko Kamado',
  'Kaburamaru',
  'Kotoha Hashibira',
  'Masachika Kumeno',
  'Nichika Ubuyashiki',
  'Takeo Kamado',
])
const ALWAYS = new Set(['Aoi Kanzaki'])

const ARCS = [
  [1, 'Финальный отбор'],
  [9, 'Первые задания'],
  [28, 'Гора Натагумо'],
  [45, 'Поместье бабочек'],
  [53, 'Бесконечный поезд'],
  [70, 'Квартал удовольствий'],
  [98, 'Деревня кузнецов'],
  [128, 'Тренировка столпов'],
  [140, 'Бесконечная крепость'],
  [184, 'Рассвет'],
  [205, 'Эпилог'],
]

const SEX = { Male: 'Мужской', Female: 'Женский' }

const KIZUKI = {
  'Muzan Kibutsuji': 'Прародитель демонов',
  Kokushibo: 'Высшая луна',
  Doma: 'Высшая луна',
  Akaza: 'Высшая луна',
  Hantengu: 'Высшая луна',
  Nakime: 'Высшая луна',
  Gyokko: 'Высшая луна',
  Daki: 'Высшая луна',
  Gyutaro: 'Высшая луна',
  Kaigaku: 'Высшая луна',
  Enmu: 'Низшая луна',
  Rokuro: 'Низшая луна',
  Wakuraba: 'Низшая луна',
  Mukago: 'Низшая луна',
  Rui: 'Низшая луна',
  Kamanue: 'Низшая луна',
  Kyogai: 'Низшая луна',
}

const RANK_RULES = [
  ['Столп', /hashira/i],
  ['Цугуко', /tsuguko/i],
  ['Глава корпуса', /leader of demon slayer corps|head of the ubuyashiki/i],
  ['Наставник', /cultivator/i],
  ['Истребитель', /demon slayer\b/i],
  ['Какуши', /cleanup brigade|kakushi/i],
  ['Кузнец', /swordsmith/i],
]

const AFFILIATION_RULES = [
  ['Корпус истребителей', /demon slayer corps|kakushi|kasugai crow/i],
  ['Двенадцать лун', /twelve kizuki/i],
  ['Семья пауков', /spider/i],
  ['Поместье бабочек', /butterfly mansion/i],
  ['Деревня кузнецов', /swordsmith village/i],
  ['Тамаё и Юширо', /tamayo|yushiro|chachamaru/i],
  ['Квартал удовольствий', /kyogoku house|tokito house|ogimoto house/i],
  ['Урокодаки', /sakonji urokodaki/i],
]

const STYLE_RULES = [
  ['Дыхание солнца', /sun breathing|hinokami kagura/i],
  ['Дыхание воды', /water breathing/i],
  ['Дыхание пламени', /flame breathing/i],
  ['Дыхание грома', /thunder breathing/i],
  ['Дыхание зверя', /beast breathing/i],
  ['Дыхание цветка', /flower breathing/i],
  ['Дыхание ветра', /wind breathing/i],
  ['Дыхание камня', /stone breathing/i],
  ['Дыхание любви', /love breathing/i],
  ['Дыхание тумана', /mist breathing/i],
  ['Дыхание змеи', /serpent breathing/i],
  ['Дыхание звука', /sound breathing/i],
  ['Дыхание насекомого', /insect breathing/i],
  ['Дыхание луны', /moon breathing/i],
  ['Кровавая техника', /blood demon art/i],
]

const RACE_OVERRIDES = { 'Nezuko Kamado': 'Демон', 'Tanjiro Kamado': 'Человек' }

const NAMES = {
  'Tanjiro Kamado': 'Танджиро Камадо',
  'Nezuko Kamado': 'Нэдзуко Камадо',
  'Zenitsu Agatsuma': 'Зеницу Агацума',
  'Inosuke Hashibira': 'Иноске Хашибира',
  'Giyu Tomioka': 'Гию Томиока',
  'Kyojuro Rengoku': 'Кёджуро Ренгоку',
  'Shinobu Kocho': 'Шинобу Кочо',
  'Muzan Kibutsuji': 'Мудзан Кибуцуджи',
  Sabito: 'Сабито',
  'Spider Demon (Mother)': 'Демон-паук (мать)',
  'Spider Demon (Father)': 'Демон-паук (отец)',
  'Spider Demon (Son)': 'Демон-паук (сын)',
  'Spider Demon (Daughter)': 'Демон-паук (дочь)',
  Doma: 'Дома',
  Kokushibo: 'Кокушибо',
}

const firstMatch = (rules, text) => rules.find(([, re]) => re.test(text))?.[0]

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

const matchRules = (rules, text) => rules.filter(([, re]) => re.test(text)).map(([label]) => label)

const lines = (raw) =>
  (raw ?? '')
    .split(/<br\s*\/?>|\n/i)
    .map((l) => l.trim())
    .filter(Boolean)

const current = (raw) => lines(raw).filter((l) => !/formerly|temporarily|former master/i.test(l)).join('\n')

function race(name, raw) {
  if (RACE_OVERRIDES[name]) return RACE_OVERRIDES[name]
  const parts = lines(raw)
  const now = parts.find((l) => /currently/i.test(l)) ?? parts.find((l) => !/formerly|temporarily/i.test(l)) ?? parts[0] ?? ''
  if (/demon/i.test(now)) return 'Демон'
  if (/human/i.test(now)) return 'Человек'
  return 'Животное'
}

function status(raw) {
  const text = raw ?? ''
  if (/active|alive|retired/i.test(text)) return 'Жив'
  if (/deceased/i.test(text)) return 'Мёртв'
  return 'Неизвестно'
}

function debutChapter(text) {
  const m = (infobox(text, 'manga_debut') ?? '').match(/Chapter (\d+)/i)
  return m ? Number(m[1]) : null
}

const arcIndexOf = (chapter) => ARCS.reduce((idx, [start], i) => (chapter >= start ? i : idx), 0)

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

  const result = []
  await pool(candidates, 10, async (name) => {
    const { id, text, ru, length } = pages[name]
    const buf = await cachedDownload(path.join(CACHE, 'img'), String(id), [images[name]])
    if (!buf) return console.warn('no image', name)
    try {
      await writeFullAndThumb(buf, path.join(OUT_IMG, 'full', `${id}.webp`), path.join(THUMBS, `${id}.webp`), 96)
    } catch (e) {
      return console.warn('image failed', name, e.message)
    }
    const species = race(name, infobox(text, 'race'))
    const affiliationText = plain(lines(field(text, 'affiliation')).filter((l) => !/former master/i.test(l)).join('\n'))
    const affiliations = matchRules(AFFILIATION_RULES, affiliationText)
    const rank = KIZUKI[name] ?? (species === 'Демон' ? 'Нет' : firstMatch(RANK_RULES, plain(field(text, 'occupation'))) ?? 'Нет')
    if (!['Нет', 'Кузнец', 'Высшая луна', 'Низшая луна', 'Прародитель демонов'].includes(rank) && !affiliations.includes('Корпус истребителей')) affiliations.unshift('Корпус истребителей')
    if (['Высшая луна', 'Низшая луна'].includes(rank) && !affiliations.includes('Двенадцать лун')) affiliations.unshift('Двенадцать лун')
    const styles = matchRules(STYLE_RULES, current(field(text, 'combat_style')))
    const chapter = debutChapter(text)
    const arcIndex = arcIndexOf(chapter)
    result.push({
      id,
      name: NAMES[name] ?? ruName(name, ru, transliterate),
      nameEn: name,
      gender: SEX[plain(infobox(text, 'gender') ?? '').trim()] ?? 'Неизвестно',
      species,
      affiliations,
      rank,
      styles: species === 'Демон' && !styles.length ? ['Кровавая техника'] : styles,
      status: status(infobox(text, 'status')),
      arc: ARCS[arcIndex][1],
      arcIndex,
      length,
    })
  })

  result.sort((a, b) => b.length - a.length)
  let picked = 0
  for (const c of result) {
    c.answer = picked < ANSWER_POOL_SIZE && c.arcIndex < ARCS.length - 1 && c.species !== 'Животное'
    if (c.answer) picked++
    delete c.length
  }
  const kept = keepNotable(result, KEEP).concat(result.filter((c, i) => i >= KEEP && ALWAYS.has(c.nameEn)))
  result.length = 0
  result.push(...kept)
  dropDeleted(result, 'kny')
  onlyAnswers(result)
  result.sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  await writeAtlas(result, THUMBS, path.join(OUT_IMG, 'thumbs.webp'), OUT_ATLAS, 12, 96)
  await pruneImages(path.join(OUT_IMG, 'full'), result)
  await fs.writeFile(OUT_JSON, JSON.stringify(result, null, 1))
  console.log(`wrote ${result.length} characters (${result.filter((c) => c.answer).length} answerable)`)
}

main()
