import fs from 'node:fs/promises'
import path from 'node:path'
import {
  PUBLIC,
  ROOT,
  cachedDownload,
  cachedJson,
  categoryMembers,
  infobox,
  plainList,
  pool,
  ruName,
  stripParens,
  wikiPages,
  wikiQuery,
  keepNotable,
  pruneImages,
  writeAtlas,
  writeFullAndThumb,
} from './lib.mjs'
import { transliterate } from './ru.mjs'
import { dropDeleted, onlyAnswers } from './dropped.mjs'

const API = 'https://tokyoghoul.fandom.com/api.php'
const CACHE = path.join(ROOT, '.cache', 'tg')
const THUMBS = path.join(CACHE, 'thumb')
const OUT_IMG = path.join(PUBLIC, 'tg')
const OUT_JSON = path.join(ROOT, 'packages', 'game', 'data', 'tg.json')
const OUT_ATLAS = path.join(ROOT, 'packages', 'game', 'data', 'tg-atlas.json')
const ANSWER_POOL_SIZE = 60
const KEEP = 100
const EXCLUDE = new Set(['Character infobox test'])

const SEX = { Male: 'Мужской', Female: 'Женский' }
const OTHER_SEX = 'Другое'

const SPECIES_RULES = [
  ['Одноглазый гуль', /one-eyed ghoul/i],
  ['Квинкс', /quinx/i],
  ['Полулюдь', /half-human/i],
  ['Гуль', /^ghoul$/i],
  ['Человек', /^human$|modified human|oggai/i],
  ['Животное', /canine|sparrow|cockatiel/i],
]

const AFFILIATION_RULES = [
  ['CCG', /\bccg\b|squad|division|sunlit garden|\bgarden\b|\btsc\b|oggai|investigator/i],
  ['Клан Вашу', /washuu/i],
  ['Антейку', /anteiku/i],
  ['Древо Аогири', /aogiri tree/i],
  ['Анти-Аогири', /anti-aogiri/i],
  ['Козёл', /\bgoat\b|kaneki's group/i],
  ['Клоуны', /clowns/i],
  ['V', /^v\b|\bv$/i],
  ['Гуль-ресторан', /ghoul restaurant|gourmet/i],
  ['Семья Цукиямы', /tsukiyama/i],
  ['Семья Розевальд', /rosewald/i],
  [':re', /^:re/i],
  ['Объединённый фронт', /united front/i],
  ['Канао', /kanou/i],
  ['Газовые маски', /gas masks/i],
  ['Белые костюмы', /white suits/i],
  ['Банда Уты', /uta's gang/i],
  ['Чёрные доберы', /black dobers/i],
]

const KAGUNE = { Ukaku: 'Укаку', Koukaku: 'Коукаку', Rinkaku: 'Ринкаку', Bikaku: 'Бикаку' }
const RATINGS = ['C', 'B', 'B+', 'A', 'A+', 'S', 'S+', 'SS', 'SS+', 'SSS']
const STATUS = { Alive: 'Жив', Deceased: 'Мёртв', Unknown: 'Неизвестно' }

function consistent(c) {
  const onlyHuman = c.species.length > 0 && c.species.every((s) => s === 'Человек')
  if (onlyHuman && c.kagune.length) return { ...c, species: ['Квинкс'] }
  if (onlyHuman && c.rating) return { ...c, rating: null, ratingIndex: -1 }
  return c
}

const matchRules = (rules, texts) => rules.filter(([, re]) => texts.some((t) => re.test(t))).map(([label]) => label)
const link = (value) => value?.match(/\[\[([^\]|#]+)/)?.[1]?.trim() ?? null

function rating(text) {
  const raw = plainList(infobox(text, 'rating')).join(' ')
  const found = [...raw.matchAll(/S{1,3}\+?|A\+?|B\+?|\bC\b/g)].map((m) => m[0]).filter((r) => RATINGS.includes(r))
  if (!found.length) return { rating: null, ratingIndex: -1 }
  const best = found.reduce((a, b) => (RATINGS.indexOf(b) > RATINGS.indexOf(a) ? b : a))
  return { rating: best, ratingIndex: RATINGS.indexOf(best) }
}

async function main() {
  await fs.mkdir(path.join(CACHE, 'img'), { recursive: true })
  await fs.mkdir(THUMBS, { recursive: true })
  await fs.mkdir(path.join(OUT_IMG, 'full'), { recursive: true })

  const names = (
    await cachedJson(CACHE, 'names.json', async () => [
      ...new Set([...(await categoryMembers(API, 'Male')), ...(await categoryMembers(API, 'Female'))]),
    ])
  ).filter((n) => !EXCLUDE.has(n) && !/\((game|oneshot)\)/i.test(n))
  const pages = await cachedJson(CACHE, 'pages.json', () => wikiPages(API, names))

  const debutOf = (n) => link(infobox(pages[n]?.text, 'manga debut'))
  const chapters = await cachedJson(CACHE, 'chapters.json', () => wikiPages(API, [...new Set(names.map(debutOf).filter(Boolean))]))

  function debut(n) {
    const title = debutOf(n)
    if (!title) return null
    if (title === 'Oneshot') return { series: 'tg', volume: 0 }
    const vol = Number(chapters[title]?.text?.match(/^\|\s*vol\s*=\s*(\d+)/m)?.[1])
    if (!vol) return null
    return { series: /^Re:/.test(title) ? 're' : 'tg', volume: vol }
  }

  const mainSeries = await cachedJson(CACHE, 'series.json', async () => {
    const res = await wikiQuery(API, names.filter((n) => pages[n]?.text), 'prop=categories&cllimit=500')
    return Object.fromEntries(
      Object.entries(res).map(([t, p]) => [t, (p.categories ?? []).some((c) => /Category:(TG|TG:re) Characters/.test(c.title))]),
    )
  })

  const candidates = names.filter((n) => pages[n]?.text && debut(n) && mainSeries[n])
  const animeFile = (n) => {
    const text = pages[n].text
    const start = text.search(/Anime[^=\n]*=/)
    return start < 0 ? null : (text.slice(start).match(/\[\[File:([^|\]{}]+)/)?.[1]?.trim() ?? null)
  }
  const images = await cachedJson(CACHE, 'images.json', async () => {
    const pageImages = await wikiQuery(API, candidates, 'prop=pageimages&piprop=original')
    const files = [...new Set(candidates.map(animeFile).filter(Boolean))]
    const fileUrls = await wikiQuery(API, files.map((f) => `File:${f}`), 'prop=imageinfo&iiprop=url')
    const fileUrl = (f) => (f ? (fileUrls[`File:${f}`]?.imageinfo?.[0]?.url ?? null) : null)
    return Object.fromEntries(
      candidates.map((n) => [n, [fileUrl(animeFile(n)), pageImages[n]?.original?.source].filter(Boolean)]),
    )
  })

  const result = []
  await pool(candidates, 10, async (name) => {
    const { id, text, ru, length } = pages[name]
    const buf = await cachedDownload(path.join(CACHE, 'img'), String(id), images[name])
    if (!buf) return console.warn('no image', name)
    try {
      await writeFullAndThumb(buf, path.join(OUT_IMG, 'full', `${id}.webp`), path.join(THUMBS, `${id}.webp`), 96)
    } catch (e) {
      return console.warn('image failed', name, e.message)
    }
    const field = (f) => plainList(infobox(text, f))
    const species = field('species').filter((s) => !/formerly/i.test(s)).map(stripParens)
    const { series, volume } = debut(name)
    result.push(consistent({
      id,
      name: ruName(name, ru, transliterate),
      nameEn: name,
      gender: SEX[stripParens(field('gender')[0] ?? '')] ?? OTHER_SEX,
      species: matchRules(SPECIES_RULES, species),
      affiliations: matchRules(AFFILIATION_RULES, field('affiliations').map((a) => stripParens(a).replace(/\s+-\s+.*$/, ''))),
      kagune: [...new Set(field('rc type').flatMap((r) => r.split(/[・,/]/)).map((r) => KAGUNE[stripParens(r).trim()]).filter(Boolean))],
      ...rating(text),
      status: STATUS[stripParens(field('status')[0] ?? '').split('/')[0]] ?? STATUS.Unknown,
      series,
      volume,
      debutIndex: (series === 're' ? 100 : 0) + volume,
      length,
    }))
  })

  result.sort((a, b) => b.length - a.length)
  result.forEach((c, i) => {
    c.answer = i < ANSWER_POOL_SIZE
    delete c.length
  })
  const kept = keepNotable(result, KEEP)
  result.length = 0
  result.push(...kept)
  dropDeleted(result, 'tg')
  onlyAnswers(result)
  result.sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  await writeAtlas(result, THUMBS, path.join(OUT_IMG, 'thumbs.webp'), OUT_ATLAS, 16, 96)
  await pruneImages(path.join(OUT_IMG, 'full'), result)
  await fs.writeFile(OUT_JSON, JSON.stringify(result, null, 1))
  console.log(`wrote ${result.length} characters (${result.filter((c) => c.answer).length} answerable)`)
}

main()
