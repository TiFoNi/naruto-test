import fs from 'node:fs/promises'
import path from 'node:path'
import {
  PUBLIC,
  ROOT,
  cachedDownload,
  pickPicture,
  cachedJson,
  categoryMembers,
  infobox,
  galleryImage,
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
import { dropDeleted, onlyAnswers } from './dropped.mjs'
import { anilistPictures, bare, nameKey } from './anilist.mjs'

const API = 'https://jujutsu-kaisen.fandom.com/api.php'
const CACHE = path.join(ROOT, '.cache', 'jjk')
const THUMBS = path.join(CACHE, 'thumb')
const OUT_IMG = path.join(PUBLIC, 'jjk')
const OUT_JSON = path.join(ROOT, 'packages', 'game', 'data', 'jjk.json')
const OUT_ATLAS = path.join(ROOT, 'packages', 'game', 'data', 'jjk-atlas.json')
const ANSWER_POOL_SIZE = 55
const KEEP = 70

const EXCLUDE = new Set(['Characters', 'Jujutsu Kaisen 0 Characters', 'Unnamed Characters', 'Rika'])

const ARCS = [
  [0, 'Проклятое дитя'],
  [1, 'Проклятая утроба'],
  [19, 'Против Махито'],
  [32, 'Обмен с Киото'],
  [55, 'Проклятые картины'],
  [65, 'Прошлое Годжо'],
  [79, 'Инцидент в Сибуе'],
  [138, 'Игра на выбывание'],
  [222, 'Битва в Синдзюку'],
]

const SEX = { Male: 'Мужской', Female: 'Женский' }

const GRADES = [
  ['Особый ранг', /special grade/i],
  ['1-й ранг', /grade 1|first grade/i],
  ['2-й ранг', /grade 2|second grade/i],
  ['3-й ранг', /grade 3|third grade/i],
  ['4-й ранг', /grade 4|fourth grade/i],
]

const SPECIES_OVERRIDES = { Sukuna: 'Проклятый дух', 'Ryomen Sukuna': 'Проклятый дух' }

const SPECIES = [
  ['Проклятое тело', /death painting|cursed corpse|shikigami/i],
  ['Проклятый дух', /cursed spirit|curse\b/i],
  ['Человек', /human/i],
]

const AFFILIATIONS = [
  ['Токийский колледж', /tokyo (metropolitan|jujutsu)/i],
  ['Киотский колледж', /kyoto/i],
  ['Клан Годжо', /gojo clan/i],
  ['Клан Дзенин', /zenin/i],
  ['Клан Камо', /kamo clan/i],
  ['Проклятые духи', /cursed spirits|curse user|mahito|geto|disaster curses/i],
  ['Ассоциация магов', /jujutsu (society|headquarters|higher-ups)/i],
  ['Якудза', /yakuza|q\b/i],
  ['Звёздный коридор', /star religious group|tengen/i],
]

const ROLES = [
  ['Ученик', /student/i],
  ['Преподаватель', /teacher|principal|instructor|headmaster/i],
  ['Проклятый пользователь', /curse user/i],
  ['Помощник', /assistant|window|auxiliary manager|driver/i],
  ['Маг', /jujutsu sorcerer|sorcerer/i],
]

const NAMES = {
  'Yuji Itadori': 'Юдзи Итадори',
  'Megumi Fushiguro': 'Мегуми Фусигуро',
  'Nobara Kugisaki': 'Нобара Кугисаки',
  'Satoru Gojo': 'Сатору Годжо',
  'Suguru Geto': 'Сугуру Гето',
  'Ryomen Sukuna': 'Рёмен Сукуна',
  Sukuna: 'Рёмен Сукуна',
  'Kento Nanami': 'Кенто Нанами',
  'Maki Zenin': 'Маки Дзенин',
  'Toge Inumaki': 'Тоге Инумаки',
  'Panda (Jujutsu Kaisen)': 'Панда',
  'Yuta Okkotsu': 'Юта Оккоцу',
  'Aoi Todo': 'Аой Тодо',
  'Noritoshi Kamo': 'Норитоси Камо',
  'Mai Zenin': 'Май Дзенин',
  'Kasumi Miwa': 'Касуми Мива',
  'Momo Nishimiya': 'Момо Нисимия',
  'Mechamaru': 'Мехамару',
  'Kokichi Muta': 'Кокити Мута',
  Mahito: 'Махито',
  Jogo: 'Дзёго',
  Hanami: 'Ханами',
  Dagon: 'Дагон',
  Choso: 'Тёсо',
  Kenjaku: 'Кендзяку',
  Toji: 'Тодзи Фусигуро',
  'Toji Fushiguro': 'Тодзи Фусигуро',
  'Shoko Ieiri': 'Сёко Иэйри',
  'Yuki Tsukumo': 'Юки Цукумо',
  'Hiromi Higuruma': 'Хироми Хигурума',
  'Takuma Ino': 'Такума Ино',
  'Atsuya Kusakabe': 'Ацуя Кусакабэ',
  'Utahime Iori': 'Утахимэ Иори',
  'Masamichi Yaga': 'Масамити Яга',
  'Yoshinobu Gakuganji': 'Ёсинобу Гакуганди',
  'Naobito Zenin': 'Наобито Дзенин',
  'Naoya Zenin': 'Наоя Дзенин',
  'Maki Zen’in': 'Маки Дзенин',
  Uraume: 'Ураумэ',
  'Hajime Kashimo': 'Хадзимэ Касимо',
  'Ryu Ishigori': 'Рю Исигори',
  'Reggie Star': 'Реджи Стар',
  'Kinji Hakari': 'Киндзи Хакари',
  'Kirara Hoshi': 'Кирара Хоси',
  'Takako Uro': 'Такако Уро',
  'Charles Bernard': 'Шарль Бернар',
  'Yorozu': 'Ёродзу',
  'Kurourushi': 'Куроуруси',
  'Nishimiya': 'Нисимия',
}

const firstMatch = (rules, text) => rules.find(([, re]) => re.test(text))?.[0]
const matchRules = (rules, text) => rules.filter(([, re]) => re.test(text)).map(([label]) => label)

const lines = (raw) =>
  (raw ?? '')
    .split(/<br\s*\/?>|\n/i)
    .map((line) => line.trim())
    .filter(Boolean)

function debutChapter(text) {
  const raw = infobox(text, 'debut') ?? ''
  const zero = raw.match(/Chapter 0/i)
  const found = raw.match(/Chapter (\d+)/i)
  if (found) return Number(found[1])
  return zero ? 0 : null
}

const arcIndexOf = (chapter) => ARCS.reduce((index, [start], at) => (chapter >= start ? at : index), 0)

function species(name, text) {
  if (SPECIES_OVERRIDES[name]) return SPECIES_OVERRIDES[name]
  const raw = infobox(text, 'race') ?? ''
  if (/death painting|cursed corpse|shikigami/i.test(raw)) return 'Проклятое тело'
  if (/incarnat/i.test(raw)) return 'Воплощение'
  const current = lines(raw).filter((line) => !/former/i.test(line))
  const found = firstMatch(SPECIES, plain(current[0] ?? raw))
  if (found) return found
  return /sorcerer|student|teacher/i.test(plain(infobox(text, 'occupation') ?? '')) ? 'Человек' : 'Неизвестно'
}

function role(kind, occupation) {
  if (kind === 'Проклятый дух') return 'Проклятый дух'
  const found = firstMatch(ROLES, occupation)
  if (found === 'Маг' && kind === 'Воплощение') return 'Древний маг'
  return found ?? 'Нет'
}

async function main() {
  await fs.mkdir(path.join(CACHE, 'img'), { recursive: true })
  await fs.mkdir(THUMBS, { recursive: true })
  await fs.mkdir(path.join(OUT_IMG, 'full'), { recursive: true })

  const names = (await cachedJson(CACHE, 'members.json', () => categoryMembers(API, 'Characters'))).filter((n) => !EXCLUDE.has(n))
  const pages = await cachedJson(CACHE, 'pages.json', () => wikiPages(API, names))

  const candidates = names.filter((name) => {
    const page = pages[name]
    if (!page?.text) return false
    if (!/\{\{Character[_ ]?Infobox/i.test(page.text)) return false
    if (debutChapter(page.text) === null) return false
    return !/unnamed|civilian|crowd/i.test(name)
  })

  const images = await cachedJson(CACHE, 'images.json', async () => {
    const res = await wikiQuery(API, candidates, 'prop=pageimages&piprop=original')
    return Object.fromEntries(Object.entries(res).map(([title, page]) => [title, page.original?.source ?? null]))
  })

  const portraits = await cachedJson(CACHE, 'anilist.json', async () => Object.fromEntries(await anilistPictures(ANILIST)))

  const artFiles = Object.fromEntries(candidates.map((name) => [name, galleryImage(pages[name].text)]).filter(([, file]) => file))
  const artUrls = await cachedJson(CACHE, 'art.json', () => wikiImageUrls(API, [...new Set(Object.values(artFiles))]))

  const result = []
  await pool(candidates, 10, async (name) => {
    const { id, text, ru, length } = pages[name]
    const buf = await pickPicture(path.join(CACHE, 'img'), String(id), [artUrls[artFiles[name]], portraits[nameKey(bare(name))], images[name]])
    if (!buf) return console.warn('no image', name)
    const wiki = await cachedDownload(path.join(CACHE, 'img', 'source-2'), String(id), [images[name]])
    try {
      await writeFullAndThumb(buf, path.join(OUT_IMG, 'full', `${id}.webp`), path.join(THUMBS, `${id}.webp`), 96, { big: wiki })
    } catch (error) {
      return console.warn('image failed', name, error.message)
    }

    const kind = species(name, text)
    const occupation = plain(infobox(text, 'occupation') ?? '')
    const affiliationText = plain(lines(infobox(text, 'affiliation')).join('\n'))
    const affiliations = matchRules(AFFILIATIONS, affiliationText)
    if (kind === 'Проклятый дух' && !affiliations.includes('Проклятые духи')) affiliations.unshift('Проклятые духи')

    const chapter = debutChapter(text)
    const arcIndex = arcIndexOf(chapter)

    result.push({
      id,
      name: NAMES[name] ?? ruName(name, ru, transliterate),
      nameEn: name,
      gender: SEX[plain(infobox(text, 'gender') ?? '').trim()] ?? 'Другое',
      species: kind,
      grade: firstMatch(GRADES, plain(infobox(text, 'class') ?? '')) ?? 'Нет',
      role: role(kind, occupation),
      affiliations: affiliations.length ? affiliations : ['Без фракции'],
      arc: ARCS[arcIndex][1],
      arcIndex,
      length,
    })
  })

  result.sort((a, b) => b.length - a.length)
  let picked = 0
  for (const one of result) {
    one.answer = picked < ANSWER_POOL_SIZE && one.species !== 'Неизвестно'
    if (one.answer) picked++
    delete one.length
  }

  const kept = keepNotable(result, KEEP)
  result.length = 0
  result.push(...kept)
  dropDeleted(result, 'jjk')
  onlyAnswers(result)
  result.sort((a, b) => a.name.localeCompare(b.name, 'ru'))

  await writeAtlas(result, THUMBS, path.join(OUT_IMG, 'thumbs.webp'), OUT_ATLAS, 12, 96)
  await pruneImages(path.join(OUT_IMG, 'full'), result)
  await fs.writeFile(OUT_JSON, JSON.stringify(result, null, 1))
  console.log(`wrote ${result.length} characters (${result.filter((one) => one.answer).length} answerable)`)
}

main()
