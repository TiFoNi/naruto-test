import fs from 'node:fs/promises'
import path from 'node:path'
import {
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

const API = 'https://berserk.fandom.com/api.php'
const CACHE = path.join(ROOT, '.cache', 'berserk')
const THUMBS = path.join(CACHE, 'thumb')
const OUT_IMG = path.join(ROOT, 'public', 'berserk')
const OUT_JSON = path.join(ROOT, 'src', 'data', 'berserk.json')
const OUT_ATLAS = path.join(ROOT, 'src', 'data', 'berserk-atlas.json')
const ANSWER_POOL_SIZE = 55
const KEEP = 85
const EXCLUDE = new Set(['Miscellaneous Characters', "Mozgus' Disciples", 'Elves of Misty Valley'])

const ARC_CATEGORIES = [
  ['Black Swordsman Arc Characters', 'Чёрный мечник'],
  ['Golden Age Arc Characters', 'Золотой век'],
  ['Conviction Arc Characters', 'Осуждение'],
  ['Millennium Falcon Arc Characters', 'Сокол тысячелетия'],
  ['Fantasia Arc Characters', 'Фантазия'],
]
const ARC_STARTS = [0, 1, 95, 178, 308]

const SEX = { Male: 'Мужской', Female: 'Женский' }
const OTHER_SEX = 'Другое'

const KIND_RULES = [
  ['Человек', /^human/i],
  ['Апостол', /^apostle/i],
  ['Псевдоапостол', /pseudo-apostle/i],
  ['Демон', /^demon|^god hand/i],
  ['Эльф', /elf/i],
  ['Нежить', /skeletal|undead/i],
  ['Сущность', /manifestation|idea/i],
]

const AFFILIATION_RULES = [
  ['Отряд Ястреба', /band of the falcon/i],
  ['Отряд Чёрного мечника', /black swordsman party/i],
  ['Длань Господа', /god hand/i],
  ['Мидленд', /midland|white dragon|black dog|toumel/i],
  ['Святой Престол', /holy see|holy iron chain|mozgus|heretic/i],
  ['Семья Вандимион', /vandimion/i],
  ['Маги', /mage|skellig|flora/i],
  ['Тюдор', /tudor|blue whale|purple rhino/i],
  ['Кушан', /kushan/i],
  ['Фалькония', /falconia/i],
  ['Девушки Луки', /luca/i],
  ['Наёмники', /mercenary/i],
  ['Граф', /\bcount\b/i],
]

const OCCUPATION_RULES = [
  ['Наёмник', /mercenar/i],
  ['Рыцарь', /knight/i],
  ['Маг', /mage|witch|sorcer/i],
  ['Знать', /noble|\bcount\b|king|queen|prince|duke|lord|emperor|conqueror|royal/i],
  ['Военный', /general|commander|soldier|captain|guard|military/i],
  ['Простолюдин', /innworker|innkeeper|servant|citizen|civilian|miner|blacksmith|shop|guide|herald/i],
  ['Артист', /performer|circus|tumbler/i],
  ['Проститутка', /prostitute/i],
  ['Убийца', /assassin/i],
  ['Бандит', /bandit|pirate/i],
  ['Культист', /cult/i],
  ['Врач', /physician/i],
]

const STATUS_RULES = [
  ['Жив', /^alive|existent|undead/i],
  ['Мёртв', /^deceased/i],
]

const KIND_OVERRIDES = {
  'Demon Child': ['Сущность'],
  'Beast of Darkness': ['Сущность'],
  'Sea God': ['Сущность'],
  'Idea of Evil': ['Сущность'],
  Incubus: ['Демон'],
  "Isma's Mother": ['Мерроу'],
}

function kindTargets(raw) {
  if (!raw) return []
  const lines = raw
    .replace(/\{\{Plainlist\|?/gi, '')
    .split(/\n|<br\s*\/?>/i)
    .map((l) => l.replace(/^\s*\*+\s*/, '').trim())
    .filter((l) => l && l !== '}}')
  const parsed = lines.map((line) => ({
    former: /formerly/i.test(line),
    target: line.match(/\[\[([^\]|#]+)/)?.[1]?.trim() ?? stripParens(line.replace(/\{\{[^}]*\}\}|<[^>]+>/g, '')),
  }))
  const current = parsed.filter((p) => !p.former)
  return (current.length ? current : parsed.slice(-1)).map((p) => p.target)
}

const NAMES = {
  Zodd: 'Зодд',
  Wyald: 'Вайальд',
  Adon: 'Адон',
  Farnese: 'Фарнеза',
  'Falcon of Light': 'Сокол Света',
}

const matchRules = (rules, texts) => rules.filter(([, re]) => texts.some((t) => re.test(t))).map(([label]) => label)

const cleanList = (value, dropFormer = false) => {
  const items = plainList(value)
  const current = dropFormer ? items.filter((v) => !/formerly/i.test(v)) : items
  return (current.length ? current : items.slice(-1))
    .map((v) => stripParens(v.replace(/\{\{Plainlist\|?/gi, '').replace(/\|image\d*=.*$/i, '')))
    .filter((v) => v && v.length <= 60 && !v.includes('=='))
}

function episodeIndex(text) {
  const raw = infobox(text, 'first') ?? ''
  const m = raw.match(/\{\{\s*ep?\s*\|\s*e?(0-\d+|\d+)/i)
  if (!m) return null
  return m[1].startsWith('0-') ? 0 : Number(m[1])
}

async function main() {
  await fs.mkdir(path.join(CACHE, 'img'), { recursive: true })
  await fs.mkdir(THUMBS, { recursive: true })
  await fs.mkdir(path.join(OUT_IMG, 'full'), { recursive: true })

  const byArc = await cachedJson(CACHE, 'arcs.json', async () =>
    Object.fromEntries(await Promise.all(ARC_CATEGORIES.map(async ([cat]) => [cat, await categoryMembers(API, cat)]))),
  )
  const names = [...new Set(Object.values(byArc).flat())].filter((n) => !EXCLUDE.has(n))
  const pages = await cachedJson(CACHE, 'pages.json', () => wikiPages(API, names))

  function arcIndex(name) {
    const episode = episodeIndex(pages[name].text)
    if (episode !== null) return ARC_STARTS.reduce((idx, start, i) => (episode >= start ? i : idx), 0)
    const fromCategory = ARC_CATEGORIES.findIndex(([cat]) => byArc[cat].includes(name))
    return fromCategory >= 0 ? fromCategory : null
  }

  const candidates = names.filter((n) => pages[n]?.text && arcIndex(n) !== null)
  const images = await cachedJson(CACHE, 'images.json', async () => {
    const res = await wikiQuery(API, candidates, 'prop=pageimages&piprop=original')
    return Object.fromEntries(Object.entries(res).map(([t, p]) => [t, p.original?.source ?? null]))
  })

  const result = []
  await pool(candidates, 10, async (name) => {
    const { id, text, ru, length } = pages[name]
    const buf = await cachedDownload(path.join(CACHE, 'img'), String(id), [images[name]])
    if (!buf) return console.warn('no image', name)
    try {
      await writeFullAndThumb(buf, path.join(OUT_IMG, 'full', `${id}.webp`), path.join(THUMBS, `${id}.webp`), 96)
    } catch (e) {
      return console.warn('image failed', name, e.message)
    }
    const field = (f) => cleanList(infobox(text, f))
    const kindList = matchRules(KIND_RULES, kindTargets(infobox(text, 'kind')))
    const kinds = KIND_OVERRIDES[name] ?? (kindList.length ? kindList : ['Человек'])
    const index = arcIndex(name)
    result.push({
      id,
      name: NAMES[name] ?? ruName(name, ru, transliterate),
      nameEn: name,
      gender: SEX[field('gender')[0]] ?? OTHER_SEX,
      kinds,
      affiliations: matchRules(AFFILIATION_RULES, field('affiliations')),
      occupations: matchRules(OCCUPATION_RULES, [...field('occupations'), ...field('ranks')]),
      status: matchRules(STATUS_RULES, field('status'))[0] ?? 'Неизвестно',
      arc: ARC_CATEGORIES[index][1],
      arcIndex: index,
      length,
    })
  })

  result.sort((a, b) => b.length - a.length)
  let picked = 0
  for (const c of result) {
    c.answer = picked < ANSWER_POOL_SIZE && c.kinds.length > 0
    if (c.answer) picked++
    delete c.length
  }
  const kept = keepNotable(result, KEEP)
  result.length = 0
  result.push(...kept)
  dropDeleted(result, 'berserk')
  onlyAnswers(result)
  result.sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  await writeAtlas(result, THUMBS, path.join(OUT_IMG, 'thumbs.webp'), OUT_ATLAS, 12, 96)
  await pruneImages(path.join(OUT_IMG, 'full'), result)
  await fs.writeFile(OUT_JSON, JSON.stringify(result, null, 1))
  console.log(`wrote ${result.length} characters (${result.filter((c) => c.answer).length} answerable)`)
}

main()
