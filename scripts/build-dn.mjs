import fs from 'node:fs/promises'
import path from 'node:path'
import {
  ROOT,
  cachedDownload,
  cachedJson,
  categoryMembers,
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

const API = 'https://deathnote.fandom.com/api.php'
const CACHE = path.join(ROOT, '.cache', 'dn')
const THUMBS = path.join(CACHE, 'thumb')
const OUT_IMG = path.join(ROOT, 'public', 'dn')
const OUT_JSON = path.join(ROOT, 'src', 'data', 'dn.json')
const OUT_ATLAS = path.join(ROOT, 'src', 'data', 'dn-atlas.json')
const ANSWER_POOL_SIZE = 26
const KEEP = 40

const ARCS = [
  [1, 'Знакомство'],
  [21, 'Второй Кира'],
  [32, 'Ёцуба'],
  [59, 'Наследники L'],
  [85, 'Такада и Мелло'],
  [100, 'Финал'],
]

const WORDS = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
}

const ORGS = [
  ['Опергруппа', /^Category:Japanese Task Force$/],
  ['SPK', /^Category:SPK$/],
  ['Мафия', /^Category:Mafia$/],
  ['ФБР', /^Category:FBI$/],
  ['Кира', /^Category:Kira$/],
  ['Дом Вамми', /^Category:Wammy's House$/],
]

const KEEP_ONLY = new Set([
  'Light Yagami',
  'L (character)',
  'Near',
  'Mello',
  'Matt',
  'Misa Amane',
  'Ryuk',
  'Rem',
  'Sidoh',
  'Gelus',
  'Armonia Justin Beyondormason',
  'Watari',
  'Soichiro Yagami',
  'Sachiko Yagami',
  'Sayu Yagami',
  'Touta Matsuda',
  'Shuichi Aizawa',
  'Kanzo Mogi',
  'Hideki Ide',
  'Hirokazu Ukita',
  'Naomi Misora',
  'Raye Penber',
  'Kiyomi Takada',
  'Teru Mikami',
  'Kyosuke Higuchi',
  'Reiji Namikawa',
  'Shingo Mido',
  'Aiber',
  'Wedy',
  'Rod Ross',
  'Halle Lidner',
  'Stephen Gevanni',
  'Anthony Rester',
  'Hitoshi Demegawa',
  'Lind L. Tailor',
])

const NAMES = {
  'John McEnroe': 'Джон Макинрой',
  'Zakk Irius': 'Закк Ириус',
  'George Sairas': 'Джордж Сайрас',
  'Koreyoshi Kitamura': 'Корэёси Китамура',
  'Takuo Shibuimaru': 'Такуо Сибуимару',
  'Kurou Otoharada': 'Куро Отохарада',
  'Lind L. Tailor': 'Линд Л. Тейлор',
  Sidoh: 'Сидо',
  'Halle Lidner': 'Халле Лиднер',
  'Light Yagami': 'Лайт Ягами',
  'L (character)': 'L',
  Near: 'Ниа',
  Mello: 'Мелло',
  'Misa Amane': 'Миса Аманэ',
  Ryuk: 'Рюк',
  Rem: 'Рем',
  'Teru Mikami': 'Теру Миками',
  'Kiyomi Takada': 'Киёми Такада',
  'Soichiro Yagami': 'Соитиро Ягами',
  'Sachiko Yagami': 'Сатико Ягами',
  'Sayu Yagami': 'Саю Ягами',
  Watari: 'Ватари',
  'Touta Matsuda': 'Тота Мацуда',
  'Shuichi Aizawa': 'Сюити Айдзава',
  'Kanzo Mogi': 'Кандзо Моги',
  'Hideki Ide': 'Хидэки Идэ',
  'Hirokazu Ukita': 'Хирокадзу Укита',
  'Naomi Misora': 'Наоми Мисора',
  'Raye Penber': 'Рэй Пенбер',
  'Kyosuke Higuchi': 'Кёскэ Хигути',
  'Reiji Namikawa': 'Рэйдзи Намикава',
  'Shingo Mido': 'Синго Мидо',
  'Suguru Shimura': 'Сугуру Симура',
  'Takeshi Ooi': 'Такэси Ои',
  'Masahiko Kida': 'Масахико Кида',
  'Eiichi Takahashi': 'Эйити Такахаси',
  'Arayoshi Hatori': 'Араёси Хатори',
  'Halle Lidner': 'Халле Линднер',
  'Anthony Rester': 'Энтони Рестер',
  'Stephen Gevanni': 'Стивен Джеванни',
  'Aiber': 'Айбер',
  'Wedy': 'Уэди',
  'Sidoh': 'Сидо',
  'Gelus': 'Джелус',
  'Jealous': 'Джелус',
  'Shidoh': 'Сидо',
  'Armonia Justin Beyondormason': 'Армония Джастин',
  'Daril Ghiroza': 'Дарил Гироза',
  'Midora': 'Мидора',
  'Nu': 'Ну',
  'Zellogi': 'Зеллоджи',
  'Calikarcha': 'Каликарча',
  'Deridovely': 'Деридовели',
  'Kinddara Guivelostain': 'Киндара Гивелостайн',
  'The Shinigami King': 'Король синигами',
  'Beyond Birthday': 'Бейонд Бёздэй',
  'Kiichiro Osoreda': 'Киитиро Осорэда',
  'Demegawa': 'Дэмэгава',
  'Hitoshi Demegawa': 'Хитоси Дэмэгава',
  'Roger Ruvie': 'Роджер Руви',
  'Matt': 'Мэтт',
  'Linda': 'Линда',
  'Shuichi Aizawa (film)': 'Сюити Айдзава',
  'Ill Ratt': 'Илл Ратт',
  'Rod Ross': 'Род Росс',
  'Jack Neylon': 'Джек Нейлон',
  'Kal Snydar': 'Кэл Снайдар',
  'David Hoope': 'Дэвид Хуп',
  'Sakura TV': 'Сакура ТВ',
  'Kiyotaka Hirata': 'Киётака Хирата',
  'Kanichi Takimura': 'Каннити Такимура',
  'Shoko Maki': 'Сёко Маки',
  'Yuri': 'Юри',
  'Yotsuba Group': 'Группа Ёцуба',
}

const matchRules = (rules, values) => rules.filter(([, re]) => values.some((v) => re.test(v))).map(([label]) => label)

function field(text, name) {
  const start = text.match(new RegExp(`\\|\\s*${name}\\s*=`, 'i'))
  if (!start) return ''
  const from = start.index + start[0].length
  const rest = text.slice(from)
  const end = rest.search(/\n\s*\|/)
  return (end === -1 ? rest : rest.slice(0, end)).trim()
}

function debutChapter(text) {
  const raw = field(text, 'manga')
  const digits = raw.match(/Chapter (\d+)/i)
  if (digits) return Number(digits[1])
  const word = raw.match(/Chapter ([A-Za-z]+)/i)
  return word ? (WORDS[word[1].toLowerCase()] ?? null) : null
}

const arcIndexOf = (chapter) => ARCS.reduce((idx, [start], i) => (chapter >= start ? i : idx), 0)

function galleryFiles(text) {
  const gallery = text.match(/<gallery>([\s\S]*?)<\/gallery>/)
  if (!gallery) return []
  const lines = gallery[1]
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => ({ file: l.split('|')[0].trim(), label: (l.split('|')[1] ?? '').trim() }))
  const anime = lines.find((l) => /anime/i.test(l.label))
  const manga = lines.find((l) => /manga|illustration/i.test(l.label))
  return [anime?.file, manga?.file, lines[0]?.file].filter(Boolean)
}

async function main() {
  await fs.mkdir(path.join(CACHE, 'img'), { recursive: true })
  await fs.mkdir(THUMBS, { recursive: true })
  await fs.mkdir(path.join(OUT_IMG, 'full'), { recursive: true })

  const names = await cachedJson(CACHE, 'members.json', () => categoryMembers(API, 'Manga characters'))
  const pages = await cachedJson(CACHE, 'pages.json', () => wikiPages(API, names))
  const candidates = names.filter((n) => KEEP_ONLY.has(n) && pages[n]?.text && /\{\{(Humans?|Shinigami)\b/i.test(pages[n].text) && debutChapter(pages[n].text) !== null)
  const categories = await cachedJson(CACHE, 'categories.json', async () => {
    const res = await wikiQuery(API, candidates, 'prop=categories&cllimit=500')
    return Object.fromEntries(Object.entries(res).map(([t, p]) => [t, (p.categories ?? []).map((c) => c.title)]))
  })
  const wanted = Object.fromEntries(candidates.map((n) => [n, galleryFiles(pages[n].text)]))
  const fileUrls = await cachedJson(CACHE, 'files.json', () => wikiImageUrls(API, [...new Set(Object.values(wanted).flat())]))

  const result = []
  await pool(candidates, 8, async (name) => {
    const { id, text, ru, length } = pages[name]
    const sources = wanted[name].map((f) => fileUrls[f]).filter(Boolean)
    const buf = await cachedDownload(path.join(CACHE, 'img'), String(id), sources)
    if (!buf) return console.warn('no image', name)
    try {
      await writeFullAndThumb(buf, path.join(OUT_IMG, 'full', `${id}.webp`), path.join(THUMBS, `${id}.webp`), 96)
    } catch (e) {
      return console.warn('image failed', name, e.message)
    }
    const cats = categories[name] ?? []
    const chapter = debutChapter(text)
    const arcIndex = arcIndexOf(chapter)
    const shinigami = /\{\{Shinigami\b/i.test(text) || cats.includes('Category:Shinigami')
    const clean = name.replace(/\s*\((character|film|shinigami)\)$/i, '')
    result.push({
      id,
      name: NAMES[name] ?? ruName(clean, ru, transliterate),
      nameEn: clean,
      gender: cats.includes('Category:Female characters') ? 'Женский' : cats.includes('Category:Male characters') ? 'Мужской' : 'Другое',
      species: shinigami ? 'Синигами' : 'Человек',
      orgs: matchRules(ORGS, cats).length ? matchRules(ORGS, cats) : ['Вне организаций'],
      note: shinigami || cats.includes('Category:Human Death Note users') || plain(field(text, 'owned')).trim() ? 'Владел' : 'Не владел',
      eyes: shinigami || cats.includes('Category:Humans with Shinigami Eyes') ? 'Есть' : 'Нет',
      status: cats.includes('Category:Deceased') || plain(field(text, 'death')).trim() ? 'Мёртв' : 'Жив',
      arc: ARCS[arcIndex][1],
      arcIndex,
      length,
    })
  })

  result.sort((a, b) => b.length - a.length)
  let picked = 0
  for (const c of result) {
    c.answer = picked < ANSWER_POOL_SIZE
    if (c.answer) picked++
    delete c.length
  }
  const kept = keepNotable(result, KEEP)
  result.length = 0
  result.push(...kept)
  result.sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  await writeAtlas(result, THUMBS, path.join(OUT_IMG, 'thumbs.webp'), OUT_ATLAS, 10, 96)
  await pruneImages(path.join(OUT_IMG, 'full'), result)
  await fs.writeFile(OUT_JSON, JSON.stringify(result, null, 1))
  console.log(`wrote ${result.length} characters (${result.filter((c) => c.answer).length} answerable)`)
}

main()
