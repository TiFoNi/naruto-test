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

const API = 'https://jojo.fandom.com/api.php'
const CACHE = path.join(ROOT, '.cache', 'jojo')
const THUMBS = path.join(CACHE, 'thumb')
const OUT_IMG = path.join(ROOT, 'public', 'jojo')
const OUT_JSON = path.join(ROOT, 'src', 'data', 'jojo.json')
const OUT_ATLAS = path.join(ROOT, 'src', 'data', 'jojo-atlas.json')
const ANSWER_POOL_SIZE = 70
const KEEP = 100

const PARTS = [
  [['Phantom Blood Characters', 'Part 1 Characters'], 'Призрачная кровь'],
  [['Battle Tendency Characters', 'Part 2 Characters'], 'Боевая тенденция'],
  [['Stardust Crusaders Characters', 'Part 3 Characters'], 'Крестоносцы звёздной пыли'],
  [['Diamond Is Unbreakable Characters', 'Part 4 Characters'], 'Несокрушимый алмаз'],
  [['Vento Aureo Characters', 'Part 5 Characters'], 'Золотой ветер'],
  [['Stone Ocean Characters', 'Part 6 Characters'], 'Каменный океан'],
  [['Steel Ball Run Characters', 'Part 7 Characters'], 'Стальной шар'],
]

const SEX = { Male: 'Мужской', Female: 'Женский' }

const SPECIES_RULES = [
  ['Вампир', /^Category:Vampires$/],
  ['Человек из столба', /^Category:Pillar Men$/],
  ['Нежить', /^Category:Zombies$/],
  ['Животное', /^Category:(Animals|Dogs)$/],
  ['Рок-существо', /^Category:Rock Humans$/],
]

const POWER_RULES = [
  ['Стенд', /^Category:Stand Users$/],
  ['Хамон', /^Category:Ripple Users$/],
  ['Спин', /^Category:Spin Users$/],
  ['Режим зверя', /^Category:Beast Mode Users$/],
]

const ALLY = /^Category:(Main Allies|Main Protagonists|Allies|Joestar Group)$/
const VILLAIN = /^Category:(Villains|Main Antagonists)$/
const MINOR_VILLAIN = /^Category:(?!Minor )[\w' ]* Antagonists$/

function sideOf(cats) {
  if (cats.some((c) => ALLY.test(c))) return 'Союзник'
  if (cats.some((c) => VILLAIN.test(c))) return 'Злодей'
  if (cats.some((c) => MINOR_VILLAIN.test(c))) return 'Злодей'
  return 'Нейтралитет'
}

const GROUP_RULES = [
  ['Семья Джостар', /joestar family/i],
  ['Отряд Джостара', /joestar group/i],
  ['Пассионе', /passione/i],
  ['Люди из столбов', /pillar men/i],
  ['Прислужники DIO', /^dio.s /i],
  ['Тюрьма Грин Долфин', /green dolphin street prison/i],
  ['Гонка Стального шара', /steel ball run participants/i],
  ['Семья Хигашиката', /higashikata family/i],
  ['Фонд Спидвагона', /speedwagon/i],
]

const NATIONS = [
  ['Британия', /british|english|briton/i],
  ['США', /american|u\.s\.|united states/i],
  ['Япония', /japanese/i],
  ['Италия', /italian/i],
  ['Египет', /egyptian/i],
  ['Германия', /german/i],
  ['Франция', /french/i],
  ['Мексика', /mexican/i],
  ['Испания', /spanish/i],
  ['Индия', /indian/i],
  ['Россия', /russian|soviet/i],
  ['Бразилия', /brazilian/i],
  ['Корея', /korean/i],
  ['Китай', /chinese/i],
]

const NAMES = {
  'Jonathan Joestar': 'Джонатан Джостар',
  'Dio Brando': 'Дио Брандо',
  'Robert E. O. Speedwagon': 'Роберт Спидвагон',
  'Will Anthonio Zeppeli': 'Уилл Цеппели',
  'Erina Pendleton': 'Эрина Пендлтон',
  'Joseph Joestar': 'Джозеф Джостар',
  'Caesar Anthonio Zeppeli': 'Цезарь Цеппели',
  'Lisa Lisa': 'Лиза Лиза',
  Kars: 'Карс',
  Wamuu: 'Вамуу',
  Esidisi: 'Эйсидиси',
  'Rudol von Stroheim': 'Рудольф фон Штрохайм',
  'Jotaro Kujo': 'Джотаро Куджо',
  'Noriaki Kakyoin': 'Нориаки Какёин',
  'Muhammad Avdol': 'Мухаммед Авдол',
  'Jean Pierre Polnareff': 'Жан-Пьер Польнарефф',
  'Iggy (Part 3)': 'Игги',
  'Holly Kujo': 'Холли Куджо',
  Vanilla_Ice: 'Ванилла Айс',
  'Vanilla Ice': 'Ванилла Айс',
  'Josuke Higashikata': 'Джоске Хигашиката',
  'Okuyasu Nijimura': 'Окуясу Нидзимура',
  'Koichi Hirose': 'Коичи Хиросе',
  'Rohan Kishibe': 'Рохан Кишибе',
  'Yoshikage Kira': 'Ёшикаге Кира',
  'Giorno Giovanna': 'Джорно Джованна',
  'Bruno Bucciarati': 'Бруно Буччеллати',
  'Guido Mista': 'Гвидо Миста',
  'Narancia Ghirga': 'Наранча Гирга',
  'Leone Abbacchio': 'Леоне Аббаккио',
  'Pannacotta Fugo': 'Паннакотта Фуго',
  Trish_Una: 'Триш Уна',
  'Trish Una': 'Триш Уна',
  'Diavolo': 'Диаволо',
  'Jolyne Cujoh': 'Джолин Куджо',
  'Ermes Costello': 'Эрмес Костелло',
  'Emporio Alniño': 'Эмпорио Альниньо',
  'Foo Fighters': 'Фу Файтерс',
  'Narciso Anasui': 'Нарцисо Анасуи',
  'Weather Report': 'Уэзер Репорт',
  'Enrico Pucci': 'Энрико Пуччи',
  'Johnny Joestar': 'Джонни Джостар',
  'Gyro Zeppeli': 'Джайро Цеппели',
  'Funny Valentine': 'Фанни Валентайн',
  'Diego Brando': 'Диего Брандо',
  'Hot Pants': 'Хот Пэнтс',
  'Lucy Steel': 'Люси Стил',
}

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

const cleanName = (title) => title.replace(/\s*\((Part \d|JoJolion|Part \d+)\)\s*$/i, '').trim()

async function main() {
  await fs.mkdir(path.join(CACHE, 'img'), { recursive: true })
  await fs.mkdir(THUMBS, { recursive: true })
  await fs.mkdir(path.join(OUT_IMG, 'full'), { recursive: true })

  const byPart = await cachedJson(CACHE, 'parts2.json', async () =>
    Object.fromEntries(
      await Promise.all(
        PARTS.map(async ([cats], i) => [i, [...new Set((await Promise.all(cats.map((c) => categoryMembers(API, c)))).flat())]]),
      ),
    ),
  )
  const names = [...new Set(Object.values(byPart).flat())]
  const pages = await cachedJson(CACHE, 'pages.json', () => wikiPages(API, names))
  const candidates = names.filter((n) => pages[n]?.text && /\{\{Character.?Info/i.test(pages[n].text))
  const categories = await cachedJson(CACHE, 'categories.json', async () => {
    const res = await wikiQuery(API, candidates, 'prop=categories&cllimit=500')
    return Object.fromEntries(Object.entries(res).map(([t, p]) => [t, (p.categories ?? []).map((c) => c.title)]))
  })
  const images = await cachedJson(CACHE, 'images.json', async () => {
    const res = await wikiQuery(API, candidates, 'prop=pageimages&piprop=original')
    return Object.fromEntries(Object.entries(res).map(([t, p]) => [t, p.original?.source ?? null]))
  })

  const partIndex = (name) => PARTS.findIndex((_, i) => byPart[i].includes(name))

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
    const part = partIndex(name)
    if (part < 0) return
    if (/\((?!Part \d)/.test(name)) return
    const species = matchRules(SPECIES_RULES, cats)
    const nation = plain(field(text, 'nation'))
    result.push({
      id,
      name: NAMES[name] ?? ruName(cleanName(name), ru, transliterate),
      nameEn: cleanName(name),
      aliases: name !== cleanName(name) ? name : undefined,
      gender: SEX[plain(field(text, 'gender')).trim()] ?? (cats.includes('Category:Female Characters') ? 'Женский' : 'Мужской'),
      species: species.length ? species : ['Человек'],
      powers: matchRules(POWER_RULES, cats).length ? matchRules(POWER_RULES, cats) : ['Нет'],
      groups: matchRules(GROUP_RULES, cats.map((c) => c.replace('Category:', ''))),
      side: sideOf(cats),
      nation: NATIONS.find(([, re]) => re.test(nation))?.[0] ?? 'Неизвестно',
      status: /deceased/i.test(plain(field(text, 'status'))) || cats.includes('Category:Deceased Characters') ? 'Мёртв' : 'Жив',
      part: PARTS[part][1],
      partIndex: part,
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
  dropDeleted(result, 'jojo')
  result.sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  await writeAtlas(result, THUMBS, path.join(OUT_IMG, 'thumbs.webp'), OUT_ATLAS, 12, 96)
  await pruneImages(path.join(OUT_IMG, 'full'), result)
  await fs.writeFile(OUT_JSON, JSON.stringify(result, null, 1))
  console.log(`wrote ${result.length} characters (${result.filter((c) => c.answer).length} answerable)`)
}

main()
