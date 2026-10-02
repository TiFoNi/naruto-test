import fs from 'node:fs/promises'
import path from 'node:path'
import {
  PUBLIC,
  ROOT,
  cachedDownload,
  pickPicture,
  cachedJson,
  firstChapter,
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

const API = 'https://chainsawman.fandom.com/api.php'
const CACHE = path.join(ROOT, '.cache', 'csm')
const THUMBS = path.join(CACHE, 'thumb')
const OUT_IMG = path.join(PUBLIC, 'csm')
const OUT_JSON = path.join(ROOT, 'packages', 'game', 'data', 'csm.json')
const OUT_ATLAS = path.join(ROOT, 'packages', 'game', 'data', 'csm-atlas.json')
const ANSWER_POOL_SIZE = 50
const KEEP = 60

const EXCLUDE = new Set(['Characters', 'Unnamed Characters', 'Famine Devil', 'War Devil', 'Control Devil'])

const ARCS = [
  [1, 'Вступление'],
  [5, 'Дьявол-летучая мышь'],
  [13, 'Дьявол вечности'],
  [22, 'Человек с катаной'],
  [39, 'Девушка-бомба'],
  [53, 'Международные убийцы'],
  [71, 'Дьявол-ружьё'],
  [80, 'Дьявол контроля'],
  [98, 'Дьявол справедливости'],
  [112, 'Свидания Дэндзи'],
  [121, 'Дьявол падения'],
  [132, 'Церковь Бензопилы'],
  [156, 'Дьявол старения'],
  [191, 'Дьявол войны'],
]

const SEX = { Male: 'Мужской', Female: 'Женский' }

const SPECIES = [
  ['Гибрид', /hybrid/i],
  ['Исчадие', /fiend/i],
  ['Дьявол', /devil/i],
  ['Человек', /human/i],
  ['Животное', /animal|dog|cat|hybrid animal/i],
]

const ROLES = [
  ['Общественная безопасность', /public safety/i],
  ['Частный охотник', /private (sector )?devil hunter/i],
  ['Якудза', /yakuza/i],
  ['Наёмный убийца', /assassin|hitman/i],
  ['Церковь', /church|cult/i],
  ['Школьник', /student/i],
  ['Наёмный убийца', /assassin|hitman|spy|soldier/i],
]

const AFFILIATIONS = [
  ['Общественная безопасность', /public safety/i],
  ['Четыре всадника', /four horsemen/i],
  ['Якудза', /yakuza/i],
  ['Церковь Бензопилы', /chainsaw man church/i],
  ['Отряд Кишибэ', /kishibe|special division 4|division 4/i],
  ['Школа', /school|academy/i],
  ['Дьяволы', /devil hunters of|weapon (devils|humans)|gun devil/i],
]

const NAMES = {
  Denji: 'Дэндзи',
  Power: 'Пауэр',
  Makima: 'Макима',
  Aki: 'Аки Хаякава',
  'Aki Hayakawa': 'Аки Хаякава',
  'Kishibe': 'Кисибэ',
  Himeno: 'Химено',
  Kobeni: 'Кобени',
  'Kobeni Higashiyama': 'Кобени Хигасияма',
  Reze: 'Резе',
  Beam: 'Бим',
  Pochita: 'Почита',
  Nayuta: 'Наюта',
  Yoru: 'Ёру',
  Asa: 'Аса Митака',
  'Asa Mitaka': 'Аса Митака',
  Fami: 'Фами',
  Quanxi: 'Куанси',
  'Santa Claus': 'Санта-Клаус',
  'Angel Devil': 'Дьявол-ангел',
  'Gun Devil': 'Дьявол-ружьё',
  'Darkness Devil': 'Дьявол тьмы',
  'Falling Devil': 'Дьявол падения',
  'Hell Devil': 'Дьявол ада',
  'Katana Man': 'Человек с катаной',
  Sawatari: 'Акане Саватари',
  'Akane Sawatari': 'Акане Саватари',
  'Hirokazu Arai': 'Хироказу Араи',
  'Michiko Tendo': 'Митико Тэндо',
  'Yoshida Hirofumi': 'Хирофуми Йосида',
  'Hirofumi Yoshida': 'Хирофуми Йосида',
  Kiga: 'Кига',
  Barem: 'Барем',
  Galgali: 'Галгали',
  Haruka: 'Харука',
  'Haruka Iseumi': 'Харука Исэуми',
  Yuko: 'Юко',
  Nayuta: 'Наюта',
  'Fake Chainsaw Man': 'Фальшивый Человек-бензопила',
  Cosmo: 'Космо',
  Pingtsi: 'Пингци',
  Princi: 'Принци',
  'Miri Sugo': 'Мири Суго',
  'Yutaro Kurose': 'Ютаро Куросэ',
  'Seigi Akoku': 'Сэйги Акоку',
  'Nobana Higashiyama': 'Нобана Хигасияма',
  'Fumiko Mifune': 'Фумико Мифунэ',
  'Barem Bridge': 'Барем Бридж',
}

const WORDS = {
  Aging: 'старения',
  Angel: 'ангел',
  Bat: 'летучей мыши',
  Blood: 'крови',
  Bomb: 'бомбы',
  Chainsaw: 'бензопилы',
  Control: 'контроля',
  Crossbow: 'арбалета',
  Curse: 'проклятия',
  Darkness: 'тьмы',
  Death: 'смерти',
  Doll: 'куклы',
  Eternity: 'вечности',
  Falling: 'падения',
  Famine: 'голода',
  Fire: 'огня',
  Flamethrower: 'огнемёта',
  Fox: 'лисы',
  Future: 'будущего',
  Ghost: 'призрака',
  Gun: 'ружья',
  Hell: 'ада',
  Justice: 'справедливости',
  Katana: 'катаны',
  Leech: 'пиявки',
  Locust: 'саранчи',
  Nostalgia: 'ностальгии',
  Octopus: 'осьминога',
  Punishment: 'наказания',
  Sea: 'морского огурца',
  'Sea Cucumber': 'морского огурца',
  Shark: 'акулы',
  Snake: 'змеи',
  Spider: 'паука',
  Sword: 'меча',
  Typhoon: 'тайфуна',
  Violence: 'насилия',
  War: 'войны',
  Whip: 'кнута',
  Zombie: 'зомби',
  Mouth: 'рта',
  Needle: 'иглы',
  Nail: 'гвоздя',
  Spear: 'копья',
  Sword: 'меча',
  Pochita: 'Почита',
}

const SPECIES_OVERRIDES = { 'Aki Hayakawa': 'Человек', Denji: 'Человек', Pochita: 'Дьявол' }

const KINDS = [
  [/^(.+) Devil$/, 'Дьявол'],
  [/^(.+) Fiend$/, 'Исчадие'],
  [/^(.+) Hybrid$/, 'Гибрид'],
]

function titleOf(nameEn) {
  for (const [re, prefix] of KINDS) {
    const found = nameEn.match(re)
    if (!found) continue
    const word = WORDS[found[1]]
    if (word) return `${prefix} ${word}`
  }
  return null
}

const firstMatch = (rules, text) => rules.find(([, re]) => re.test(text))?.[0]
const matchRules = (rules, text) => rules.filter(([, re]) => re.test(text)).map(([label]) => label)

const lines = (raw) =>
  (raw ?? '')
    .split(/<br\s*\/?>|\n|\*/i)
    .map((line) => line.trim())
    .filter(Boolean)

const current = (raw) => lines(raw).filter((line) => !/formerly|briefly|coerced/i.test(line))

function debutChapter(text) {
  return firstChapter(infobox(text, 'manga_debut'))
}

const arcIndexOf = (chapter) => ARCS.reduce((index, [start], at) => (chapter >= start ? at : index), 0)

function species(name, text) {
  if (SPECIES_OVERRIDES[name]) return SPECIES_OVERRIDES[name]
  const raw = current(infobox(text, 'species')).join(' ') || plain(infobox(text, 'species') ?? '')
  return firstMatch(SPECIES, plain(raw)) ?? 'Неизвестно'
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
    if (!/\{\{Character/i.test(page.text)) return false
    if (debutChapter(page.text) === null) return false
    return !/unnamed|victim|citizen|'s (father|mother)/i.test(name)
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
    const occupation = plain(lines(infobox(text, 'occupation')).join('\n'))
    const affiliationText = plain(current(infobox(text, 'affiliation')).join('\n'))
    const affiliations = matchRules(AFFILIATIONS, `${affiliationText}\n${occupation}`)

    const chapter = debutChapter(text)
    const arcIndex = arcIndexOf(chapter)

    result.push({
      id,
      name: NAMES[name] ?? titleOf(name) ?? ruName(name, ru, transliterate),
      nameEn: name,
      gender: SEX[plain(infobox(text, 'gender') ?? '').trim()] ?? 'Другое',
      species: kind,
      role: firstMatch(ROLES, occupation) ?? (kind === 'Дьявол' ? 'Дьявол' : 'Нет'),
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
  dropDeleted(result, 'csm')
  onlyAnswers(result)
  result.sort((a, b) => a.name.localeCompare(b.name, 'ru'))

  await writeAtlas(result, THUMBS, path.join(OUT_IMG, 'thumbs.webp'), OUT_ATLAS, 12, 96)
  await pruneImages(path.join(OUT_IMG, 'full'), result)
  await fs.writeFile(OUT_JSON, JSON.stringify(result, null, 1))
  console.log(`wrote ${result.length} characters (${result.filter((one) => one.answer).length} answerable)`)
}

main()
