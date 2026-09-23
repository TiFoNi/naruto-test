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

const API = 'https://avatar.fandom.com/api.php'
const CACHE = path.join(ROOT, '.cache', 'avatar')
const THUMBS = path.join(CACHE, 'thumb')
const OUT_IMG = path.join(ROOT, 'public', 'avatar')
const OUT_JSON = path.join(ROOT, 'src', 'data', 'avatar.json')
const OUT_ATLAS = path.join(ROOT, 'src', 'data', 'avatar-atlas.json')
const ANSWER_POOL_SIZE = 70
const KEEP = 95

const ARCS = [
  'Книга 1: Вода',
  'Книга 2: Земля',
  'Книга 3: Огонь',
  'Корра: Книга 1',
  'Корра: Книга 2',
  'Корра: Книга 3',
  'Корра: Книга 4',
]

const NATIONS = [
  ['Духи', /^(Spirit|Spirits|Spirit World)$/],
  ['Воздушные кочевники', /^(Air Nomads|Air Nomad characters)$/],
  ['Племя Воды', /^(Water Tribe|Water Tribe characters)$/],
  ['Народ Огня', /^(Fire Nation|Fire Nation characters)$/],
  ['Царство Земли', /^(Earth Kingdom|Earth Kingdom characters)$/],
  ['Объединённая Республика', /^(URN|United Republic characters)$/],
]

const BENDING = [
  ['Вода', /^(Waterbender|Former waterbender|Waterbenders)$/],
  ['Земля', /^(Earthbender|Former earthbender|Earthbenders)$/],
  ['Огонь', /^(Firebender|Former firebender|Firebenders)$/],
  ['Воздух', /^(Airbender|Former airbender|Airbenders)$/],
  ['Энергия', /^(Energybender|Energybenders)$/],
]

const SKILLS = [
  ['Металл', /^Metalbenders$/],
  ['Кровь', /^Bloodbenders$/],
  ['Лава', /^Lavabenders$/],
  ['Взрыв', /^Combustionbenders$/],
  ['Молния', /^Lightning (generation|redirection) users$/],
  ['Сейсмическое чутьё', /^Seismic sense users$/],
  ['Блокировка ци', /^Chi-blockers$/],
  ['Исцеление', /^Healers$/],
]

const GROUPS = [
  ['Команда Аватара', /^Team Avatar( \(Korra\))?$/],
  ['Аватары', /^Avatars$/],
  ['Белый Лотос', /^Order of the White Lotus$/],
  ['Красный Лотос', /^Red Lotus$/],
  ['Уравнители', /^(Equalist|Equalists)$/],
  ['Земная Империя', /^Earth Empire$/],
  ['Дай Ли', /^Dai Li$/],
  ['Королевская семья Народа Огня', /^(Fire Nation Royal Family|Fire Lords)$/],
  ['Воины Киоши', /^Kyoshi Warriors$/],
  ['Клан Металла', /^Metal Clan$/],
  ['Полиция Республики', /^Republic City Police$/],
  ['Триады', /^(Triad members|Triple Threat Triad|Organized crime)$/],
  ['Свободные бойцы', /^Freedom Fighters$/],
  ['Воздушные аколиты', /^Air Acolytes$/],
  ['Армия', /^(Soldiers|Generals|Rough Rhinos|Mercenaries and bounty hunters)$/],
]

const ANIMALS = /^(Fauna|Flying bison|Dragons|Hybridized creatures|Non-hybrid creatures)$/

const EXCLUDE = /^(Netflix:|Talk:|List of)|\((games|disambiguation|Netflix)\)/

const NAMES = {
  Aang: 'Аанг',
  Katara: 'Катара',
  Sokka: 'Сокка',
  Zuko: 'Зуко',
  'Toph Beifong': 'Тоф Бейфонг',
  Azula: 'Азула',
  Iroh: 'Айро',
  Appa: 'Аппа',
  Momo: 'Момо',
  Korra: 'Корра',
  Mako: 'Мако',
  Bolin: 'Болин',
  'Asami Sato': 'Асами Сато',
  Naga: 'Нага',
  Pabu: 'Пабу',
  Amon: 'Амон',
  Tenzin: 'Тензин',
  Jinora: 'Джинора',
  Ikki: 'Икки',
  Meelo: 'Мило',
  Zaheer: 'Захир',
  Kuvira: 'Кувира',
  Unalaq: 'Уналак',
  Ozai: 'Озай',
  Suki: 'Суки',
  'Ty Lee': 'Тай Ли',
  Mai: 'Май',
  Roku: 'Року',
  Kyoshi: 'Киоши',
  Yangchen: 'Янчен',
  Kuruk: 'Курук',
  Wan: 'Ван',
  Raava: 'Рава',
  Vaatu: 'Вату',
  Gyatso: 'Гьяцо',
  Zhao: 'Чжао',
  Jet: 'Джет',
  Haru: 'Хару',
  Yue: 'Юи',
  Hama: 'Хама',
  Pakku: 'Пакку',
  'Lin Beifong': 'Лин Бейфонг',
  'Suyin Beifong': 'Суинь Бейфонг',
  'Hiroshi Sato': 'Хироши Сато',
  'Iknik Blackstone Varrick': 'Варрик',
  'Zhu Li Moon': 'Чжу Ли',
  Tonraq: 'Тонрак',
  Senna: 'Сенна',
  Pema: 'Пема',
  Opal: 'Опал',
  Kai: 'Кай',
  'Ming-Hua': 'Мин-Хуа',
  Ghazan: 'Газан',
  "P'Li": 'Пи Ли',
  Tarrlok: 'Тарлок',
  Yakone: 'Якон',
  'Long Feng': 'Лонг Фенг',
  'Wan Shi Tong': 'Ван Ши Тонг',
  Koh: 'Ко',
  'Combustion Man': 'Взрывник',
  'Cabbage merchant': 'Торговец капустой',
  Sozin: 'Созин',
  Azulon: 'Азулон',
  Ursa: 'Урса',
  Hakoda: 'Хакода',
  Kanna: 'Канна',
  Piandao: 'Пьяндао',
  'Jeong Jeong': 'Чжон Чжон',
  'Iroh (United Forces general)': 'Айро II',
  'Bumi (King of Omashu)': 'Буми (король Омашу)',
  Bumi: 'Буми (брат Тензина)',
  Kya: 'Кия (дочь Аанга)',
  'Kya (nonbender)': 'Кая (мать Катары)',
  'Desna and Eska': 'Десна и Эска',
  'Wei and Wing': 'Вэй и Винг',
  'The Boulder': 'Глыба',
  Lieutenant: 'Лейтенант',
  'Head of the Dai Li': 'Глава Дай Ли',
}

const ALWAYS = new Set([
  'Yue', 'Piandao', 'Combustion Man', 'Kanna', 'Koh', 'June', 'Kya (nonbender)', 'The Boulder', 'Momo', 'Pakku',
  'Hama', 'Haru', "P'Li", 'Wan Shi Tong', 'Hou-Ting', 'Jeong Jeong', 'Yakone', 'Senna', 'Lu Ten',
])
const NEVER = new Set(['Ukano', 'Jin', 'Longshot', 'Smellerbee', 'Wei and Wing', 'Lao Beifong', 'Szeto', 'Lieutenant'])
const SKIP = new Set([
  'Yangchen', 'Aika', 'Vachir', 'Gilak', 'Guan', 'Daw', 'Mira', 'Rie', 'Fume', 'Shady Shin', 'Ta Min', 'Mongke',
  'Head of the Dai Li', 'Two Toed Ping', 'Sneers', 'Pipsqueak', 'Ryu', 'Taqukaq', 'Sung', 'Yin', 'Chong',
])

const matchRules = (rules, values) => rules.filter(([, re]) => values.some((v) => re.test(v))).map(([label]) => label)

const tokensOf = (text) => (text.match(/\{\{Icons\|([^}]*)\}\}/)?.[1] ?? '').split('|').map((t) => t.trim()).filter(Boolean)

function debutOf(text, series) {
  const eps = [...text.matchAll(/\{\{Cite episode\|(\d+)\|(\d+)/g)]
    .map((m) => [Number(m[1]), Number(m[2])])
    .filter(([s, episode]) => s <= 2 && episode >= 100 && episode < 500 && (!series || s === series))
  const first = eps.sort((a, b) => a[0] - b[0] || a[1] - b[1])[0]
  if (!first) return null
  const book = Math.floor(first[1] / 100)
  return { arcIndex: (first[0] === 1 ? 0 : 3) + book - 1, episode: first[0] * 1000 + first[1] }
}

function imageFile(text) {
  const value = infobox(text, 'image')
  if (!value) return null
  const gallery = value.match(/<gallery>\s*([^|\n<]+)/)
  if (gallery) return gallery[1].trim()
  const plainName = plain(value).trim().split('\n')[0].trim()
  return /\.(png|jpg|jpeg|webp|gif)$/i.test(plainName) ? plainName : null
}

function genderOf(text) {
  const value = plain(infobox(text, 'pronouns') ?? '').toLowerCase()
  if (value.startsWith('she')) return 'Женский'
  if (value.startsWith('he')) return 'Мужской'
  return 'Другое'
}

async function main() {
  await fs.mkdir(path.join(CACHE, 'img'), { recursive: true })
  await fs.mkdir(THUMBS, { recursive: true })
  await fs.mkdir(path.join(OUT_IMG, 'full'), { recursive: true })

  const both = await cachedJson(CACHE, 'series.json', async () => ({
    atla: await categoryMembers(API, 'Avatar: The Last Airbender characters'),
    korra: await categoryMembers(API, 'Legend of Korra characters'),
  }))
  const atlaSet = new Set(both.atla)
  const seriesOf = (name) => (atlaSet.has(name) ? 1 : 2)
  const names = [...new Set([...both.atla, ...both.korra])]
  const pages = await cachedJson(CACHE, 'pages.json', () => wikiPages(API, names))
  const categories = await cachedJson(CACHE, 'categories.json', async () => {
    const res = await wikiQuery(API, names, 'prop=categories&cllimit=500')
    return Object.fromEntries(Object.entries(res).map(([t, p]) => [t, (p.categories ?? []).map((c) => c.title.replace('Category:', ''))]))
  })

  const candidates = names.filter((n) => !EXCLUDE.test(n) && !SKIP.has(n) && pages[n]?.text && debutOf(pages[n].text, seriesOf(n)))
  const files = Object.fromEntries(candidates.map((n) => [n, imageFile(pages[n].text)]).filter(([, f]) => f))
  const urls = await cachedJson(CACHE, 'images.json', () => wikiImageUrls(API, [...new Set(Object.values(files))]))

  const result = []
  await pool(candidates, 8, async (name) => {
    const { id, text, ru, length } = pages[name]
    const source = urls[files[name]]
    if (!source) return console.warn('no image', name)
    const buf = await cachedDownload(path.join(CACHE, 'img'), String(id), [source])
    if (!buf) return console.warn('download failed', name)
    try {
      await writeFullAndThumb(buf, path.join(OUT_IMG, 'full', `${id}.webp`), path.join(THUMBS, `${id}.webp`), 96)
    } catch (e) {
      return console.warn('image failed', name, e.message)
    }

    const cats = categories[name] ?? []
    const tokens = tokensOf(text)
    const marks = [...tokens, ...cats]
    const avatar = cats.includes('Avatars')
    const bending = avatar ? ['Вода', 'Земля', 'Огонь', 'Воздух', 'Энергия'] : matchRules(BENDING, marks)
    const nation = matchRules(NATIONS, marks)[0] ?? 'Неизвестно'
    const groups = matchRules(GROUPS, marks)
    result.push({
      id,
      name: NAMES[name] ?? ruName(name, ru, transliterate),
      nameEn: name,
      gender: genderOf(text),
      nation,
      bending: bending.length ? bending : ['Нет'],
      skills: matchRules(SKILLS, cats).length ? matchRules(SKILLS, cats) : ['Нет'],
      groups: groups.length ? groups : cats.some((c) => ANIMALS.test(c)) ? ['Животные'] : ['Сами по себе'],
      status: plain(infobox(text, 'death') ?? '').trim() ? 'Мёртв' : 'Жив',
      ...debutOf(text, seriesOf(name)),
      length,
    })
  })

  result.sort((a, b) => b.length - a.length)
  result.forEach((c, i) => {
    c.answer = (i < ANSWER_POOL_SIZE || ALWAYS.has(c.nameEn)) && !NEVER.has(c.nameEn)
    delete c.length
    delete c.episode
  })
  const kept = keepNotable(result, KEEP)
  result.length = 0
  result.push(...kept)
  dropDeleted(result, 'avatar')
  onlyAnswers(result)
  result.forEach((c) => (c.arc = ARCS[c.arcIndex]))
  result.sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  await writeAtlas(result, THUMBS, path.join(OUT_IMG, 'thumbs.webp'), OUT_ATLAS, 12, 96)
  await pruneImages(path.join(OUT_IMG, 'full'), result)
  await fs.writeFile(OUT_JSON, JSON.stringify(result, null, 1))
  console.log(`wrote ${result.length} characters (${result.filter((c) => c.answer).length} answerable)`)
}

main()
