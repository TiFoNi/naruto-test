import fs from 'node:fs/promises'
import path from 'node:path'
import { PUBLIC, ROOT, cachedDownload, cachedJson, getJson, pool, pruneImages, wikiQuery, writeAtlas, writeFullAndThumb } from './lib.mjs'
import { dropDeleted } from './dropped.mjs'

const API = 'https://gameofthrones.fandom.com/api.php'
const CACHE = path.join(ROOT, '.cache', 'got')
const THUMBS = path.join(CACHE, 'thumb')
const OUT_IMG = path.join(PUBLIC, 'got')
const OUT_JSON = path.join(ROOT, 'packages', 'game', 'data', 'got.json')
const OUT_ATLAS = path.join(ROOT, 'packages', 'game', 'data', 'got-atlas.json')
const MIN_EPISODES = 5

const M = 'Мужской'
const F = 'Женский'
const NO_HOUSE = 'Без дома'

const EXCLUDE = new Set(["Night's Watch officer", 'High Septon (Tommen)', 'Bernadette', 'Boake', 'Aberdolf Strongbeard', 'Arys Oakheart', 'Boros Blount', 'Malakho', 'Alys Karstark', 'Wolkan', 'Lothar Frey', 'Walder Rivers', 'Biter', 'Rorge', 'Qhono', 'Kovarro'])

const FEMALE = new Set([
  'Daenerys Targaryen', 'Cersei Lannister', 'Sansa Stark', 'Arya Stark', 'Brienne of Tarth', 'Missandei', 'Melisandre', 'Gilly',
  'Catelyn Stark', 'Margaery Tyrell', 'Shae', 'Olenna Tyrell', 'Ygritte', 'Yara Greyjoy', 'Osha', 'Meera Reed', 'Myrcella Baratheon',
  'Ros', 'Irri', 'Ellaria Sand', 'Selyse Baratheon', 'Doreah', 'Talisa Stark', 'Waif', 'Shireen Baratheon', 'Lyanna Mormont',
  'Tyene Sand', 'Myranda', 'Marei', 'Obara Sand', 'Nymeria Sand', 'Unella', 'Mordane', 'Lysa Arryn', 'Walda Bolton',
  'Leaf', 'Lyanna Stark',
])

const NAMES = {
  'Daenerys Targaryen': 'Дейенерис Таргариен',
  'High Sparrow': 'Его Воробейшество',
  'Brynden Rivers': 'Трёхглазый ворон',
  Aemon: 'Мейстер Эймон',
  Luwin: 'Мейстер Лювин',
  'Viserys Targaryen (son of Aerys II)': 'Визерис Таргариен',
}

const EN_NAMES = { 'Viserys Targaryen (son of Aerys II)': 'Viserys Targaryen', 'Brynden Rivers': 'Three-eyed Raven' }

const ALIASES = {
  'Petyr Baelish': 'мизинец littlefinger',
  'Sandor Clegane': 'пёс пес hound',
  'Gregor Clegane': 'гора mountain',
  Varys: 'паук spider',
  'Brynden Rivers': 'бринден риверс brynden rivers',
  'High Sparrow': 'верховный воробей',
  'Tyrion Lannister': 'бес imp',
  'Jaqen H\'ghar': 'якен хгар',
}

const HOUSES = {
  Lannister: 'Ланнистер',
  Targaryen: 'Таргариен',
  Stark: 'Старк',
  Mormont: 'Мормонт',
  Tarly: 'Тарли',
  Greyjoy: 'Грейджой',
  Seaworth: 'Сиворт',
  Tarth: 'Тарт',
  Baelish: 'Бейлиш',
  Clegane: 'Клиган',
  Payne: 'Пейн',
  Tollett: 'Толлетт',
  Tully: 'Талли',
  Tyrell: 'Тирелл',
  Selmy: 'Селми',
  Baratheon: 'Баратеон',
  "Baratheon of King's Landing": 'Баратеон',
  'Baratheon of Dragonstone': 'Баратеон',
  Bolton: 'Болтон',
  Thorne: 'Торн',
  Trant: 'Трант',
  Redwyne: 'Редвин',
  Reed: 'Рид',
  Cassel: 'Кассель',
  Slynt: 'Слинт',
  Dondarrion: 'Дондаррион',
  Yarwyck: 'Ярвик',
  Royce: 'Ройс',
  Florent: 'Флорент',
  Maegyr: 'Мейгир',
  Marsh: 'Марш',
  Arryn: 'Аррен',
  Loraq: 'Лорак',
  Blount: 'Блаунт',
  Frey: 'Фрей',
  Karstark: 'Карстарк',
  Hollard: 'Холлард',
  Glover: 'Гловер',
  Martell: 'Мартелл',
}

const HOUSE_FIX = {
  'Jon Snow': ['Старк', 'Таргариен'],
  'Catelyn Stark': ['Талли', 'Старк'],
  'Selyse Baratheon': ['Флорент', 'Баратеон'],
  'Olenna Tyrell': ['Редвин', 'Тирелл'],
  'Talisa Stark': ['Мейгир', 'Старк'],
  'Lysa Arryn': ['Талли', 'Аррен'],
  'Walda Bolton': ['Фрей', 'Болтон'],
  'Cersei Lannister': ['Ланнистер', 'Баратеон'],
  'Margaery Tyrell': ['Тирелл', 'Баратеон'],
}

const CULTURES = {
  Northmen: 'Северяне',
  Westermen: 'Жители Запада',
  'Free Folk': 'Вольный народ',
  Valyrians: 'Валирийцы',
  Dothraki: 'Дотракийцы',
  'Men of the Reach': 'Жители Простора',
  Ironborn: 'Железнорождённые',
  Lyseni: 'Лиссенийцы',
  'Crownlands men': 'Жители Королевских земель',
  Stormlanders: 'Жители Штормовых земель',
  Valemen: 'Жители Долины',
  Naathi: 'Наатийцы',
  Westerosi: 'Вестеросцы',
  'Summer Islander': 'Летнийцы',
  'Summer Islanders': 'Летнийцы',
  "Asshai'i": 'Асшайцы',
  Tyroshi: 'Тирошийцы',
  Lorathi: 'Лоратийцы',
  Rivermen: 'Речные люди',
  Crannogmen: 'Болотные люди',
  Dornishmen: 'Дорнийцы',
  Volantenes: 'Волантийцы',
  Braavosi: 'Браавосцы',
  'First Men': 'Первые люди',
  'White Walkers': 'Белые Ходоки',
  Myrmen: 'Мирийцы',
  Meereenese: 'Миэринцы',
  YiTish: 'Йи-тийцы',
  Norvoshi: 'Норвошийцы',
  Qartheen: 'Квартийцы',
  'Children of the Forest': 'Дети Леса',
  Giants: 'Великаны',
}

const CULTURE_FIX = { Rast: ['Вестеросцы'] }
const WESTEROSI = 'Вестеросцы'
const REGIONS = new Set(['Северяне', 'Жители Королевских земель', 'Жители Запада', 'Речные люди', 'Жители Штормовых земель', 'Жители Простора', 'Дорнийцы', 'Железнорождённые', 'Жители Долины', 'Болотные люди'])
const withWesterosi = (list) => (list.some((one) => REGIONS.has(one)) && !list.includes(WESTEROSI) ? [...list, WESTEROSI] : list)
const ALIVE_FIX = new Set(['Jon Snow'])

const clean = (value) =>
  (value ?? '')
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>|<ref[^>]*\/>/g, '')
    .replace(/\{\{C\|[^}]*\}\}/gi, '')
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/'''?/g, '')
    .split(/<br\s*\/?>/i)
    .map((part) => part.trim())
    .filter(Boolean)

const field = (box, name) => box.match(new RegExp(`\\|\\s*${name}\\s*=([^\\n]*)`))?.[1] ?? ''

const stripParens = (text) => text.replace(/\s*\([^)]*\)\s*$/, '').trim()

async function listCharacters() {
  const titles = []
  let cont = ''
  do {
    const res = await getJson(`${API}?action=query&format=json&list=categorymembers&cmtitle=Category:Individuals_appearing_in_Game_of_Thrones&cmlimit=500&cmprop=title${cont}`)
    titles.push(...res.query.categorymembers.map((member) => member.title))
    cont = res.continue?.cmcontinue ? `&cmcontinue=${encodeURIComponent(res.continue.cmcontinue)}` : ''
  } while (cont)
  return titles
}

async function main() {
  await fs.mkdir(path.join(CACHE, 'img'), { recursive: true })
  await fs.mkdir(THUMBS, { recursive: true })
  await fs.mkdir(path.join(OUT_IMG, 'full'), { recursive: true })

  const titles = await cachedJson(CACHE, 'titles.json', listCharacters)
  const pages = await cachedJson(CACHE, 'pages.json', async () => {
    const res = await wikiQuery(API, titles, 'prop=revisions|langlinks&lllang=ru&lllimit=500&rvprop=content&rvslots=main')
    return Object.fromEntries(
      Object.entries(res).map(([title, page]) => [
        title,
        { id: page.pageid ?? null, text: page.revisions?.[0]?.slots?.main?.['*'] ?? '', ru: page.langlinks?.[0]?.['*'] ?? null },
      ]),
    )
  })

  const picked = titles.filter((title) => {
    if (EXCLUDE.has(title)) return false
    const text = pages[title]?.text ?? ''
    const at = text.search(/\{\{Character/i)
    if (at < 0) return false
    const episodes = Number(field(text.slice(at, at + 4000), 'Appearances').match(/(\d+)\s*episode/)?.[1] ?? 0)
    return episodes >= MIN_EPISODES
  })

  const images = await cachedJson(CACHE, 'images.json', async () => {
    const res = await wikiQuery(API, picked, 'prop=pageimages&piprop=original')
    return Object.fromEntries(Object.entries(res).map(([title, page]) => [title, page.original?.source ?? null]))
  })

  const result = []
  await pool(picked, 6, async (title) => {
    const page = pages[title]
    const text = page.text
    const box = text.slice(text.search(/\{\{Character/i), text.search(/\{\{Character/i) + 4000)
    if (!images[title]) return console.warn('немає картинки', title)
    const buf = await cachedDownload(path.join(CACHE, 'img'), String(page.id), [images[title]])
    if (!buf) return console.warn('не завантажилась картинка', title)
    await writeFullAndThumb(buf, path.join(OUT_IMG, 'full', `${page.id}.webp`), path.join(THUMBS, `${page.id}.webp`), 96)

    const houses = clean(field(box, 'House')).map((house) => HOUSES[house.replace(/^House /, '')]).filter(Boolean)
    const cultures = clean(field(box, 'Culture')).map((culture) => CULTURES[culture]).filter(Boolean)
    const unknown = clean(field(box, 'Culture')).filter((culture) => !CULTURES[culture])
    if (unknown.length) console.warn('невідома культура', title, unknown.join(', '))
    const name = NAMES[title] ?? stripParens(page.ru ?? title)
    const nameEn = EN_NAMES[title] ?? title

    result.push({
      id: page.id,
      name,
      nameEn,
      aliases: [nameEn.toLowerCase(), ALIASES[title]].filter(Boolean).join(' '),
      gender: FEMALE.has(title) ? F : M,
      houses: HOUSE_FIX[title] ?? (houses.length ? [houses[0]] : [NO_HOUSE]),
      cultures: withWesterosi(CULTURE_FIX[title] ?? [...new Set(cultures)]),
      status: ALIVE_FIX.has(title) || !clean(field(box, 'Death')).length ? 'Жив' : 'Мёртв',
      season: Number(field(box, 'Season').match(/Season (\d)/)?.[1] ?? 0),
      answer: true,
    })
  })

  dropDeleted(result, 'got')
  result.sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  await writeAtlas(result, THUMBS, path.join(OUT_IMG, 'thumbs.webp'), OUT_ATLAS, 12, 96)
  await pruneImages(path.join(OUT_IMG, 'full'), result)
  await fs.writeFile(OUT_JSON, JSON.stringify(result, null, 1))
  console.log(`wrote ${result.length} characters`)
}

main()
