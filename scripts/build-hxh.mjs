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
import { dropDeleted } from './dropped.mjs'

const API = 'https://hunterxhunter.fandom.com/api.php'
const CACHE = path.join(ROOT, '.cache', 'hxh')
const THUMBS = path.join(CACHE, 'thumb')
const OUT_IMG = path.join(ROOT, 'public', 'hxh')
const OUT_JSON = path.join(ROOT, 'src', 'data', 'hxh.json')
const OUT_ATLAS = path.join(ROOT, 'src', 'data', 'hxh-atlas.json')
const ANSWER_POOL_SIZE = 55
const KEEP = 70

const ARCS = [
  [1, 'Экзамен на охотника'],
  [44, 'Небесная арена'],
  [64, 'Йоркшин'],
  [120, 'Жадный остров'],
  [186, 'Муравьи-химеры'],
  [319, 'Выборы председателя'],
  [340, 'Тёмный континент'],
]

const SEX = { Male: 'Мужской', Female: 'Женский' }

const NEN_RULES = [
  ['Усиление', /enhanc/i],
  ['Испускание', /emission|emitter/i],
  ['Трансформация', /transmut/i],
  ['Материализация', /conjur/i],
  ['Специализация', /specializ/i],
  ['Манипуляция', /manipulat/i],
]

const SPECIES_RULES = [
  ['Муравей-химера', /^Category:Chimera Ants$/],
  ['Магический зверь', /^Category:(Magical Beasts|Kiriko|Animals)$/],
]

const AFFILIATION_RULES = [
  ['Ассоциация охотников', /hunter association|zodiacs|v5|hunter exam/i],
  ['Труппа Призраков', /phantom troupe/i],
  ['Семья Золдик', /zoldyck/i],
  ['Муравьи-химеры', /chimera ant/i],
  ['Гвардия Короля', /royal guard/i],
  ['Куруты', /kurta/i],
  ['Мафия', /mafia|shadow beasts|ten dons/i],
  ['Королевство Какин', /kakin/i],
  ['Небесная арена', /heavens arena/i],
  ['Жадный остров', /greed island/i],
]

const STATUS_RULES = [
  ['Жив', /alive/i],
  ['Мёртв', /deceased|dead/i],
]

const SPECIES_OVERRIDES = { Kite: ['Человек'], 'Palm Siberia': ['Человек'] }

const NAMES = {
  'Gon Freecss': 'Гон Фрикс',
  'Killua Zoldyck': 'Киллуа Золдик',
  Kurapika: 'Курапика',
  'Leorio Paradinight': 'Леорио Параднайт',
  'Hisoka Morow': 'Хисока Морроу',
  'Chrollo Lucilfer': 'Куроро Люцифер',
  'Ging Freecss': 'Джин Фрикс',
  Meruem: 'Меруэм',
  'Isaac Netero': 'Айзек Нетеро',
  'Illumi Zoldyck': 'Иллуми Золдик',
  Feitan: 'Фейтан',
  Machi: 'Мачи',
  Shalnark: 'Шалнарк',
  Biscuit: 'Бисквит',
  'Biscuit Krueger': 'Бисквит Крюгер',
  Neferpitou: 'Нефелпиту',
  Shaiapouf: 'Шайяпуф',
  Menthuthuyoupi: 'Ментутуюпи',
  'Silva Zoldyck': 'Силва Золдик',
  'Zeno Zoldyck': 'Зено Золдик',
  Palm: 'Пальм',
  'Palm Siberia': 'Пальм Сиберия',
  Knuckle: 'Наклз',
  'Knuckle Bine': 'Наклз Байн',
  Shoot: 'Шут',
  'Shoot McMahon': 'Шут Макмахон',
  Morel: 'Морел',
  'Morel Mackernasey': 'Морел Маккернэси',
  Bisky: 'Биски',
  Alluka: 'Аллука',
  'Alluka Zoldyck': 'Аллука Золдик',
  Nanika: 'Наника',
  Komugi: 'Комуги',
  Welfin: 'Велфин',
  Kite: 'Кайт',
  Pariston: 'Паристон',
  'Pariston Hill': 'Паристон Хилл',
  Cheadle: 'Чидл',
  'Cheadle Yorkshire': 'Чидл Йоркшир',
  Basho: 'Башо',
  Genthru: 'Гентру',
  Knov: 'Кнов',
  Razor: 'Рэйзор',
  Leol: 'Леол',
  Bonolenov: 'Бонолев',
  'Bonolenov Ndongo': 'Бонолев Ндонго',
  'Nobunaga Hazama': 'Нобунага Хазама',
  'Machi Komacine': 'Мачи Комачине',
  'Balsamilco Might': 'Бальсамилько Майт',
}

const matchRules = (rules, text) => rules.filter(([, re]) => re.test(text)).map(([label]) => label)

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

function debutChapter(text) {
  const m = field(text, 'manga debut').match(/Chapter (\d+)/i)
  return m ? Number(m[1]) : null
}

const arcIndexOf = (chapter) => ARCS.reduce((idx, [start], i) => (chapter >= start ? i : idx), 0)

async function main() {
  await fs.mkdir(path.join(CACHE, 'img'), { recursive: true })
  await fs.mkdir(THUMBS, { recursive: true })
  await fs.mkdir(path.join(OUT_IMG, 'full'), { recursive: true })

  const names = await cachedJson(CACHE, 'members.json', async () => [
    ...new Set([...(await categoryMembers(API, 'Male characters')), ...(await categoryMembers(API, 'Female characters'))]),
  ])
  const pages = await cachedJson(CACHE, 'pages.json', () => wikiPages(API, names))
  const candidates = names.filter((n) => pages[n]?.text && /\{\{Hunterpedia:Character/i.test(pages[n].text) && debutChapter(pages[n].text) !== null)
  const categories = await cachedJson(CACHE, 'categories.json', async () => {
    const res = await wikiQuery(API, candidates, 'prop=categories&cllimit=500')
    return Object.fromEntries(Object.entries(res).map(([t, p]) => [t, (p.categories ?? []).map((c) => c.title)]))
  })
  const images = await cachedJson(CACHE, 'images.json', async () => {
    const res = await wikiQuery(API, candidates, 'prop=pageimages&piprop=original')
    return Object.fromEntries(Object.entries(res).map(([t, p]) => [t, p.original?.source ?? null]))
  })

  const result = []
  await pool(candidates, 8, async (name) => {
    const { id, text, ru, length } = pages[name]
    const buf = await cachedDownload(path.join(CACHE, 'img'), String(id), [images[name]])
    if (!buf) return console.warn('no image', name)
    try {
      await writeFullAndThumb(buf, path.join(OUT_IMG, 'full', `${id}.webp`), path.join(THUMBS, `${id}.webp`), 96)
    } catch (e) {
      return console.warn('image failed', name, e.message)
    }
    const cats = categories[name] ?? []
    const chapter = debutChapter(text)
    const arcIndex = arcIndexOf(chapter)
    const affiliationText = plain(`${field(text, 'affiliation')}\n${field(text, 'previous affiliation')}`).replace(
      /chimera ants?\s*(\n|\|)?\s*extermination team|extermination team/gi,
      '',
    )
    const species = SPECIES_OVERRIDES[name] ?? SPECIES_RULES.filter(([, re]) => cats.some((c) => re.test(c))).map(([label]) => label)
    result.push({
      id,
      name: NAMES[name] ?? ruName(name, ru, transliterate).replace(/Зханг/g, 'Чжан').replace(/Хуи Гуо Роу|Хуй Го Роу/g, 'Хуэй Го Роу'),
      nameEn: name,
      gender: SEX[plain(field(text, 'gender')).trim()] ?? 'Другое',
      species: species.length ? species : ['Человек'],
      nen: matchRules(NEN_RULES, plain(field(text, 'type')))[0] ?? 'Нет',
      affiliations: matchRules(AFFILIATION_RULES, affiliationText),
      status: matchRules(STATUS_RULES, plain(field(text, 'status')))[0] ?? 'Неизвестно',
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
  dropDeleted(result, 'hxh')
  result.sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  await writeAtlas(result, THUMBS, path.join(OUT_IMG, 'thumbs.webp'), OUT_ATLAS, 12, 96)
  await pruneImages(path.join(OUT_IMG, 'full'), result)
  await fs.writeFile(OUT_JSON, JSON.stringify(result, null, 1))
  console.log(`wrote ${result.length} characters (${result.filter((c) => c.answer).length} answerable)`)
}

main()
