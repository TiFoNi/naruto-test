import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { PUBLIC, ROOT, cachedJson, pickPicture, pool, pruneImages, wikiImageUrls, wikiPages, wikiQuery, writeAtlas, writeFullAndThumb } from './lib.mjs'
import { anilistPictures, bare, nameKey } from './anilist.mjs'

const API = 'https://mushokutensei.fandom.com/api.php'
const ANILIST = [108465, 127720, 141534, 146065, 166873, 178789]
const CACHE = path.join(ROOT, '.cache', 'mushoku')
const THUMBS = path.join(CACHE, 'thumb')
const OUT_IMG = path.join(PUBLIC, 'mushoku')
const OUT_JSON = path.join(ROOT, 'packages', 'game', 'data', 'mushoku.json')
const OUT_ATLAS = path.join(ROOT, 'packages', 'game', 'data', 'mushoku-atlas.json')

const ANILIST_NAMES = { 'Lilia Greyrat': ['Lilia'], 'Ariel Anemoi Asura': ['Ariel Asura'] }

const ALIASES = {
  'Ghislaine Dedoldia': 'Гислейн Гилейн Дедолдия',
  'Linia Dedoldia': 'Риния Рінія Дедолдия',
  'Pursena Adoldia': 'Адолдия',
  'Perugius Dola': 'Дола',
  'Geese Nukadia': 'Гиз Гіз',
  'Zanoba Shirone': 'Сирон Сірон',
  'Pax Shirone': 'Сирон Сірон',
  'Nanahoshi Shizuka': 'Нанахоси Нанахосі',
  'Auber Corvette': 'Аубер',
  'Reida Reia': 'Рейда',
}

const UK = {
  'Aisha Greyrat': 'Айша Грейрат',
  Almanfi: 'Аруманфі',
  'Ghislaine Dedoldia': 'Гіслен Дедорудія',
  'Darius Silva Ganius': 'Даріус Сільва Ганіус',
  'Zenith Greyrat': 'Зеніт Грейрат',
  'Kishirika Kishirisu': 'Кісіріка Кісірісу',
  'Lilia Greyrat': 'Лілія Грейрат',
  'Norn Greyrat': 'Норн Грейрат',
  Orsted: 'Орстед',
  'Pax Shirone': 'Пакс Широн',
  'Perugius Dola': 'Перугіус Дора',
  'Paul Greyrat': 'Пол Грейрат',
  'Roxy Migurdia': 'Роксі Мігурдія',
  'Rudeus Greyrat': 'Рудеус Грейрат',
  'Ruijerd Superdia': 'Руйджерд Супердія',
  'Sauros Boreas Greyrat': 'Саурос Бореас Грейрат',
  Sylphiette: 'Сільфієтта',
  Talhand: 'Талханд',
  'Philip Boreas Greyrat': 'Філіп Бореас Грейрат',
  'Hilda Boreas Greyrat': 'Хільда Бореас Грейрат',
  Hitogami: 'Хітоґамі',
  'Elinalise Dragonroad': 'Еліналіз Драгонроуд',
  'Eris Boreas Greyrat': 'Еріс Бореас Грейрат',
  'Ariel Anemoi Asura': 'Аріель Анемой Асура',
  'Geese Nukadia': 'Гісу Нукадія',
  'Zanoba Shirone': 'Заноба Широн',
  'Cliff Grimoire': 'Кліфф Грімуар',
  'Luke Notos Greyrat': 'Люк Нотос Грейрат',
  'Nanahoshi Shizuka': 'Нанахоши Сідзука',
  Badigadi: 'Бадіґаді',
  Julie: 'Джулі',
  'Linia Dedoldia': 'Лінія Дедорудія',
  'Pursena Adoldia': 'Пурсена Адорудія',
  Sara: 'Сара',
  'Soldat Heckler': 'Сольдат Хеклер',
  'Auber Corvette': 'Оубер Корветт',
  'Gal Farion': 'Гал Фаріон',
  'Isolte Cruel': 'Ізольта Круель',
  'Nina Farion': 'Ніна Фаріон',
  'Reida Reia': 'Райда Рейя',
}

const ART_ONLY = new Set(['Isolte Cruel', 'Nanahoshi Shizuka'])

const DEBUTS = ['1 сезон, 1 часть', '1 сезон, 2 часть', '2 сезон, 1 часть', '2 сезон, 2 часть', '3 сезон']

const M = 'Мужской'
const F = 'Женский'

const GREYRAT = 'Семья Грейрат'
const BOREAS = 'Дом Бореас'
const ASURA = 'Королевство Асура'
const RANOA = 'Университет Раноа'
const SHIRONE = 'Королевство Широн'
const WOLF = 'Клык Чёрного волка'
const DEAD_END = 'Мёртвый конец'
const SEVEN = 'Семь великих сил'
const SWORD_GOD = 'Школа Бога Меча'
const WATER_GOD = 'Школа Бога Воды'
const NORTH_GOD = 'Школа Бога Севера'
const DEMONS = 'Демонический континент'
const SKY = 'Небесная крепость'
const GUILD = 'Гильдия авантюристов'

const CHARACTERS = [
  ['Rudeus Greyrat', 'Rudeus Greyrat', 'Рудеус Грейрат', M, 'Человек', 'Маг', [GREYRAT, RANOA, DEAD_END], 0],
  ['Paul Greyrat', 'Paul Greyrat', 'Пол Грейрат', M, 'Человек', 'Мечник', [GREYRAT, WOLF], 0],
  ['Zenith Greyrat', 'Zenith Greyrat', 'Зенит Грейрат', F, 'Человек', 'Целитель', [GREYRAT, WOLF], 0],
  ['Lilia Greyrat', 'Lilia Greyrat', 'Лилия Грейрат', F, 'Человек', 'Слуга', [GREYRAT], 0],
  ['Norn Greyrat', 'Norn Greyrat', 'Норн Грейрат', F, 'Человек', 'Студент', [GREYRAT, RANOA], 0],
  ['Aisha Greyrat', 'Aisha Greyrat', 'Айша Грейрат', F, 'Человек', 'Слуга', [GREYRAT], 0],
  ['Sylphiette Greyrat', 'Sylphiette', 'Сильфиетта', F, 'Полукровка', 'Маг', [GREYRAT, RANOA, ASURA], 0],
  ['Eris Greyrat', 'Eris Boreas Greyrat', 'Эрис Бореас Грейрат', F, 'Человек', 'Мечник', [GREYRAT, BOREAS, DEAD_END, SWORD_GOD], 0],
  ['Sauros Boreas Greyrat', 'Sauros Boreas Greyrat', 'Саурос Бореас Грейрат', M, 'Человек', 'Знать', [BOREAS, ASURA], 0],
  ['Philip Boreas Greyrat', 'Philip Boreas Greyrat', 'Филип Бореас Грейрат', M, 'Человек', 'Знать', [BOREAS, ASURA], 0],
  ['Hilda Boreas Greyrat', 'Hilda Boreas Greyrat', 'Хильда Бореас Грейрат', F, 'Человек', 'Знать', [BOREAS, ASURA], 0],
  ['Ghislaine Dedoldia', 'Ghislaine Dedoldia', 'Гислен Дедорудия', F, 'Звериный народ', 'Мечник', [WOLF, BOREAS, SWORD_GOD], 0],
  ['Ruijerd Superdia', 'Ruijerd Superdia', 'Руйджерд Супердия', M, 'Демон', 'Воин', [DEAD_END], 0],
  ['Elinalise Dragonroad', 'Elinalise Dragonroad', 'Элинализ Драгонроуд', F, 'Эльф', 'Авантюрист', [WOLF, RANOA], 0],
  ['Geese Nukadia', 'Geese Nukadia', 'Гису Нукадия', M, 'Демон', 'Авантюрист', [WOLF], 1],
  ['Talhand', 'Talhand', 'Талханд', M, 'Дварф', 'Авантюрист', [WOLF], 0],
  ['Roxy Migurdia Greyrat', 'Roxy Migurdia', 'Рокси Мигурдия', F, 'Демон', 'Маг', [GREYRAT, RANOA, SHIRONE], 0],
  ['Kishirika Kishirisu', 'Kishirika Kishirisu', 'Кисирика Кисирису', F, 'Демон', 'Владыка', [DEMONS], 0],
  ['Zanoba Shirone', 'Zanoba Shirone', 'Заноба Широн', M, 'Человек', 'Знать', [SHIRONE, RANOA], 1],
  ['Cliff Grimoire', 'Cliff Grimoire', 'Клифф Гримуар', M, 'Полукровка', 'Целитель', [RANOA], 1],
  ['Juliette', 'Julie', 'Джули', F, 'Дварф', 'Слуга', [SHIRONE], 2],
  ['Linia Dedoldia', 'Linia Dedoldia', 'Линия Дедорудия', F, 'Звериный народ', 'Студент', [RANOA], 2],
  ['Pursena Adoldia', 'Pursena Adoldia', 'Пурсена Адорудия', F, 'Звериный народ', 'Студент', [RANOA], 2],
  ['Nanahoshi Shizuka', 'Nanahoshi Shizuka', 'Нанахоши Сидзука', F, 'Человек', 'Студент', [RANOA], 1],
  ['Badigadi', 'Badigadi', 'Бадигади', M, 'Демон', 'Владыка', [SEVEN, RANOA, DEMONS], 2],
  ['Ariel Anemoi Asura', 'Ariel Anemoi Asura', 'Ариэль Анемой Асура', F, 'Человек', 'Знать', [ASURA, RANOA], 1],
  ['Luke Notos Greyrat', 'Luke Notos Greyrat', 'Люк Нотос Грейрат', M, 'Человек', 'Рыцарь', [ASURA, RANOA], 1],
  ['Perugius Dola', 'Perugius Dola', 'Перугиус Дора', M, 'Драконий род', 'Владыка', [SEVEN, ASURA, SKY], 0],
  ['Almanfi', 'Almanfi', 'Аруманфи', M, 'Дух', 'Слуга', [SKY], 0],
  ['Darius Silva Ganius', 'Darius Silva Ganius', 'Дариус Сильва Ганиус', M, 'Человек', 'Знать', [ASURA], 1],
  ['Orsted', 'Orsted', 'Орстед', M, 'Драконий род', 'Владыка', [SEVEN], 0],
  ['Hitogami', 'Hitogami', 'Хитогами', M, 'Божество', 'Божество', [], 0],
  ['Gal Farion', 'Gal Farion', 'Гал Фарион', M, 'Человек', 'Мечник', [SEVEN, SWORD_GOD], 4],
  ['Nina Farion', 'Nina Farion', 'Нина Фарион', F, 'Человек', 'Мечник', [SWORD_GOD], 4],
  ['Isolte Cruel', 'Isolte Cruel', 'Изольта Круэль', F, 'Человек', 'Рыцарь', [ASURA, WATER_GOD], 4],
  ['Reida Reia', 'Reida Reia', 'Райда Рейя', F, 'Человек', 'Мечник', [ASURA, WATER_GOD], 4],
  ['Sara', 'Sara', 'Сара', F, 'Человек', 'Авантюрист', [GUILD], 2],
  ['Pax Shirone', 'Pax Shirone', 'Пакс Широн', M, 'Человек', 'Знать', [SHIRONE], 0],
  ['Soldat Heckler', 'Soldat Heckler', 'Сольдат Хеклер', M, 'Человек', 'Авантюрист', [GUILD], 2],
  ['Auber Corvette', 'Auber Corvette', 'Оубер Корветт', M, 'Человек', 'Мечник', [NORTH_GOD], 4],
]

const swap = (text, from, to) =>
  text.replace(new RegExp(from, 'g'), to).replace(new RegExp(from.toUpperCase(), 'g'), to.toUpperCase())

function searchTags(nameEn, ...names) {
  const words = new Set((ALIASES[nameEn] ?? '').split(/\s+/).filter(Boolean))
  for (const name of names.filter(Boolean)) {
    for (const variant of [swap(name, 'р', 'л'), swap(swap(name, 'ль', 'р'), 'л', 'р')]) {
      if (variant !== name) variant.split(/\s+/).forEach((word) => words.add(word))
    }
  }
  for (const name of names.filter(Boolean)) name.split(/\s+/).forEach((word) => words.delete(word))
  return [...words].join(' ')
}

function animeArt(text) {
  const blocks = [...(text ?? '').matchAll(/<gallery>([\s\S]*?)<\/gallery>/gi)].map((found) => found[1])
  for (const block of blocks) {
    const rows = block
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => /\.(png|jpe?g|webp)/i.test(line))
      .map((line) => {
        const [file, label = ''] = line.split('|')
        return { file: file.trim(), label: label.trim() }
      })
    const pick = rows.find((row) => /^AN|anime/i.test(row.label) || /MT-AN/i.test(row.file))
    if (pick) return pick.file
  }
  return null
}

async function upperBody(buf) {
  const { data, info } = await sharp(buf).trim().png().toBuffer({ resolveWithObject: true })
  const side = Math.min(info.width, Math.round(info.height * 0.4))
  const left = Math.max(0, Math.round((info.width - side) / 2))
  return sharp(data).extract({ left, top: 0, width: side, height: side }).png().toBuffer()
}

async function main() {
  await fs.mkdir(path.join(CACHE, 'img'), { recursive: true })
  await fs.mkdir(THUMBS, { recursive: true })
  await fs.mkdir(path.join(OUT_IMG, 'full'), { recursive: true })

  const titles = CHARACTERS.map(([title]) => title)
  const pages = await cachedJson(CACHE, 'pages.json', () => wikiPages(API, titles))
  const missing = titles.filter((title) => !pages[title]?.id)
  if (missing.length) throw new Error(`немає сторінок: ${missing.join(', ')}`)

  const images = await cachedJson(CACHE, 'images.json', async () => {
    const res = await wikiQuery(API, titles, 'prop=pageimages&piprop=original')
    return Object.fromEntries(Object.entries(res).map(([title, page]) => [title, page.original?.source ?? null]))
  })
  const portraits = await cachedJson(CACHE, 'anilist.json', async () => Object.fromEntries(await anilistPictures(ANILIST)))
  const artFiles = Object.fromEntries(titles.map((title) => [title, animeArt(pages[title].text)]).filter(([, file]) => file))
  const artUrls = await cachedJson(CACHE, 'art.json', () => wikiImageUrls(API, [...new Set(Object.values(artFiles))]))

  const result = []
  await pool(CHARACTERS, 6, async ([title, nameEn, name, gender, race, role, affiliations, debut]) => {
    const { id } = pages[title]
    const portrait = ART_ONLY.has(title) ? null : [nameEn, title, ...(ANILIST_NAMES[title] ?? [])].map((one) => portraits[nameKey(bare(one))]).find(Boolean)
    const buf = await pickPicture(path.join(CACHE, 'img'), String(id), [portrait, artUrls[artFiles[title]], images[title]])
    if (!buf) throw new Error(`немає картинки: ${title}`)
    const source = portrait ? buf : await upperBody(buf)
    await writeFullAndThumb(source, path.join(OUT_IMG, 'full', `${id}.webp`), path.join(THUMBS, `${id}.webp`), 96)
    if (!portrait) console.warn('без портрета AniList:', title)
    result.push({
      id,
      name,
      nameUk: UK[nameEn],
      nameEn,
      ...(searchTags(nameEn, name, UK[nameEn]) ? { aliases: searchTags(nameEn, name, UK[nameEn]) } : {}),
      gender,
      race,
      role,
      affiliations: affiliations.length ? affiliations : ['Без фракции'],
      debut: DEBUTS[debut],
      debutIndex: debut,
      answer: true,
    })
  })

  result.sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  await writeAtlas(result, THUMBS, path.join(OUT_IMG, 'thumbs.webp'), OUT_ATLAS, 10, 96)
  await pruneImages(path.join(OUT_IMG, 'full'), result)
  await fs.writeFile(OUT_JSON, JSON.stringify(result, null, 1))
  console.log(`wrote ${result.length} characters`)
}

main()
