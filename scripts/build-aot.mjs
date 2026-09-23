import fs from 'node:fs/promises'
import path from 'node:path'
import {
  ROOT,
  cachedDownload,
  cachedJson,
  categoryMembers,
  infobox,
  plain,
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
import { dropDeleted } from './dropped.mjs'

const API = 'https://attackontitan.fandom.com/api.php'
const CACHE = path.join(ROOT, '.cache', 'aot')
const THUMBS = path.join(CACHE, 'thumb')
const OUT_IMG = path.join(ROOT, 'public', 'aot')
const OUT_JSON = path.join(ROOT, 'src', 'data', 'aot.json')
const OUT_ATLAS = path.join(ROOT, 'src', 'data', 'aot-atlas.json')
const EXTRA_NAMES = ['Hange Zoë']
const EXCLUDE = new Set(['Ackerman', 'Yeager', 'Leonhart'])
const NAMES = { 'Lara Tybur': 'Лара Тайбер', 'Artur Blouse': 'Артур Браус' }
const KEEP = 100

const ANSWER_POOL = [
  'Eren Yeager', 'Mikasa Ackerman', 'Armin Arlert', 'Levi Ackerman', 'Hange Zoë', 'Erwin Smith', 'Jean Kirstein',
  'Connie Springer', 'Sasha Blouse', 'Historia Reiss', 'Ymir', 'Reiner Braun', 'Bertolt Hoover', 'Annie Leonhart',
  'Zeke Yeager', 'Pieck Finger', 'Porco Galliard', 'Marcel Galliard', 'Falco Grice', 'Colt Grice', 'Gabi Braun', 'Udo',
  'Zofia', 'Grisha Yeager', 'Carla Yeager', 'Dina Fritz', 'Eren Kruger', 'Kenny Ackerman', 'Rod Reiss', 'Frieda Reiss',
  'Uri Reiss', 'Ymir Fritz', 'Karl Fritz', 'Willy Tybur', 'Lara Tybur', 'Theo Magath', 'Onyankopon', 'Yelena',
  'Floch Forster', 'Hannes', 'Keith Shadis', 'Dot Pixis', 'Nile Dok', 'Darius Zackly', 'Petra Ral', 'Oluo Bozado',
  'Eld Jinn', 'Gunther Schultz', 'Mike Zacharias', 'Moblit Berner', 'Marco Bott', 'Thomas Wagner', 'Mina Carolina',
  'Hitch Dreyse', 'Marlowe Freudenberg', 'Rico Brzenska', 'Kiyomi Azumabito', 'Niccolo', 'Louise',
  'Nanaba', 'Kaya', 'Karina Braun', 'Ian Dietrich', 'Dimo Reeves',
  'Flegel Reeves', 'Djel Sannes', 'Kuchel Ackerman', 'Faye Yeager', 'Nifa', 'Gross',
]

const SEX = { Male: 'Мужской', Female: 'Женский' }
const OTHER_SEX = 'Другое'

const ARCS = {
  'Prologue arc': 'Пролог',
  '104th Training Corps arc': 'Кадетский корпус',
  'Wall Sealing arc': 'Битва за Трост',
  'The Female Titan arc': 'Женская особь',
  'Clash of the Titans arc': 'Схватка титанов',
  'Royal Government arc': 'Восстание',
  'Return to Shiganshina arc': 'Возвращение в Шиганшину',
  'Marley arc': 'Марли',
  'War for Paradis arc': 'Война за Парадиз',
}
const ARC_ORDER = Object.keys(ARCS)

const SPECIES = {
  Human: 'Человек',
  'Intelligent Titan': 'Титан-оборотень',
  Titan: 'Чистый титан',
  Horse: 'Лошадь',
  Unknown: 'Неизвестно',
}

const AFFILIATION_RULES = [
  ['Разведкорпус', /survey corps|scout regiment|special operations squad|squad (mike|klaus|darius|levi|hange)|fourth squad|idol unit/i],
  ['Исследователи титанов', /titan biology/i],
  ['Гарнизон', /garrison/i],
  ['Военная полиция', /military police|interior squad|anti-personnel control/i],
  ['Кадетский корпус', /training corps/i],
  ['Знать', /nobility|reiss|fritz/i],
  ['Королевское правительство', /royal government/i],
  ['Армия Марли', /marley|panzer|public security/i],
  ['Воины Марли', /warrior unit|warrior candidate/i],
  ['Йегеристы', /yeagerist/i],
  ['Реставраторы Элдии', /restorationist/i],
  ['Антимарлийские добровольцы', /anti-marleyan/i],
  ['Культ Стен', /church of the walls|wall cult/i],
  ['Компания Ривза', /reeves/i],
  ['Хидзуру', /hizuru/i],
]

const OCCUPATIONS = {
  Soldier: 'Солдат',
  Warrior: 'Воин',
  Ambassador: 'Посол',
  Merchant: 'Торговец',
  King: 'Король',
  Queen: 'Королева',
  Housewife: 'Домохозяйка',
  Doctor: 'Врач',
  Journalist: 'Журналист',
  Hunter: 'Охотник',
  Teacher: 'Учитель',
  Waiter: 'Официант',
  Chef: 'Повар',
  Cook: 'Повар',
  Minister: 'Министр',
  Mayor: 'Мэр',
  Thug: 'Бандит',
  'Hired thug': 'Бандит',
  Pastor: 'Священник',
  Noble: 'Дворянин',
  Farmer: 'Фермер',
  Student: 'Ученик',
  Scientist: 'Учёный',
  Engineer: 'Инженер',
  Prostitute: 'Проститутка',
  Mount: 'Лошадь',
  Horse: 'Лошадь',
}

const TITANS = {
  Attack: 'Атакующий',
  Founding: 'Прародитель',
  Colossal: 'Колоссальный',
  Colossus: 'Колоссальный',
  Armored: 'Бронированный',
  Female: 'Женская особь',
  Beast: 'Звероподобный',
  Jaw: 'Челюсти',
  Cart: 'Перевозчик',
  'War Hammer': 'Молотобоец',
}

const STATUS = { Alive: 'Жив', Deceased: 'Мёртв', Unknown: 'Неизвестно' }

const matchRules = (rules, texts) => rules.filter(([, re]) => texts.some((t) => re.test(t))).map(([label]) => label)
const link = (value) => value?.match(/\[\[([^\]|#]+)/)?.[1]?.trim() ?? null

const YMIR_POWER = 'Сила Имир'
const YMIR_DAUGHTERS = new Set(['Maria Fritz', 'Rose Fritz', 'Sheena Fritz'])

function titans(name, text) {
  if (YMIR_DAUGHTERS.has(name)) return [YMIR_POWER]
  const found = [...text.matchAll(/\|\s*Title\s*=\s*([A-Za-z ]+?) Titans?\b/g)].map((m) => TITANS[m[1].trim()])
  return [...new Set(found.filter(Boolean))]
}

async function main() {
  await fs.mkdir(path.join(CACHE, 'img'), { recursive: true })
  await fs.mkdir(THUMBS, { recursive: true })
  await fs.mkdir(path.join(OUT_IMG, 'full'), { recursive: true })

  const names = await cachedJson(CACHE, 'names.json', async () => [
    ...new Set([...(await categoryMembers(API, 'Male')), ...(await categoryMembers(API, 'Female')), ...EXTRA_NAMES]),
  ])
  const pages = await cachedJson(CACHE, 'pages.json', () => wikiPages(API, names))
  const debutOf = (n) => link(infobox(pages[n]?.text, 'Debut chapter'))
  const chapters = await cachedJson(CACHE, 'chapters.json', () => wikiPages(API, [...new Set(names.map(debutOf).filter(Boolean))]))
  const arcOf = (n) => plain(infobox(chapters[debutOf(n)]?.text, 'Arc')).trim()

  const candidates = names.filter((n) => !EXCLUDE.has(n) && pages[n]?.text && ARCS[arcOf(n)])
  const animePage = (n) => pages[n].text.match(/\|\s*A\s*=\s*([^\n|}]+)/)?.[1]?.trim() || null
  const images = await cachedJson(CACHE, 'images.json', async () => {
    const titles = [...candidates, ...candidates.map(animePage).filter(Boolean)]
    const res = await wikiQuery(API, titles, 'prop=pageimages&piprop=original')
    const src = (t) => (t ? (res[t]?.original?.source ?? null) : null)
    return Object.fromEntries(candidates.map((n) => [n, [src(animePage(n)), src(n)].filter(Boolean)]))
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
    const arc = arcOf(name)
    const heldTitans = titans(name, text)
    const species = field('Species').flatMap((s) =>
      /formerly human/i.test(s) ? [SPECIES.Human, SPECIES[stripParens(s)]] : [SPECIES[stripParens(s)]],
    )
    if (heldTitans.length) species.push(SPECIES['Intelligent Titan'])
    const occupations = [...field('Occupation'), ...field('F. Occupation')].map((o) => OCCUPATIONS[stripParens(o)]).filter(Boolean)
    result.push({
      id,
      name: NAMES[name] ?? ruName(name, ru, transliterate),
      nameEn: name,
      gender: SEX[plain(infobox(text, 'Gender')).trim()] ?? OTHER_SEX,
      species: [...new Set(species.filter(Boolean))],
      affiliations: matchRules(AFFILIATION_RULES, [...field('Affiliation'), ...field('F. Affiliation')]),
      occupations: [...new Set(occupations)],
      titans: heldTitans,
      status: STATUS[plain(infobox(text, 'Status')).trim()] ?? STATUS.Unknown,
      arc: ARCS[arc],
      arcIndex: ARC_ORDER.indexOf(arc),
      answer: ANSWER_POOL.includes(name),
      length,
    })
  })

  const missing = ANSWER_POOL.filter((n) => !result.some((c) => c.nameEn === n))
  if (missing.length) console.warn('answer pool names not found:', missing.join(', '))
  result.sort((a, b) => b.length - a.length)
  result.forEach((c) => delete c.length)
  const kept = keepNotable(result, KEEP)
  result.length = 0
  result.push(...kept)
  dropDeleted(result, 'aot')
  result.sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  await writeAtlas(result, THUMBS, path.join(OUT_IMG, 'thumbs.webp'), OUT_ATLAS, 16, 96)
  await pruneImages(path.join(OUT_IMG, 'full'), result)
  await fs.writeFile(OUT_JSON, JSON.stringify(result, null, 1))
  console.log(`wrote ${result.length} characters (${result.filter((c) => c.answer).length} answerable)`)
}

main()
