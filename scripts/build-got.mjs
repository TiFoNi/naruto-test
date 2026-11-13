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
const INCLUDE = new Set(['Syrio Forel', 'Balon Greyjoy', 'Mirri Maz Duur'])

const M = 'Мужской'
const F = 'Женский'
const NO_HOUSE = 'Без дома'

const EXCLUDE = new Set(["Night's Watch officer", 'High Septon (Tommen)', 'Bernadette', 'Boake', 'Aberdolf Strongbeard', 'Arys Oakheart', 'Boros Blount', 'Malakho', 'Alys Karstark', 'Wolkan', 'Lothar Frey', 'Walder Rivers', 'Biter', 'Rorge', 'Qhono', 'Kovarro'])

const FEMALE = new Set([
  'Daenerys Targaryen', 'Cersei Lannister', 'Sansa Stark', 'Arya Stark', 'Brienne of Tarth', 'Missandei', 'Melisandre', 'Gilly',
  'Catelyn Stark', 'Margaery Tyrell', 'Shae', 'Olenna Tyrell', 'Ygritte', 'Yara Greyjoy', 'Osha', 'Meera Reed', 'Myrcella Baratheon',
  'Ros', 'Irri', 'Ellaria Sand', 'Selyse Baratheon', 'Doreah', 'Talisa Stark', 'Waif', 'Shireen Baratheon', 'Lyanna Mormont',
  'Tyene Sand', 'Myranda', 'Marei', 'Obara Sand', 'Nymeria Sand', 'Unella', 'Mordane', 'Lysa Arryn', 'Walda Bolton',
  'Leaf', 'Lyanna Stark', 'Mirri Maz Duur',
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
  'Jon Snow': 'Бастард, Лорд Сноу, Лорд-командующий, Лорд-командувач, lord commander, Король Севера, Белый Волк, Эйгон Таргариен, Король Півночі, Білий Вовк, Ейгон Таргарієн, bastard, lord snow, king in the north, white wolf, aegon targaryen',
  'Daenerys Targaryen': 'Дени, Кхалиси, Матерь драконов, Бурерождённая, Неопалимая, Разрушительница оков, Мхиса, Дені, Кхалісі, Мати драконів, Бурероджена, Неопалима, Руйнівниця кайданів, dany, khaleesi, mother of dragons, stormborn, unburnt, breaker of chains, mhysa',
  'Tyrion Lannister': 'Бес, Полумуж, Десница, Біс, Півчоловік, Правиця, imp, halfman, hand of the king, hand of the queen',
  'Jaime Lannister': 'Цареубийца, Цареубивця, kingslayer',
  'Sandor Clegane': 'Пёс, Пес, hound',
  'Gregor Clegane': 'Гора, Скачущая Гора, mountain, the mountain',
  'Petyr Baelish': 'Мизинец, Мізинчик, littlefinger',
  Varys: 'Паук, Павук, spider, master of whisperers',
  'Arya Stark': 'Арри, Никто, Аррі, Ніхто, arry, no one',
  'Sansa Stark': 'Пташка, Королева Севера, Алейна, Королева Півночі, little bird, queen in the north, alayne',
  'Bran Stark': 'Бран Сломленный, Трёхглазый ворон, Бран Зламаний, Триокий ворон, bran the broken, three-eyed raven',
  'Robb Stark': 'Молодой Волк, Король Севера, Молодий Вовк, Король Півночі, young wolf, king in the north',
  'Eddard Stark': 'Нед, Десница, Правиця, ned, hand of the king',
  'Catelyn Stark': 'Кейт, Кет, cat',
  'Theon Greyjoy': 'Вонючка, Перевёртыш, Смердюк, Перевертень, reek, turncloak',
  'Ramsay Bolton': 'Рамси Сноу, Бастард Болтонов, Рамсі Сноу, ramsay snow',
  'Joffrey Baratheon': 'Джофф, joff',
  'Samwell Tarly': 'Сэм, Сэм Убийца, Сем, Сем Вбивця, sam, sam the slayer',
  'Brienne of Tarth': 'Бриенна Красавица, Леди Бриенна, Брієнна Красуня, brienne the beauty, lady brienne',
  'Davos Seaworth': 'Луковый рыцарь, Цибулевий лицар, onion knight',
  Melisandre: 'Красная женщина, Красная жрица, Червона жінка, Червона жриця, red woman, red priestess',
  Hodor: 'Уиллис, Вілліс, wylis',
  Drogo: 'Кхал Дрого, Кхал, khal drogo, khal',
  'Grey Worm': 'Сірий Черв’як, Сірий Хробак, grey worm, torgo nudho',
  'High Sparrow': 'Верховный воробей, Верховний горобець, Його Горобейшість, high sparrow',
  'Night King': 'Король Ночи, Нічний король, Король Ночі, night king',
  'Mance Rayder': 'Король за Стеной, Король за Стіною, king beyond the wall',
  Tormund: 'Великанья Смерть, Тормунд Великанья Смерть, Погибель Велетнів, giantsbane, tormund giantsbane',
  'Barristan Selmy': 'Барристан Смелый, Барістан Сміливий, barristan the bold',
  "Jaqen H'ghar": 'якен хгар, Человек без лица, Людина без обличчя, faceless man',
  'Syrio Forel': 'Первый меч Браавоса, Перший меч Браавосу, first sword of braavos',
  'Olenna Tyrell': 'Королева Шипов, Королева Терну, queen of thorns',
  'Loras Tyrell': 'Рыцарь Цветов, Лицар Квітів, knight of flowers',
  'Beric Dondarrion': 'Молниеносный лорд, Блискавичний лорд, lightning lord',
  Thoros: 'Торос из Мира, Торос з Міру, thoros of myr',
  Pycelle: 'Великий мейстер, Великий мейстер, grand maester',
  Aemon: 'Эймон Таргариен, Мейстер Эймон, Еймон Таргарієн, aemon targaryen, maester aemon',
  'Ilyn Payne': 'Королевский палач, Королівський кат, king’s justice',
  'Viserys Targaryen (son of Aerys II)': 'Король-попрошайка, Король-жебрак, beggar king',
  'Euron Greyjoy': 'Вороний Глаз, Вороняче Око, crow’s eye',
  'Walder Frey': 'Поздний лорд Фрей, Пізній лорд Фрей, late lord frey',
  'Brynden Tully': 'Чёрная Рыба, Чорна Риба, blackfish',
  'Oberyn Martell': 'Красный Змей, Червоний Змій, red viper',
  'Jeor Mormont': 'Старый Медведь, Лорд-командующий, Старий Ведмідь, Лорд-командувач, old bear, lord commander',
  'Eddison Tollett': 'Скорбный Эдд, Скорботний Едд, Лорд-командующий, Лорд-командувач, lord commander, dolorous edd, edd',
  Pypar: 'Пип, Піп, pyp',
  'Robin Arryn': 'Милый Робин, Милий Робін, sweetrobin',
  Unella: 'Септа Унелла, septa unella',
  Mordane: 'Септа Мордейн, septa mordane',
  'Mirri Maz Duur': 'Мейега, Ведьма, Відьма, maegi, witch',
  'Pyat Pree': 'Колдун, Чаклун, warlock',
  Dagmer: 'Расщеплённая Челюсть, Розколота Щелепа, cleftjaw',
  'Walda Bolton': 'Толстая Уолда, Товста Волда, fat walda, walda frey',
  'Yohn Royce': 'Бронзовый Джон, Бронзовий Джон, bronze yohn',
  'Brynden Rivers': 'Бринден Риверс, Брінден Ріверс, Трёхглазый ворон, Триокий ворон, brynden rivers, three-eyed raven',
  'Gendry Baratheon': 'Бастард Роберта, Кузнец, Коваль, blacksmith',
  'Robert Baratheon': 'Король Роберт, Узурпатор, Король Роберт, usurper, king robert',
  'Cersei Lannister': 'Королева Серсея, Королева-регентша, Королева-регентка, queen cersei, queen regent',
  'Tywin Lannister': 'Лорд Тайвин, Десница, Правиця, lord tywin, hand of the king',
  'Stannis Baratheon': 'Король Станнис, king stannis',
  'Renly Baratheon': 'Король Ренли, king renly',
  'Hot Pie': 'Пирожок, Пиріжок, hot pie',
  Gilly: 'Лилли, Ліллі, gilly',
  Leaf: 'Листочек, Листочок, leaf, child of the forest',
  'Wun Weg Wun Dar Wun': 'Вун Вун, Великан, Велетень, wun wun, giant',
  'Lyanna Mormont': 'Леди Мормонт, Леді Мормонт, lady mormont',
  Missandei: 'Миссандея из Наата, Міссандея, missandei of naath',
  Qyburn: 'Мейстер Квиберн, Мейстер Квіберн, maester qyburn',
  Luwin: 'Мейстер Лювин, Мейстер Лювін, maester luwin',
  Waif: 'Бродяжка, waif',
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
  Lhazareen: 'Лхазарейцы',
}

const CULTURE_FIX = { Rast: ['Вестеросцы'] }

const NO_ORG = 'Без организации'

const ORGS = {
  'Oberyn Martell': ['Малый совет', 'Вторые сыновья', 'Мейстеры'],
  Aemon: ['Ночной дозор', 'Мейстеры'],
  'Alliser Thorne': ['Ночной дозор'],
  'Benjen Stark': ['Ночной дозор'],
  'Bowen Marsh': ['Ночной дозор'],
  'Eddison Tollett': ['Ночной дозор'],
  Grenn: ['Ночной дозор'],
  'Jeor Mormont': ['Ночной дозор'],
  'Jon Snow': ['Ночной дозор'],
  Locke: ['Ночной дозор'],
  'Mance Rayder': ['Ночной дозор'],
  Olly: ['Ночной дозор'],
  'Othell Yarwyck': ['Ночной дозор'],
  Pypar: ['Ночной дозор'],
  Rast: ['Ночной дозор'],
  'Samwell Tarly': ['Ночной дозор', 'Малый совет', 'Мейстеры'],
  Yoren: ['Ночной дозор'],
  'Janos Slynt': ['Ночной дозор', 'Городская стража', 'Малый совет'],
  'Barristan Selmy': ['Королевская гвардия'],
  'Jaime Lannister': ['Королевская гвардия', 'Малый совет'],
  'Meryn Trant': ['Королевская гвардия'],
  'Sandor Clegane': ['Королевская гвардия', 'Братство без знамён'],
  'Gregor Clegane': ['Королевская гвардия'],
  'Jorah Mormont': ['Королевская гвардия'],
  'Brienne of Tarth': ['Королевская гвардия', 'Малый совет', 'Радужная гвардия'],
  'Podrick Payne': ['Королевская гвардия'],
  'Eddard Stark': ['Малый совет'],
  'Tyrion Lannister': ['Малый совет'],
  'Tywin Lannister': ['Малый совет'],
  'Kevan Lannister': ['Малый совет'],
  Varys: ['Малый совет'],
  'Petyr Baelish': ['Малый совет'],
  Pycelle: ['Малый совет', 'Мейстеры'],
  'Renly Baratheon': ['Малый совет'],
  'Stannis Baratheon': ['Малый совет'],
  'Cersei Lannister': ['Малый совет'],
  'Mace Tyrell': ['Малый совет'],
  Qyburn: ['Малый совет', 'Мейстеры'],
  Bronn: ['Малый совет', 'Городская стража'],
  'Davos Seaworth': ['Малый совет'],
  Luwin: ['Мейстеры'],
  'Beric Dondarrion': ['Братство без знамён'],
  Thoros: ['Братство без знамён', 'Жрецы Владыки Света'],
  Anguy: ['Братство без знамён'],
  'Gendry Baratheon': ['Братство без знамён'],
  "Jaqen H'ghar": ['Безликие'],
  Waif: ['Безликие'],
  'Arya Stark': ['Безликие'],
  'Grey Worm': ['Безупречные'],
  'High Sparrow': ['Вера Семерых'],
  Unella: ['Вера Семерых'],
  'Lancel Lannister': ['Вера Семерых'],
  Mordane: ['Вера Семерых'],
  Melisandre: ['Жрецы Владыки Света'],
  'Loras Tyrell': ['Радужная гвардия', 'Вера Семерых'],
  'Daario Naharis': ['Вторые сыновья'],
  'Xaro Xhoan Daxos': ['Тринадцать'],
  'Pyat Pree': ['Тринадцать'],
  'Obara Sand': ['Песчаные змейки'],
  'Nymeria Sand': ['Песчаные змейки'],
  'Tyene Sand': ['Песчаные змейки'],
}
const WESTEROSI = 'Вестеросцы'
const REGIONS = new Set(['Северяне', 'Жители Королевских земель', 'Жители Запада', 'Речные люди', 'Жители Штормовых земель', 'Жители Простора', 'Дорнийцы', 'Железнорождённые', 'Жители Долины', 'Болотные люди'])
const withWesterosi = (list) => (list.some((one) => REGIONS.has(one)) && !list.includes(WESTEROSI) ? [...list, WESTEROSI] : list)
const ALIVE_FIX = new Set(['Jon Snow'])
const DEAD_FIX = new Set(['Ellaria Sand', 'Olyvar'])

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
    if (INCLUDE.has(title)) return true
    const text = pages[title]?.text ?? ''
    const at = text.search(/\{\{Character/i)
    if (at < 0) return false
    const episodes = Number(field(text.slice(at, at + 4000), 'Appearances').match(/(\d+)\s*episode/)?.[1] ?? 0)
    return episodes >= MIN_EPISODES
  })

  const lookImages = async (titles) => {
    const res = await wikiQuery(API, titles, 'prop=pageimages&piprop=original')
    return Object.fromEntries(Object.entries(res).map(([title, page]) => [title, page.original?.source ?? null]))
  }
  const images = await cachedJson(CACHE, 'images.json', () => lookImages(picked))
  const unseen = picked.filter((title) => !(title in images))
  if (unseen.length) {
    Object.assign(images, await lookImages(unseen))
    await fs.writeFile(path.join(CACHE, 'images.json'), JSON.stringify(images))
  }

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
      aliases: [nameEn.toLowerCase(), ALIASES[title]].filter(Boolean).join(', '),
      gender: FEMALE.has(title) ? F : M,
      houses: HOUSE_FIX[title] ?? (houses.length ? [houses[0]] : [NO_HOUSE]),
      cultures: withWesterosi(CULTURE_FIX[title] ?? [...new Set(cultures)]),
      orgs: ORGS[title] ?? [NO_ORG],
      status: ALIVE_FIX.has(title) || (!DEAD_FIX.has(title) && !clean(field(box, 'Death')).length) ? 'Жив' : 'Мёртв',
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
