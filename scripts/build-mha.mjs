import fs from 'node:fs/promises'
import path from 'node:path'
import {
  PUBLIC,
  ROOT,
  cachedDownload,
  cachedJson,
  categoryMembers,
  firstChapter,
  galleryImage,
  infobox,
  keepNotable,
  pickPicture,
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
import { anilistPictures, bare, nameKey } from './anilist.mjs'

const API = 'https://myheroacademia.fandom.com/api.php'
const CACHE = path.join(ROOT, '.cache', 'mha')
const THUMBS = path.join(CACHE, 'thumb')
const OUT_IMG = path.join(PUBLIC, 'mha')
const OUT_JSON = path.join(ROOT, 'packages', 'game', 'data', 'mha.json')
const OUT_ATLAS = path.join(ROOT, 'packages', 'game', 'data', 'mha-atlas.json')
const ANILIST = [21459, 21856, 100166, 104276, 117193, 139630]
const ANSWER_POOL_SIZE = 115
const KEEP = 150

const EXCLUDE = new Set(['Characters', 'Unnamed Characters', 'My Hero Academia'])

const ARCS = [
  [1, 'Вступительный экзамен'],
  [5, 'Тест на причуды'],
  [8, 'Тренировочный бой'],
  [12, 'Нападение на USJ'],
  [22, 'Спортивный фестиваль'],
  [45, 'Против Убийцы героев'],
  [60, 'Выпускные экзамены'],
  [70, 'Лагерь подготовки'],
  [84, 'Рейд на убежище'],
  [98, 'Экзамен на лицензию'],
  [122, 'Шиэ Хассайкай'],
  [163, 'Дополнительные курсы'],
  [169, 'Фестиваль Ю-Эй'],
  [184, 'Профи-герои'],
  [194, 'Совместные тренировки'],
  [218, 'Армия освобождения мета'],
  [241, 'Агентство Индевора'],
  [253, 'Война с Фронтом освобождения'],
  [307, 'Тёмный герой'],
  [329, 'Звёзды и Полосы'],
  [335, 'Предатель Ю-Эй'],
  [343, 'Финальная война'],
  [425, 'Эпилог'],
]

const SEX = { Male: 'Мужской', Female: 'Женский' }

const QUIRKS = [
  ['Эмиттер', 'Emitters'],
  ['Трансформация', 'Transformers'],
  ['Мутация', 'Mutants'],
  ['Без причуды', 'Quirkless'],
]

const SIDES = [
  ['Злодей', ['Villains']],
  ['Виджиланте', ['Vigilantes']],
  ['Ученик', ['U.A. Students', 'Students', 'Hero Trainees']],
  ['Профи-герой', ['Pro Heroes', 'Heroes', 'Former Pro Heroes']],
  ['Полиция', ['Police Officers', 'Police Force']],
  ['Гражданский', ['Civilians']],
]

const AFFILIATIONS = [
  ['Класс 1-A', ['Class 1-A']],
  ['Класс 1-B', ['Class 1-B']],
  ['Ю-Эй', ['U.A. Students', 'Former U.A. Students', 'U.A. Staff', 'Hero Teachers', 'U.A. High School Students']],
  ['Лига злодеев', ['League of Villains']],
  ['Фронт освобождения', ['Paranormal Liberation Front']],
  ['Шиэ Хассайкай', ['Shie Hassaikai']],
  ['Армия освобождения мета', ['Meta Liberation Army']],
  ['Полиция', ['Police Officers', 'Police Force']],
  ['Профи-герои', ['Pro Heroes', 'Former Pro Heroes']],
]

const NAMES = {
  'All For One': 'Все За Одного',
  'Toshinori Yagi': 'Всемогущий',
  'Death Arms': 'Дэт Армс',
  'Cathleen Bate': 'Кэтлин Бейт',
  'Ordinary Woman': 'Обычная женщина',
  'David Shield': 'Дэвид Шилд',
  Nine: 'Найн',
  Snipe: 'Снайп',
}

// прізвиська для пошуку: офіційні геройські імена російською
const NICKS = {
  'Izuku Midoriya': 'деку',
  'Katsuki Bakugo': 'динамит граунд зиро каччан',
  'Shoto Todoroki': 'шото',
  'Toshinori Yagi': 'всемогущий олл майт',
  'Keigo Takami': 'хоукс ястреб',
  'Enji Todoroki': 'индевор',
  'Shota Aizawa': 'эрейзерхед стиратель',
  'Hizashi Yamada': 'презент майк',
  'Nemuri Kayama': 'миднайт полуночь',
  'Mirio Togata': 'луминьюс лемиллион',
  'Tamaki Amajiki': 'саннитай',
  'Nejire Hado': 'нежире чан',
  'Rumi Usagiyama': 'мируко',
  'Tenya Ida': 'ингениум',
  'Ochaco Uraraka': 'юравити гравитация',
  'Tsuyu Asui': 'фроппи цую',
  'Eijiro Kirishima': 'красный бунтарь ред райот',
  'Fumikage Tokoyami': 'цукуёми',
  'Shoji Mezo': 'тентакол',
  'Chizome Akaguro': 'стейн убийца героев',
  'Kai Chisaki': 'оверхол',
  'Tomura Shigaraki': 'шигараки томура',
  'Yu Takeyama': 'маунт леди',
  'Taishiro Toyomitsu': 'фэт гам',
  'Kugo Sakamata': 'гэнг орка',
}

const categories = (page) => page.categories ?? []

const debutChapter = (text) => firstChapter(infobox(text, 'debut') ?? '')

const arcIndexOf = (chapter) => ARCS.reduce((index, [start], at) => (chapter >= start ? at : index), 0)

const heightOf = (text) => {
  const raw = plain(infobox(text, 'height') ?? '')
  const hit = raw.match(/([\d.]+)\s*cm/i)
  if (!hit) return null
  const value = Math.round(Number(hit[1]))
  return value >= 40 && value <= 600 ? value : null
}

const firstTag = (rules, tags) => rules.find(([, names]) => names.some((name) => tags.includes(name)))?.[0] ?? null

const allTags = (rules, tags) => rules.filter(([, names]) => names.some((name) => tags.includes(name))).map(([label]) => label)

const quirkType = (tags) => QUIRKS.find(([, tag]) => tags.includes(tag))?.[0] ?? 'Неизвестно'

const aliasesOf = (text) => {
  const raw = plain(infobox(text, 'alias') ?? '')
  return [...new Set(raw.split('\n').map((one) => one.replace(/\(.*$/, '').trim()).filter((one) => one && one.length < 30))].slice(0, 4)
}

async function main() {
  await fs.mkdir(path.join(CACHE, 'img'), { recursive: true })
  await fs.mkdir(THUMBS, { recursive: true })
  await fs.mkdir(path.join(OUT_IMG, 'full'), { recursive: true })

  const names = (await cachedJson(CACHE, 'members.json', () => categoryMembers(API, 'Characters'))).filter((one) => !EXCLUDE.has(one))
  const pages = await cachedJson(CACHE, 'pages.json', () => wikiPages(API, names))
  const tags = await cachedJson(CACHE, 'tags.json', async () => {
    const res = await wikiQuery(API, names, 'prop=categories&cllimit=500')
    return Object.fromEntries(
      Object.entries(res).map(([title, page]) => [title, (page.categories ?? []).map((one) => one.title.replace(/^Category:/, ''))]),
    )
  })

  const candidates = names.filter((name) => {
    const page = pages[name]
    if (!page?.text) return false
    if (!/\{\{Character[_ ]?Infobox/i.test(page.text)) return false
    if (debutChapter(page.text) === null) return false
    return !/unnamed|civilian [a-z]|crowd|student [a-z]/i.test(name)
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
    if (!buf) return console.warn('нема картинки', name)
    const wiki = await cachedDownload(path.join(CACHE, 'img', 'source-2'), String(id), [images[name]])
    try {
      await writeFullAndThumb(buf, path.join(OUT_IMG, 'full', `${id}.webp`), path.join(THUMBS, `${id}.webp`), 96, { big: wiki })
    } catch (error) {
      return console.warn('картинка не зібралась', name, error.message)
    }

    const own = tags[name] ?? []
    const chapter = debutChapter(text)
    const arcIndex = arcIndexOf(chapter)
    const affiliations = allTags(AFFILIATIONS, own)

    result.push({
      id,
      name: NAMES[name] ?? ruName(name, ru, transliterate),
      nameEn: name,
      aliases: [NICKS[name], ...aliasesOf(text)].filter(Boolean).join(' ').toLowerCase(),
      gender: SEX[plain(infobox(text, 'gender') ?? '').trim()] ?? 'Другое',
      quirkType: quirkType(own),
      side: firstTag(SIDES, own) ?? 'Гражданский',
      affiliations: affiliations.length ? affiliations : ['Без фракции'],
      height: heightOf(text),
      arc: ARCS[arcIndex][1],
      arcIndex,
      length,
    })
  })

  result.sort((a, b) => b.length - a.length)
  let picked = 0
  for (const one of result) {
    one.answer = picked < ANSWER_POOL_SIZE && one.height !== null && one.quirkType !== 'Неизвестно' && one.gender !== 'Другое'
    if (one.answer) picked++
    delete one.length
  }

  const kept = keepNotable(result, KEEP).filter((one) => one.height !== null)
  result.length = 0
  result.push(...kept)
  dropDeleted(result, 'mha')
  onlyAnswers(result)
  result.sort((a, b) => a.name.localeCompare(b.name, 'ru'))

  await writeAtlas(result, THUMBS, path.join(OUT_IMG, 'thumbs.webp'), OUT_ATLAS, 12, 96)
  await pruneImages(path.join(OUT_IMG, 'full'), result)
  await fs.writeFile(OUT_JSON, JSON.stringify(result, null, 1))
  console.log(`зібрано ${result.length} персонажів (${result.filter((one) => one.answer).length} у пулі відповідей)`)
}

main()
