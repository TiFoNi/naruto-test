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

const API = 'https://bleach.fandom.com/api.php'
const CACHE = path.join(ROOT, '.cache', 'bleach')
const THUMBS = path.join(CACHE, 'thumb')
const OUT_IMG = path.join(PUBLIC, 'bleach')
const OUT_JSON = path.join(ROOT, 'packages', 'game', 'data', 'bleach.json')
const OUT_ATLAS = path.join(ROOT, 'packages', 'game', 'data', 'bleach-atlas.json')
const MAL = path.join(ROOT, '.cache', 'mal-269.json')
const ANSWER_POOL_SIZE = 130
const KEEP = 160
const MAX_CHAPTER = 686

const SEX = { Male: 'Мужской', Female: 'Женский' }

const ARCS = [
  [1, 'Агент шинигами'],
  [71, 'Общество душ: проникновение'],
  [118, 'Общество душ: спасение'],
  [183, 'Арранкары'],
  [239, 'Уэко Мундо'],
  [316, 'Поддельная Каракура'],
  [424, 'Потерянный агент'],
  [480, 'Тысячелетняя кровавая война'],
]
const PENDULUM = 'Поворот маятника'

const RACES = {
  Human: 'Человек',
  Hollow: 'Пустой',
  Arrancar: 'Арранкар',
  Quincy: 'Квинси',
  Dragon: 'Дракон',
  'Zanpakutō Spirit': 'Дух занпакто',
  Plus: 'Душа',
  Souls: 'Душа',
  'Modified Soul': 'Модифицированная душа',
  'Enhanced Artificial Soul': 'Искусственная душа',
  'Hollow-Soul Hybrid': 'Гибрид',
  'Hollow-Zanpakutō Spirit hybrid': 'Дух занпакто',
  'Quincy Power Manifestation': 'Квинси',
  Boar: 'Кабан',
  Unknown: 'Неизвестно',
}

const AFFILIATION_RULES = [
  ['Готей 13', /gotei|division|s\.r\.d\.i|onmitsuki|kid[ōo]|shinigami research/i],
  ['Нулевой отряд', /royal guard|squad zero|zero division|soul king/i],
  ['Общество душ', /soul society|noble houses|kuchiki|shiba clan|shih[ōo]in|ky[ōo]raku|ise clan|[ōo]maeda|shin'?[ōo] academy/i],
  ['Армия Айзена', /aizen|arrancar army|tres bestias|harribel|nelliel|espada|fracci[óo]n|hueco mundo/i],
  ['Ванденрейх', /wandenreich|sternritter|schutzstaffel|jagdarmee|yhwach|quincy/i],
  ['Вайзарды', /visored/i],
  ['Экскюшн', /xcution|ginj[ōo]|tsukishima/i],
  ['Каракура', /karakura|kurosaki|ichigo|urahara|unagiya|ishida|wing bind|arisawa|inoue/i],
  ['Ад', /\bhell\b/i],
]

const RANK_RULES = [
  ['Капитан', /captain(?!.*lieutenant)|head captain|captain-commander/i],
  ['Лейтенант', /lieutenant|vice-captain/i],
  ['Офицер', /\bseat\b|seated officer/i],
  ['Нулевой отряд', /royal guard|squad zero/i],
  ['Эспада', /espada/i],
  ['Фрасьон', /fracci[óo]n/i],
  ['Штернриттер', /sternritter/i],
  ['Ученик академии', /(shin'?[ōo] academy|shinigami academy)[^,;]*student|academy student/i],
  ['Школьник', /(?<!academy )student/i],
]

const POWER_FIELDS = [
  ['shikai', 'Шикай'],
  ['bankai', 'Банкай'],
  ['resurrección', 'Ресуррексион'],
  ['resurreccion', 'Ресуррексион'],
  ['fullbring', 'Фулбринг'],
  ['vollständig', 'Фольштендиг'],
  ['schrift', 'Шрифт'],
]

const OVERRIDES = {
  'Ichigo Kurosaki': { races: ['Человек', 'Шинигами', 'Пустой', 'Квинси'] },
  'Sousuke Aizen': { affiliations: ['Готей 13', 'Армия Айзена'] },
  'Gin Ichimaru': { affiliations: ['Готей 13', 'Армия Айзена'] },
  'Kaname Tōsen': { affiliations: ['Готей 13', 'Армия Айзена'] },
}

const NAMES = {
  'Zangetsu (Zanpakutō spirit)': 'Зангецу (дух занпакто)',
  'Zangetsu (Quincy Powers)': 'Зангецу (Яхве)',
  'Soul King': 'Король душ',
  'Suì-Fēng': 'Сой Фон',
}

const pageTitle = (t) => !t.includes('/')

function arcFor(chapter) {
  if (chapter < 0) return { arc: PENDULUM, arcIndex: 3.5 }
  let index = 0
  ARCS.forEach(([start], i) => chapter >= start && (index = i))
  return { arc: ARCS[index][1], arcIndex: index }
}

const matchRules = (rules, texts) => rules.filter(([, re]) => texts.some((t) => re.test(t))).map(([label]) => label)

function races(text, affiliations, powers) {
  const list = plainList(infobox(text, 'race')).map((r) => r.replace(/\s*\(.*$/, '').trim())
  const out = new Set()
  for (const r of list) {
    if (r === 'Soul') out.add(powers.includes('Шикай') || powers.includes('Банкай') || affiliations.includes('Готей 13') ? 'Шинигами' : 'Душа')
    else if (RACES[r]) out.add(RACES[r])
  }
  if (affiliations.includes('Вайзарды')) out.add('Пустой')
  if (division(text)) out.add('Шинигами')
  return [...out]
}

const nameKey = (s) =>
  stripParens(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/ou/g, 'o')
    .replace(/([aeiou])\1/g, '$1')
    .replace(/[^a-z ]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(' ')

function division(text) {
  const fields = ['division', 'previous division', 'position', 'previous position']
  for (const field of fields) {
    const value = plainList(infobox(text, field)).join(' ')
    const m = field.includes('division')
      ? value.match(/(\d+)(?:st|nd|rd|th)? Division/i)
      : value.match(/(?:captain|lieutenant) of the (\d+)(?:st|nd|rd|th) Division/i)
    if (m) return Number(m[1])
  }
  return null
}

function consistent(c) {
  const races = new Set(c.races)
  const affiliations = new Set(c.affiliations)
  let ranks = [...c.ranks]
  const artificial = races.has('Искусственная душа') || races.has('Модифицированная душа')
  if ((c.powers.includes('Шикай') || c.powers.includes('Банкай')) && !artificial) {
    races.delete('Душа')
    races.add('Шинигами')
  }
  if (c.powers.includes('Фулбринг')) races.add('Человек')
  if (c.powers.includes('Ресуррексион') && !races.has('Шинигами')) races.add('Арранкар')
  if (ranks.includes('Штернриттер')) {
    races.add('Квинси')
    affiliations.add('Ванденрейх')
  }
  if (ranks.includes('Эспада') || ranks.includes('Фрасьон')) {
    races.add('Арранкар')
    affiliations.add('Армия Айзена')
  }
  if (c.division) affiliations.add('Готей 13')
  if (!affiliations.has('Готей 13') && !affiliations.has('Нулевой отряд')) ranks = ranks.filter((r) => r !== 'Капитан' && r !== 'Лейтенант')
  const order = (list, all) => all.filter((x) => list.has(x)).concat([...list].filter((x) => !all.includes(x)))
  return {
    ...c,
    races: order(races, [...new Set(Object.values(RACES).concat(['Шинигами']))]),
    affiliations: order(affiliations, AFFILIATION_RULES.map(([label]) => label)),
    ranks,
  }
}

function malFavorites() {
  return fs
    .readFile(MAL, 'utf8')
    .then((raw) => {
      const out = {}
      for (const { character, favorites } of JSON.parse(raw).data ?? []) {
        const [last, first] = character.name.split(',').map((s) => s.trim())
        const name = first ? `${first} ${last}` : last
        out[nameKey(name)] = Math.max(out[nameKey(name)] ?? 0, favorites)
      }
      return out
    })
    .catch(() => ({}))
}

async function main() {
  await fs.mkdir(path.join(CACHE, 'img'), { recursive: true })
  await fs.mkdir(THUMBS, { recursive: true })
  await fs.mkdir(path.join(OUT_IMG, 'full'), { recursive: true })

  const names = (
    await cachedJson(CACHE, 'names.json', async () => [
      ...new Set([...(await categoryMembers(API, 'Male')), ...(await categoryMembers(API, 'Female'))]),
    ])
  ).filter(pageTitle)
  const pages = await cachedJson(CACHE, 'pages.json', () => wikiPages(API, names))
  const missing = names.filter((n) => !pages[n])
  for (let i = 0; i < missing.length; i += 5) Object.assign(pages, await wikiPages(API, missing.slice(i, i + 5)))
  await fs.writeFile(path.join(CACHE, 'pages.json'), JSON.stringify(pages))

  const candidates = names.filter((n) => {
    const debut = infobox(pages[n]?.text, 'manga debut') ?? ''
    if (/burn the witch/i.test(debut)) return false
    const m = debut.match(/Chapter\s*(-?\d+)/)
    return m && Number(m[1]) <= MAX_CHAPTER && SEX[infobox(pages[n].text, 'gender')?.replace(/<.*$/s, '').trim()]
  })

  const images = await cachedJson(CACHE, 'images.json', async () => {
    const res = await wikiQuery(API, candidates, 'prop=pageimages&piprop=original')
    return Object.fromEntries(Object.entries(res).map(([t, p]) => [t, p.original?.source ?? null]))
  })
  const favorites = await malFavorites()

  const result = []
  await pool(candidates, 10, async (name) => {
    const id = pages[name].id
    const buf = await cachedDownload(path.join(CACHE, 'img'), String(id), [images[name]])
    if (!buf) return console.warn('no image', name)
    try {
      await writeFullAndThumb(buf, path.join(OUT_IMG, 'full', `${id}.webp`), path.join(THUMBS, `${id}.webp`), 96)
    } catch (e) {
      return console.warn('image failed', name, e.message)
    }
    const text = pages[name].text
    const chapter = Number(infobox(text, 'manga debut').match(/Chapter\s*(-?\d+)/)[1])
    const affiliationTexts = [...plainList(infobox(text, 'affiliation')), ...plainList(infobox(text, 'previous affiliation'))]
    const occupationTexts = ['occupation', 'previous occupation', 'position', 'previous position'].flatMap((f) =>
      plainList(infobox(text, f)),
    )
    const affiliations = matchRules(AFFILIATION_RULES, affiliationTexts)
    const powers = [...new Set(POWER_FIELDS.filter(([f]) => infobox(text, f)).map(([, label]) => label))]
    result.push(consistent({
      id,
      name: NAMES[name] ?? ruName(name, pages[name].ru, transliterate),
      nameEn: name,
      gender: SEX[infobox(text, 'gender').replace(/<.*$/s, '').trim()],
      races: races(text, affiliations, powers),
      affiliations,
      ranks: matchRules(RANK_RULES, occupationTexts),
      powers,
      division: division(text),
      ...arcFor(chapter),
      popularity: favorites[nameKey(name)] ?? 0,
      length: pages[name].length,
      ...OVERRIDES[name],
    }))
  })

  const unique = [...new Map(result.map((c) => [c.id, c])).values()]
  result.length = 0
  result.push(...unique)
  result.sort((a, b) => b.popularity - a.popularity || b.length - a.length)
  let picked = 0
  for (const c of result) {
    c.answer = picked < ANSWER_POOL_SIZE && c.affiliations.length + c.ranks.length + c.powers.length > 0
    if (c.answer) picked++
    delete c.popularity
    delete c.length
  }
  const kept = keepNotable(result, KEEP)
  result.length = 0
  result.push(...kept)
  dropDeleted(result, 'bleach')
  onlyAnswers(result)
  result.sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  await writeAtlas(result, THUMBS, path.join(OUT_IMG, 'thumbs.webp'), OUT_ATLAS, 20, 96)
  await pruneImages(path.join(OUT_IMG, 'full'), result)
  await fs.writeFile(OUT_JSON, JSON.stringify(result, null, 1))
  console.log(`wrote ${result.length} characters (${result.filter((c) => c.answer).length} answerable)`)
}

main()
