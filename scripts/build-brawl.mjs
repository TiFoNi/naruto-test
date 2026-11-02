import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { PUBLIC, ROOT, cachedDownload, cachedJson, getJson, pool, pruneImages, wikiImageUrls, wikiPages, wikiQuery, writeAtlas, writeFullAndThumb } from './lib.mjs'

const BRAWLERS = 'https://api.brawlapi.com/v1/brawlers'
const WIKI = 'https://brawlstars.fandom.com/api.php'
const WIKI_RU = 'https://brawlstars.fandom.com/ru/api.php'
const CACHE = path.join(ROOT, '.cache', 'brawl')
const THUMBS = path.join(CACHE, 'thumb')
const OUT_IMG = path.join(PUBLIC, 'brawl')
const OUT_JSON = path.join(ROOT, 'packages', 'game', 'data', 'brawl.json')
const OUT_ATLAS = path.join(ROOT, 'packages', 'game', 'data', 'brawl-atlas.json')

const NAMES = {
  Shelly: 'Шелли',
  Colt: 'Кольт',
  Bull: 'Булл',
  Brock: 'Брок',
  Rico: 'Рико',
  Spike: 'Спайк',
  Barley: 'Барли',
  Jessie: 'Джесси',
  Nita: 'Нита',
  Dynamike: 'Динамайк',
  'El Primo': 'Эль Примо',
  Mortis: 'Мортис',
  Crow: 'Ворон',
  Poco: 'Поко',
  Bo: 'Бо',
  Piper: 'Пайпер',
  Pam: 'Пэм',
  Tara: 'Тара',
  Darryl: 'Дэррил',
  Penny: 'Пенни',
  Frank: 'Фрэнк',
  Gene: 'Джин',
  Tick: 'Тик',
  Leon: 'Леон',
  Rosa: 'Роза',
  Carl: 'Карл',
  Bibi: 'Биби',
  '8-Bit': '8-Бит',
  Sandy: 'Сэнди',
  Bea: 'Беа',
  Emz: 'Эмз',
  'Mr. P': 'Мистер П.',
  Max: 'Макс',
  Jacky: 'Джеки',
  Gale: 'Гейл',
  Nani: 'Нани',
  Sprout: 'Спраут',
  Surge: 'Сёрдж',
  Colette: 'Колетт',
  Amber: 'Эмбер',
  Lou: 'Лу',
  Byron: 'Байрон',
  Edgar: 'Эдгар',
  Ruffs: 'Полковник Раффс',
  Stu: 'Стю',
  Belle: 'Белль',
  Squeak: 'Сквик',
  Grom: 'Гром',
  Buzz: 'Базз',
  Griff: 'Грифф',
  Ash: 'Эш',
  Meg: 'Мег',
  Lola: 'Лола',
  Fang: 'Фэнг',
  Eve: 'Ева',
  Janet: 'Джанет',
  Bonnie: 'Бонни',
  Otis: 'Отис',
  Sam: 'Сэм',
  Gus: 'Гас',
  Buster: 'Бастер',
  Chester: 'Честер',
  Gray: 'Грей',
  Mandy: 'Мэнди',
  'R-T': 'Р-Т',
  Willow: 'Уиллоу',
  Maisie: 'Мэйси',
  Hank: 'Хэнк',
  Cordelius: 'Корделиус',
  Doug: 'Даг',
  Pearl: 'Перл',
  Chuck: 'Чак',
  Charlie: 'Чарли',
  Mico: 'Мико',
  Kit: 'Кит',
  'Larry & Lawrie': 'Ларри и Лори',
  Melodie: 'Мелоди',
  Angelo: 'Анджело',
  Draco: 'Драко',
  Lily: 'Лили',
  Berry: 'Берри',
  Clancy: 'Клэнси',
  Moe: 'Мо',
  Kenji: 'Кэндзи',
  Shade: 'Шейд',
  Juju: 'Джуджу',
  'Buzz Lightyear': 'Базз Лайтер',
  Meeple: 'Мипл',
  Ollie: 'Олли',
  Lumi: 'Луми',
  Finx: 'Финкс',
  'Jae-Yong': 'Джэ-Ён',
  Kaze: 'Кадзе',
  Alli: 'Элли',
  Trunk: 'Транк',
  Mina: 'Мина',
  Ziggy: 'Зигги',
  Pierce: 'Пирс',
  Gigi: 'Джиджи',
  Glowy: 'Глоуи',
  Sirius: 'Сириус',
  Najia: 'Наджия',
  Damian: 'Дэмиан',
  'Starr Nova': 'Старр Нова',
  Bolt: 'Болт',
  Nori: 'Нори',
  Wendy: 'Венди',
  Cosmo: 'Космо',
  Vince: 'Винс',
}

const CLASSES = {
  'Damage Dealer': 'Боец',
  Tank: 'Танк',
  Marksman: 'Снайпер',
  Artillery: 'Артиллерия',
  Assassin: 'Убийца',
  Support: 'Поддержка',
  Controller: 'Контроль',
}

const RARITIES = ['Common', 'Rare', 'Super Rare', 'Epic', 'Mythic', 'Legendary', 'Ultra Legendary']
const RARITY_NAMES = ['Стартовый', 'Редкий', 'Сверхредкий', 'Эпический', 'Мифический', 'Легендарный', 'Ультралегендарный']

const RANGES = ['Short', 'Normal', 'Long', 'Very Long']
const RANGE_NAMES = ['Короткая', 'Средняя', 'Дальняя', 'Очень дальняя']
const SHORT_UNDER = 4

const SPEEDS = ['Very Slow', 'Slow', 'Normal', 'Fast', 'Very Fast']
const SPEED_NAMES = ['Очень медленная', 'Медленная', 'Обычная', 'Быстрая', 'Очень быстрая']

const RARITY_TONES = {
  Common: ['#d6f2ff', '#7fcdf0', '#2f7fa8'],
  Rare: ['#c9f7b8', '#62d25a', '#23813a'],
  'Super Rare': ['#b5ecff', '#2fa8e8', '#0f5a9e'],
  Epic: ['#f0c4ff', '#b34ae6', '#5b1a94'],
  Mythic: ['#ffc2c8', '#e8384f', '#8f1230'],
  Legendary: ['#fff3a8', '#f6c21c', '#b9770a'],
}

const ULTRA_STOPS = ['#ffe14d', '#ff6a9e', '#8a5cff', '#2fd6ff']

const CANVAS = 800
const FIGURE_WIDTH = 0.94
const FIGURE_HEIGHT = 1.3
const FIGURE_TOP = 0.05
const ATLAS_CELL = 192

const svgBackdrop = (defs) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS}" height="${CANVAS}"><defs>${defs}</defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`)

const backdrop = (rarity) => {
  if (rarity === 'Ultra Legendary') {
    const stops = ULTRA_STOPS.map((color, at) => `<stop offset="${(at / (ULTRA_STOPS.length - 1)) * 100}%" stop-color="${color}"/>`).join('')
    return svgBackdrop(`<linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">${stops}</linearGradient>`)
  }
  const [light, middle, deep] = RARITY_TONES[rarity]
  return svgBackdrop(`<radialGradient id="g" cx="50%" cy="42%" r="75%"><stop offset="0%" stop-color="${light}"/><stop offset="48%" stop-color="${middle}"/><stop offset="100%" stop-color="${deep}"/></radialGradient>`)
}

const onRarity = async (source, rarity) => {
  const { data, info } = await sharp(source).ensureAlpha().trim().png().toBuffer({ resolveWithObject: true })
  const scale = Math.min((CANVAS * FIGURE_WIDTH) / info.width, (CANVAS * FIGURE_HEIGHT) / info.height)
  const width = Math.round(info.width * scale)
  const height = Math.round(info.height * scale)
  const top = Math.max(Math.round(CANVAS * FIGURE_TOP), Math.round((CANVAS - height) / 2))
  const figure = await sharp(data)
    .resize(width, height, { kernel: 'lanczos3' })
    .extract({ left: 0, top: 0, width, height: Math.min(height, CANVAS - top) })
    .png()
    .toBuffer()
  return sharp(backdrop(rarity))
    .composite([{ input: figure, left: Math.round((CANVAS - width) / 2), top }])
    .png()
    .toBuffer()
}

const sharper = async (...buffers) => {
  let best = null
  let bestSide = 0
  for (const buffer of buffers.filter(Boolean)) {
    const { info } = await sharp(buffer).ensureAlpha().trim().png().toBuffer({ resolveWithObject: true })
    const side = Math.min(info.width, info.height)
    if (side > bestSide) {
      best = buffer
      bestSide = side
    }
  }
  return best
}

const GENDER_FIX = { Angelo: 'Мужской', Meeple: 'Другое', Shade: 'Другое', Trunk: 'Другое', Sprout: 'Другое' }
const RANGE_FIX = { Bolt: 'Short' }
const RELEASE_FIX = { Pam: 17, Penny: 20 }

const field = (text, pattern) => text.match(new RegExp(`\\|\\s*${pattern}\\s*=\\s*([^|}\\n]*)`))?.[1]?.trim() ?? ''

const firstOf = (raw, labels) => {
  const first = raw.split(/<br/)[0]
  return [...labels].sort((one, two) => two.length - one.length).find((label) => new RegExp(`\\b${label}\\b`).test(first))
}

const rangeOf = (name, text) => {
  if (RANGE_FIX[name]) return RANGE_FIX[name]
  const raw = field(text, 'AttackRange1?')
  const label = firstOf(raw, RANGES)
  if (label) return label
  const value = Number.parseFloat(raw)
  return Number.isFinite(value) && value < SHORT_UNDER ? 'Short' : null
}

const genderOf = (name, text) => {
  if (GENDER_FIX[name]) return GENDER_FIX[name]
  const he = text.match(/\b(he|his|him)\b/gi)?.length ?? 0
  const she = text.match(/\b(she|her|hers)\b/gi)?.length ?? 0
  if (she > he * 3) return 'Женский'
  if (he > she * 3) return 'Мужской'
  return 'Другое'
}

async function main() {
  await fs.mkdir(path.join(OUT_IMG, 'full'), { recursive: true })
  await fs.mkdir(THUMBS, { recursive: true })

  const { list } = await cachedJson(CACHE, 'brawlers.json', () => getJson(BRAWLERS))
  const released = list.filter((one) => one.released).sort((one, two) => one.id - two.id)
  const titles = released.map((one) => one.name)

  const pages = await cachedJson(CACHE, 'pages.json', () => wikiPages(WIKI, titles))
  const ruOf = (title) => pages[title]?.ru ?? NAMES[title] ?? title
  const ruTitles = titles.map(ruOf)
  const skins = await cachedJson(CACHE, 'skins-ru.json', () => wikiImageUrls(WIKI_RU, ruTitles.map((title) => `${title} Skin-Default.png`)))
  const covers = await cachedJson(CACHE, 'covers-ru.json', async () =>
    Object.fromEntries(Object.entries(await wikiQuery(WIKI_RU, ruTitles, 'prop=pageimages&piprop=original')).map(([title, page]) => [title, page.original?.source ?? null])),
  )
  const english = await cachedJson(CACHE, 'images.json', () => wikiImageUrls(WIKI, titles.map((title) => `${title} Skin-Default.png`)))

  const result = []
  const problems = []
  let fromEnglish = 0

  await pool(released, 6, async (one) => {
    const id = one.id - released[0].id + 1
    const text = pages[one.name]?.text
    if (!text) return problems.push(`${one.name}: нема сторінки`)

    const name = pages[one.name]?.ru ?? NAMES[one.name]
    const range = rangeOf(one.name, text)
    const speed = firstOf(field(text, 'MovementSpeed'), SPEEDS)
    const release = RELEASE_FIX[one.name] ?? (Number(text.match(/(\d+)(?:st|nd|rd|th)\s+Brawler\s+added/)?.[1]) || released.indexOf(one) + 1)
    const rarity = RARITIES.indexOf(one.rarity.name)
    const kind = CLASSES[one.class.name]
    if (!name || !range || !speed || rarity < 0 || !kind) {
      return problems.push(`${one.name}: name=${name} range=${range} speed=${speed} rarity=${rarity} class=${kind}`)
    }

    const title = ruOf(one.name)
    const russian = await cachedDownload(path.join(CACHE, 'img-ru'), `${id}`, [skins[`${title} Skin-Default.png`], covers[title]])
    const original = await cachedDownload(path.join(CACHE, 'img'), `${id}`, [english[`${one.name} Skin-Default.png`], one.imageUrl2])
    const source = await sharper(original, russian)
    if (!source) return problems.push(`${one.name}: нема картинки`)
    if (source === original) fromEnglish++
    const picture = await onRarity(source, one.rarity.name)
    await writeFullAndThumb(picture, path.join(OUT_IMG, 'full', `${id}.webp`), path.join(THUMBS, `${id}.webp`), ATLAS_CELL)
    await sharp(picture).resize(ATLAS_CELL, ATLAS_CELL).webp({ quality: 88 }).toFile(path.join(THUMBS, `${id}.webp`))

    result.push({
      id,
      name,
      nameEn: one.name,
      aliases: [...new Set([one.name, name, NAMES[one.name]].filter(Boolean))].join(' ').toLowerCase(),
      gender: genderOf(one.name, text),
      kind,
      rarity: RARITY_NAMES[rarity],
      rarityIndex: rarity,
      range: RANGE_NAMES[RANGES.indexOf(range)],
      rangeIndex: RANGES.indexOf(range),
      speed: SPEED_NAMES[SPEEDS.indexOf(speed)],
      speedIndex: SPEEDS.indexOf(speed),
      release,
      answer: true,
    })
  })

  const taken = new Map()
  for (const one of result) taken.set(one.release, [...(taken.get(one.release) ?? []), one.nameEn])
  for (const [release, names] of taken) if (names.length > 1) problems.push(`номер ${release}: ${names.join(', ')}`)

  problems.forEach((line) => console.warn(line))
  result.sort((a, b) => a.name.localeCompare(b.name, 'ru'))

  await writeAtlas(result, THUMBS, path.join(OUT_IMG, 'thumbs.webp'), OUT_ATLAS, 12, ATLAS_CELL)
  await pruneImages(path.join(OUT_IMG, 'full'), result)
  await fs.writeFile(OUT_JSON, JSON.stringify(result, null, 1))
  console.log(`wrote ${result.length} brawlers (${fromEnglish} from the English wiki), ${problems.length} problems`)
}

main()
