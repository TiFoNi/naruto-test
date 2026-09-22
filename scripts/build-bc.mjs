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

const API = 'https://blackclover.fandom.com/api.php'
const CACHE = path.join(ROOT, '.cache', 'bc')
const THUMBS = path.join(CACHE, 'thumb')
const OUT_IMG = path.join(ROOT, 'public', 'bc')
const OUT_JSON = path.join(ROOT, 'src', 'data', 'bc.json')
const OUT_ATLAS = path.join(ROOT, 'src', 'data', 'bc-atlas.json')
const ANSWER_POOL_SIZE = 60
const KEEP = 80

const ARCS = [
  [1, 'Вступление в Рыцари'],
  [11, 'Подземелье'],
  [22, 'Штурм столицы'],
  [38, 'Око полуночного солнца'],
  [57, 'Подводный храм'],
  [75, 'Лес ведьм'],
  [102, 'Королевские рыцари'],
  [150, 'Перерождение эльфов'],
  [229, 'Королевство Сердца'],
  [261, 'Королевство Пик'],
  [332, 'Финал'],
]

const SEX = { Male: 'Мужской', Female: 'Женский' }

const SPECIES_RULES = [
  ['Дух', /spirit/i],
  ['Эльф', /elf/i],
  ['Дьявол', /devil/i],
  ['Гном', /dwarf/i],
  ['Человек', /human/i],
]

const SQUAD_RULES = [
  ['Чёрный Бык', /black bull/i],
  ['Золотой Рассвет', /golden dawn/i],
  ['Серебряные Орлы', /silver eagle/i],
  ['Багровые Львы', /crimson lion/i],
  ['Синяя Роза', /blue rose/i],
  ['Изумрудный Богомол', /green (praying )?mantis/i],
  ['Коралловые Павлины', /coral peacock/i],
  ['Бирюзовые Олени', /aqua deer/i],
  ['Пурпурные Косатки', /purple orca/i],
  ['Лазурные Олени', /azure deer/i],
  ['Глаз полуночного солнца', /midnight sun/i],
  ['Тёмная троица', /dark triad/i],
]

const COUNTRY_RULES = [
  ['Королевство Клевера', /clover kingdom/i],
  ['Королевство Пик', /spade kingdom/i],
  ['Королевство Бубен', /diamond kingdom/i],
  ['Королевство Сердца', /heart kingdom/i],
  ['Лес ведьм', /witches.? forest/i],
  ['Подземный мир', /underworld/i],
]

const STATUS_RULES = [
  ['Жив', /alive/i],
  ['Мёртв', /deceased|dead/i],
]

const ATTRIBUTE_RULES = [
  ['Антимагия', /anti magic/i],
  ['Огонь', /fire|flame/i],
  ['Вода', /water|sea dragon/i],
  ['Ветер', /wind|star magic/i],
  ['Земля', /earth|sand|stone|mud/i],
  ['Свет', /light/i],
  ['Тьма', /dark(ness)? magic|shadow/i],
  ['Молния', /lightning|thunder/i],
  ['Лёд', /ice|glacier/i],
  ['Растения', /plant|flower|vine|thorn/i],
  ['Кровь', /blood/i],
  ['Время', /time/i],
  ['Пространство', /spatial|space/i],
  ['Зеркала', /mirror/i],
  ['Оружие', /sword|spear|steel|weapon|bone|ash/i],
  ['Звери', /beast|wolf|bird|ant/i],
  ['Нити', /thread|string|steel thread/i],
  ['Деревья', /tree|wood|forest/i],
  ['Яд', /poison|venom|toxic/i],
  ['Превращение', /transformation|copy|imitation/i],
  ['Гравитация', /gravity|body magic/i],
  ['Сны', /dream/i],
  ['Звук', /sound|song|music/i],
  ['Пепел', /ash|smoke|dust/i],
  ['Стекло', /glass|crystal|mirror/i],
  ['Туман', /mist|fog|cloud/i],
  ['Хлопок', /cotton|wool/i],
  ['Слизь', /slime|mucus|gel/i],
  ['Бумага', /paper|ink|scroll/i],
  ['Проклятия', /curse|seal|magic drain/i],
  ['Исцеление', /heal|recovery|life magic/i],
]

const NAMES = {
  Asta: 'Аста',
  'Yuno Grinberryall': 'Юно Гринберриол',
  'Noelle Silva': 'Ноэль Сильва',
  'Yami Sukehiro': 'Ями Сукехиро',
  'Julius Novachrono': 'Юлиус Новакроно',
  'Magna Swing': 'Магна Суинг',
  'Luck Voltia': 'Лак Вольтиа',
  'Charmy Pappitson': 'Чарми Паппитсон',
  'Vanessa Enoteca': 'Ванесса Энотека',
  'Finral Roulacase': 'Финрал Рулакас',
  'Gauche Adlai': 'Гош Адлай',
  'Gordon Agrippa': 'Гордон Агриппа',
  'Grey (Black Bull)': 'Грей',
  'Henry Legolant': 'Генри Леголант',
  'Zora Ideale': 'Зора Идеале',
  'Nozel Silva': 'Нозель Сильва',
  'Fuegoleon Vermillion': 'Фуэголеон Вермиллион',
  'Mereoleona Vermillion': 'Мереолеона Вермиллион',
  'Charlotte Roselei': 'Шарлотта Розелей',
  'William Vangeance': 'Вильям Ванженс',
  'Langris Vaude': 'Лангрис Вауде',
  'Mimosa Vermillion': 'Мимоза Вермиллион',
  'Klaus Lunettes': 'Клаус Люнетт',
  'Sekke Bronzazza': 'Секке Бронзаза',
  'Rill Boismortier': 'Рилл Буамортье',
  'Kirsch Vermillion': 'Кирш Вермиллион',
  'Solid Silva': 'Солид Сильва',
  'Nebra Silva': 'Небра Сильва',
  'Patolli': 'Патри',
  'Licht': 'Лихт',
  'Lemiel Silvamillion Clover': 'Лемьель Сильвамиллион Кловер',
  'Zenon Zogratis': 'Зенон Зогратис',
  'Dante Zogratis': 'Данте Зогратис',
  'Vanica Zogratis': 'Ваника Зогратис',
  'Lucifero': 'Люциферо',
  'Liebe': 'Либе',
  'Nacht Faust': 'Нахт Фауст',
  'Secre Swallowtail': 'Секре Своллоутейл',
  'Marx Francois': 'Маркс Франсуа',
  'Lotus Whomalt': 'Лотус Уомальт',
  'Mars': 'Марс',
  'Fana': 'Фана',
  'Rhya': 'Рия',
  'Vetto': 'Ветто',
  'Rades Spirito': 'Радес Спирито',
  'Sally': 'Салли',
  'Valtos': 'Вальтос',
  'Kahono': 'Кахоно',
  'Kiato': 'Киато',
  'Gaja': 'Гаджа',
  'Lolopechka': 'Лолопечка',
  'Undine': 'Ундина',
  'Acier Silva': 'Асье Сильва',
  'Damnatio Kira': 'Дамнатио Кира',
  'Augustus Kira Clover XIII': 'Август Кира Кловер XIII',
  'Lily Aquaria': 'Лили Акуария',
  'Jack the Ripper': 'Джек Потрошитель',
  'Dorothy Unsworth': 'Дороти Ансворт',
  'Leopold Vermillion': 'Леопольд Вермиллион',
  'Lucius Zogratis': 'Люциус Зогратис',
}

const matchRules = (rules, text) => rules.filter(([, re]) => re.test(text)).map(([label]) => label)

function field(text, name) {
  const raw = infobox(text, name) ?? ''
  let depth = 0
  for (let i = 0; i < raw.length - 1; i++) {
    const pair = raw.slice(i, i + 2)
    if (pair === '{{') depth++, i++
    else if (pair === '}}') {
      if (depth === 0) return raw.slice(0, i)
      depth--, i++
    }
  }
  return raw
}

function debutChapter(text) {
  const m = field(text, 'manga').match(/Chapter (\d+)/i)
  return m ? Number(m[1]) : null
}

const arcIndexOf = (chapter) => ARCS.reduce((idx, [start], i) => (chapter >= start ? i : idx), 0)

async function main() {
  await fs.mkdir(path.join(CACHE, 'img'), { recursive: true })
  await fs.mkdir(THUMBS, { recursive: true })
  await fs.mkdir(path.join(OUT_IMG, 'full'), { recursive: true })

  const names = await cachedJson(CACHE, 'members.json', async () => [
    ...new Set(
      (await Promise.all(['Male Characters', 'Female Characters', 'Humans', 'Elves', 'Devils'].map((c) => categoryMembers(API, c)))).flat(),
    ),
  ])
  const pages = await cachedJson(CACHE, 'pages.json', () => wikiPages(API, names))
  const candidates = names.filter((n) => pages[n]?.text && /\{\{Infobox\/Character/i.test(pages[n].text) && debutChapter(pages[n].text) !== null)
  const animeFiles = Object.fromEntries(
    candidates.flatMap((n) => [
      [n, `${n} anime profile.png`],
      [`${n}#short`, `${n.split(' ')[0]} anime profile.png`],
    ]),
  )
  const animeUrls = await cachedJson(CACHE, 'anime-images.json', () => wikiImageUrls(API, [...new Set(Object.values(animeFiles))]))
  const images = await cachedJson(CACHE, 'images.json', async () => {
    const res = await wikiQuery(API, candidates, 'prop=pageimages&piprop=original')
    return Object.fromEntries(Object.entries(res).map(([t, p]) => [t, p.original?.source ?? null]))
  })

  const result = []
  await pool(candidates, 8, async (name) => {
    const { id, text, ru, length } = pages[name]
    const anime = animeUrls[animeFiles[name]] ?? animeUrls[animeFiles[`${name}#short`]]
    const buf = await cachedDownload(path.join(CACHE, 'img'), anime ? `${id}-anime` : String(id), [anime, images[name]].filter(Boolean))
    if (!buf) return console.warn('no image', name)
    try {
      await writeFullAndThumb(buf, path.join(OUT_IMG, 'full', `${id}.webp`), path.join(THUMBS, `${id}.webp`), 96)
    } catch (e) {
      return console.warn('image failed', name, e.message)
    }
    const chapter = debutChapter(text)
    const arcIndex = arcIndexOf(chapter)
    const squad = matchRules(SQUAD_RULES, plain(field(text, 'squad')))[0] ?? 'Нет отряда'
    const attributeText = plain(field(text, 'attribute')).trim()
    const matched = matchRules(ATTRIBUTE_RULES, attributeText).slice(0, 3)
    const attributes = matched.length ? matched : attributeText ? ['Другая магия'] : []
    result.push({
      id,
      name: NAMES[name] ?? ruName(name, ru, transliterate),
      nameEn: name,
      gender: SEX[plain(field(text, 'gender')).trim()] ?? 'Другое',
      species: matchRules(SPECIES_RULES, plain(field(text, 'species')))[0] ?? 'Человек',
      magic: attributes.length ? attributes : ['Нет'],
      squad,
      country:
        matchRules(COUNTRY_RULES, plain(field(text, 'country')))[0] ??
        (!['Нет отряда', 'Глаз полуночного солнца', 'Тёмная троица'].includes(squad) ? 'Королевство Клевера' : 'Неизвестно'),
      status: matchRules(STATUS_RULES, plain(field(text, 'status')))[0] ?? 'Неизвестно',
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
  await writeAtlas(result, THUMBS, path.join(OUT_IMG, 'thumbs.webp'), OUT_ATLAS, 12, 96)
  await pruneImages(path.join(OUT_IMG, 'full'), result)
  await fs.writeFile(OUT_JSON, JSON.stringify(result, null, 1))
  console.log(`wrote ${result.length} characters (${result.filter((c) => c.answer).length} answerable)`)
}

main()
