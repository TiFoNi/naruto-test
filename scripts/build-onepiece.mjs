import fs from 'node:fs/promises'
import path from 'node:path'
import {
  PUBLIC,
  ROOT,
  cachedDownload,
  cachedJson,
  getJson,
  infobox,
  plain,
  pool,
  pruneImages,
  ruName,
  wikiPages,
  wikiQuery,
  writeAtlas,
  writeFullAndThumb,
} from './lib.mjs'
import { transliterate } from './ru.mjs'
import { dropDeleted, onlyAnswers } from './dropped.mjs'

const API = 'https://onepiece.fandom.com/api.php'
const CACHE = path.join(ROOT, '.cache', 'onepiece')
const THUMBS = path.join(CACHE, 'thumb')
const OUT_IMG = path.join(PUBLIC, 'onepiece')
const OUT_JSON = path.join(ROOT, 'packages', 'game', 'data', 'onepiece.json')
const OUT_ATLAS = path.join(ROOT, 'packages', 'game', 'data', 'onepiece-atlas.json')

const ANSWERS = [
  'Monkey D. Luffy', 'Roronoa Zoro', 'Nami', 'Usopp', 'Sanji', 'Tony Tony Chopper', 'Nico Robin', 'Franky', 'Brook', 'Jinbe',
  'Portgas D. Ace', 'Sabo', 'Monkey D. Garp', 'Monkey D. Dragon', 'Shanks', 'Edward Newgate', 'Marshall D. Teach',
  'Charlotte Linlin', 'Kaidou', 'Gol D. Roger', 'Silvers Rayleigh', 'Dracule Mihawk', 'Boa Hancock', 'Crocodile',
  'Donquixote Doflamingo', 'Bartholomew Kuma', 'Gecko Moria', 'Buggy', 'Trafalgar D. Water Law', 'Eustass Kid', 'Killer',
  'Basil Hawkins', 'X Drake', 'Capone Bege', 'Jewelry Bonney', 'Urouge', 'Scratchmen Apoo', 'Smoker', 'Tashigi', 'Koby',
  'Sengoku', 'Sakazuki', 'Borsalino', 'Kuzan', 'Issho', 'Rob Lucci', 'Kaku', 'Arlong', 'Kuro', 'Krieg', 'Enel',
  'Nefertari Vivi', 'Yamato', 'King', 'Queen', 'Jack', 'Charlotte Katakuri', 'Charlotte Pudding', 'Vinsmoke Judge',
  'Vinsmoke Reiju', 'Kouzuki Oden', 'Kouzuki Momonosuke', 'Kurozumi Orochi', "Kin'emon", 'Perona', 'Caesar Clown',
  'Bartolomeo', 'Cavendish', 'Emporio Ivankov', 'Bentham', 'Magellan', 'Zeff', 'Shirahoshi', 'Hody Jones', 'Vegapunk',
  'Polo Marco', 'Benn Beckman', 'Iceburg', 'Wapol', 'Alvida', 'Carrot', 'Nekomamushi', 'Inuarashi', 'Hatchan',
  'Galdino', 'Daz Bonez', 'Kalifa', 'Monet', 'Vergo', 'Trebol', 'Rebecca', 'Kyros', 'Rocks D. Xebec', 'Nerona Imu',
  'Jaygarcia Saturn', 'Koala', 'Hina', 'Uta', 'Kurozumi Kanjuro', 'Kouzuki Hiyori',
  'Chouchou', 'Karoo', 'Gaimon', 'Johnny', 'Yosaku', 'Jango', 'Mohji', 'Cabaji', 'Richie', 'Marianne', 'Gem', 'Mr. 9',
  'Camie', 'Pappag', 'Duval', 'Baby 5', 'Senor Pink', 'Dalton', 'Yokozuna', 'Pandaman', 'Zeus', 'Prometheus', 'Merry', 'Otohime', 'Fisher Tiger', 'Raizo', 'Izou',
]

const PENDING = [
  'Aladine', 'Stussy', 'Buffalo', 'Bellamy', 'Bepo', 'Boa Sandersonia', 'Boa Marigold', 'Brogy', 'Manmayer Gunko', 'Wadatsumi',
  'Wyper', 'Van Augur', 'Vander Decken IX', 'Vasco Shot', 'Wicca', 'Vinsmoke Ichiji', 'Vinsmoke Niji', 'Vinsmoke Yonji',
  'Viola', 'Gladius', 'Dellinger', 'Jesus Burgess', 'Giolla', 'Diamante', 'Donquixote Rosinante', 'Dorry', 'Igaram', 'Ideo',
  'Inazuma', 'Caribou', 'Catarina Devon', 'Curly Dadan', 'Kikunojo', 'Kokoro', 'Crocus', 'Shimotsuki Kuina', 'Kureha',
  'Laboon', 'Lao G', 'Leo', 'Charlotte Lola', 'Makino', 'Mansherry', 'Marguerite', 'Neptune', 'Nefertari Cobra', 'Nico Olvia',
  'Oars', 'Pedro', 'Pekoms', 'Pell', 'Pica', 'Portgas D. Rouge', 'Satori', 'Sugar', 'Spandam', 'Sentomaru', 'Shakuyaku',
  'Shyarly', 'Hajrudin', 'Gerd', 'Helmeppo', 'Tsuru', 'Chimney', 'Charlotte Brûlée', 'Charlotte Cracker', 'Charlotte Galette',
  "Charlotte Mont-d'Or", 'Charlotte Perospero', 'Charlotte Smoothie', 'Charlotte Chiffon', 'Karasu', 'Belo Betty', 'Morley',
  'Lindbergh', 'Ginny', 'Absalom', 'Jaguar D. Saul', 'Ulti', 'Black Maria', "Who's-Who", 'Aramaki', 'Road', 'Shiryu',
  'Charlotte Oven', 'Page One', 'Figarland Shamrock', 'Ethanbaron V. Nusjuro', 'Topman Warcury', 'Marcus Mars',
  'Shepherd Ju Peter', 'Vegapunk/Lilith', 'Vegapunk/York', 'Avalo Pizarro',
]

ANSWERS.push(...PENDING)

const EN_NAMES = { 'Vegapunk/Lilith': 'Lilith', 'Vegapunk/York': 'York' }

const MINOR = new Set(['Hyougoro', 'Sai', 'Leo', 'Mansherry', 'Gan Fall', 'Genzo', 'Hannyabal', 'Tom', 'Shakuyaku', 'Mikita', 'Zala'])

const EXTRAS = [
  'Helmeppo', 'Kaya', 'Makino', 'Nojiko', 'Bell-mère', 'Genzo', 'Hiriluk', 'Kureha', 'Crocus', 'Laboon', 'Paulie',
  'Kokoro', 'Spandam', 'Absalom', 'Wyper', 'Gan Fall', 'Shimotsuki Kuina', 'Curly Dadan', 'Neptune', 'Fisher Tiger',
  'Kikunojo', 'Kawamatsu', 'Denjiro', 'Raizo', 'Pedro', 'Charlotte Smoothie', 'Charlotte Cracker', 'Charlotte Perospero',
  'Vinsmoke Ichiji', 'Vinsmoke Niji', 'Vinsmoke Yonji', 'Jesus Burgess', 'Shiryu', 'Van Augur', 'Laffitte', 'Lucky Roux',
  'Yasopp', 'Nefertari Cobra', 'Bepo', 'Foxy', 'Bellamy', 'Sentomaru', 'Stussy', 'Tsuru', 'Aramaki', 'Jozu', 'Marco',
  'Izou', 'Black Maria', 'Ulti', "Who's-Who", 'Nico Olvia', 'Jaguar D. Saul', 'Dorry', 'Brogy', 'Sugar', 'Diamante',
  'Dellinger', 'Viola', 'Hannyabal', 'Shakuyaku', 'Zala', 'Mikita', 'Pekoms', 'Charlotte Oven', 'Charlotte Brûlée',
  'Sai', 'Leo', 'Mansherry', 'Tom', 'Kurozumi Tama', 'Shinobu', 'Hyougoro',
].filter((n) => n !== 'Marco' && !MINOR.has(n))

const ARCS = [
  [1, 'Ромэнс Дон'],
  [8, 'Оранж-Таун'],
  [22, 'Деревня Сиропа'],
  [42, 'Барати'],
  [69, 'Арлонг Парк'],
  [96, 'Логтаун'],
  [101, 'Реверс Маунтин'],
  [115, 'Литл Гарден'],
  [130, 'Остров Драм'],
  [155, 'Алабаста'],
  [218, 'Джая'],
  [237, 'Скайпия'],
  [322, 'Water 7'],
  [375, 'Эниес Лобби'],
  [442, 'Триллер Барк'],
  [490, 'Сабаоди'],
  [514, 'Амазон Лили'],
  [525, 'Импел Даун'],
  [550, 'Маринфорд'],
  [598, 'Остров рыболюдей'],
  [654, 'Панк Хазард'],
  [700, 'Дрессроза'],
  [802, 'Зоу'],
  [825, 'Пирожный остров'],
  [909, 'Вано'],
  [1058, 'Эгхед'],
  [1126, 'Эльбаф'],
]

const SEX_CATEGORIES = [
  ['Мужской', /^Category:Male Characters$/],
  ['Женский', /^Category:Female Characters$/],
]

const RACE_RULES = [
  ['Человек', /^Category:(Humans|Skypieans|Shandia|Gorgon Sisters)$/],
  ['Рыболюд', /^Category:Fish-Men$/],
  ['Русал', /^Category:Merfolk$/],
  ['Минк', /^Category:(Minks|Mink Tribe)$/],
  ['Великан', /^Category:Giants$/],
  ['Гном', /^Category:Dwarves$/],
  ['Лунарианец', /^Category:Lunarians$/],
  ['Длиннорукий', /^Category:(Longarm Tribe|Longarms)$/],
  ['Длинноногий', /^Category:Longleg Tribe$/],
  ['Змеешеий', /^Category:Snakeneck Tribe$/],
  ['Трёхглазый', /^Category:Three-Eye Tribe$/],
  ['Животное', /^Category:(Animals|Talking Animals|Animals with Devil Fruit Abilities|Whales|Pets|(?!.*\b(?:Use|Using|Fighters|Riders)\b)[A-Za-z0-9 ']+ Animals)$/],
  ['Хоми', /^Category:Homies$/],
  ['Биркан', /^Category:Birkans$/],
  ['Букканир', /^Category:Buccaneers$/],
]

const RACE_FIX = {
  Kaidou: ['Они'],
  Yamato: ['Они'],
  Urouge: ['Биркан'],
  'Charlotte Pudding': ['Человек', 'Трёхглазый'],
  'Nerona Imu': ['Неизвестно'],
  Pandaman: ['Неизвестно'],
}

const GENDER_FIX = { Yamato: 'Женский', Bentham: 'Мужской', Dellinger: 'Мужской' }

const HAKI_FIX = {
  Sanji: ['Наблюдения', 'Вооружения', 'Королевская'],
  'Dracule Mihawk': ['Наблюдения', 'Вооружения', 'Королевская'],
  'Benn Beckman': ['Наблюдения', 'Вооружения'],
}

const FRUIT_RULES = [
  ['Парамеция', /Paramecia Devil Fruit Users$/],
  ['Зоан', /Zoan Devil Fruit Users$|SMILE Users$/],
  ['Логия', /Logia Devil Fruit Users$/],
]

const HAKI_RULES = [
  ['Наблюдения', /^Category:Observation Haki Users$/],
  ['Вооружения', /^Category:Armament Haki Users$/],
  ['Королевская', /^Category:Supreme King Haki Users$/],
]

const AFFILIATION_RULES = [
  ['Пираты Соломенной Шляпы', /straw hat pirates/i],
  ['Флот', /\bmarines\b|\bsword\b/i],
  ['Мировое правительство', /world government|cipher pol|\bcp[-\s]?\d|five elders|god's knights|world nobles|celestial dragon|vegapunk/i],
  ['Революционная армия', /revolutionary army/i],
  ['Семь военачальников', /seven warlords/i],
  ['Пираты Белоуса', /whitebeard pirates/i],
  ['Пираты Большой Мамочки', /big mom pirates/i],
  ['Пираты Зверей', /beasts pirates/i],
  ['Пираты Рыжего', /red hair pirates/i],
  ['Пираты Чёрной Бороды', /blackbeard pirates/i],
  ['Пираты Роджера', /roger pirates/i],
  ['Пираты Рокса', /rocks pirates/i],
  ['Кросс Гильдия', /cross guild/i],
  ['Пираты Сердца', /heart pirates/i],
  ['Пираты Кида', /kid pirates/i],
  ['Семья Донкихот', /donquixote pirates|donquixote family/i],
  ['Барок Воркс', /baroque works/i],
  ['Джерма 66', /germa 66|vinsmoke family/i],
  ['Вано', /kouzuki family|nine red scabbards|kurozumi family|wano country|kozuki/i],
  ['Пираты Арлонга', /arlong pirates/i],
  ['Пиратки Куджа', /kuja pirates/i],
  ['Пираты Солнца', /sun pirates/i],
  ['Пираты Триллер Барка', /thriller bark pirates/i],
  ['Пираты Багги', /buggy pirates|buggy's delivery/i],
  ['Королевство Алабаста', /arabasta kingdom|nefertari family/i],
  ['Минки', /mokomo dukedom|mink tribe/i],
  ['Галлей-Ла', /galley-la/i],
  ['Королевство Рюгу', /ryugu kingdom/i],
  ['Тонтатта', /tontatta/i],
  ['Дрессроза', /dressrosa|riku family/i],
]

const NAMES = {
  'Monkey D. Luffy': 'Монки Д. Луффи',
  'Roronoa Zoro': 'Ророноа Зоро',
  'Tony Tony Chopper': 'Тони Тони Чоппер',
  'Nico Robin': 'Нико Робин',
  'Portgas D. Ace': 'Портгас Д. Эйс',
  'Edward Newgate': 'Эдвард Ньюгейт (Белоус)',
  'Marshall D. Teach': 'Маршалл Д. Тич (Чёрная Борода)',
  'Charlotte Linlin': 'Шарлотта Линлин (Большая Мамочка)',
  Kaidou: 'Кайдо',
  'Gol D. Roger': 'Гол Д. Роджер',
  'Silvers Rayleigh': 'Сильвер Рэйли',
  'Dracule Mihawk': 'Дракуль Михок',
  'Boa Hancock': 'Боа Хэнкок',
  'Donquixote Doflamingo': 'Донкихот Дофламинго',
  'Trafalgar D. Water Law': 'Трафальгар Ло',
  'Eustass Kid': 'Юстасс Кид',
  Sakazuki: 'Сакадзуки (Акаину)',
  Borsalino: 'Борсалино (Кизару)',
  Kuzan: 'Кузан (Аокидзи)',
  Issho: 'Иссё (Фудзитора)',
  'Rob Lucci': 'Роб Луччи',
  'Polo Marco': 'Марко',
  'Nerona Imu': 'Имму',
  'Jaygarcia Saturn': 'Джейгарсия Сатурн',
  'Emporio Ivankov': 'Эмпорио Иванков',
  Bentham: 'Бентам (Мистер 2)',
  Chouchou: 'Шушу',
  Karoo: 'Каро',
  Gaimon: 'Гаймон',
  Johnny: 'Джонни',
  Yosaku: 'Ёсаку',
  Jango: 'Джанго',
  Mohji: 'Моджи',
  Cabaji: 'Кабаджи',
  Richie: 'Ричи',
  Marianne: 'Марианна (Мисс Голден Уик)',
  Gem: 'Гем (Мистер 5)',
  'Mr. 9': 'Мистер 9',
  Camie: 'Кэйми',
  Pappag: 'Паппаг',
  Duval: 'Дюваль',
  'Baby 5': 'Бэби 5',
  'Senor Pink': 'Сеньор Пинк',
  Dalton: 'Далтон',
  Yokozuna: 'Ёкодзуна',
  Pandaman: 'Пандамен',
  Zeus: 'Зевс',
  Prometheus: 'Прометей',
  Merry: 'Мэри',
  Galdino: 'Гальдино (Мистер 3)',
  'Daz Bonez': 'Даз Бонс (Мистер 1)',
  Zala: 'Зала (Мисс Даблфингер)',
  Mikita: 'Микита (Мисс Валентайн)',
  Sanji: 'Санджи',
  Usopp: 'Усопп',
  Brook: 'Брук',
  Franky: 'Фрэнки',
  Jinbe: 'Джимбей',
  Shanks: 'Шанкс',
  Buggy: 'Багги',
  Enel: 'Энель',
  Krieg: 'Дон Криг',
  'Kouzuki Oden': 'Кодзуки Одэн',
  'Kouzuki Momonosuke': 'Кодзуки Момоносукэ',
  'Kouzuki Hiyori': 'Кодзуки Хиёри',
  'Kurozumi Orochi': 'Куродзуми Орочи',
  'Kurozumi Kanjuro': 'Куродзуми Канджуро',
  'Kurozumi Tama': 'Тама',
  "Kin'emon": 'Кинъэмон',
  'Nefertari Vivi': 'Нефертари Виви',
  'Nefertari Cobra': 'Нефертари Кобра',
  'Bell-mère': 'Белл-мэр',
  "Who's-Who": 'Ху-из-Ху',
  'Rocks D. Xebec': 'Рокс Д. Шебек',
  Aladine: 'Аладин',
  Stussy: 'Стусси',
  Buffalo: 'Баффало',
  Bellamy: 'Беллами',
  Bepo: 'Бепо',
  'Boa Sandersonia': 'Боа Сандерсония',
  'Boa Marigold': 'Боа Мариголд',
  Brogy: 'Брогги',
  'Manmayer Gunko': 'Манмаер Гунко',
  Wadatsumi: 'Вадацуми',
  Wyper: 'Вайпер',
  'Van Augur': 'Ван Огер',
  'Vander Decken IX': 'Вандер Деккен IX',
  'Vasco Shot': 'Васко Шот',
  Wicca: 'Викка',
  'Vinsmoke Ichiji': 'Винсмок Ичиджи',
  'Vinsmoke Niji': 'Винсмок Ниджи',
  'Vinsmoke Yonji': 'Винсмок Йонджи',
  Viola: 'Виола',
  Gladius: 'Гладиус',
  Dellinger: 'Деллинджер',
  'Jesus Burgess': 'Джизус Бёрджесс',
  Giolla: 'Джолла',
  Diamante: 'Диаманте',
  'Donquixote Rosinante': 'Донкихот Росинант (Корасон)',
  Dorry: 'Дорри',
  Igaram: 'Игарам',
  Ideo: 'Идео',
  Inazuma: 'Инадзума',
  Caribou: 'Карибу',
  'Catarina Devon': 'Катарина Девон',
  'Curly Dadan': 'Кёрли Дадан',
  Kikunojo: 'Кикуноджо',
  Kokoro: 'Кокоро',
  Crocus: 'Крокус',
  Kureha: 'Куреха',
  Laboon: 'Лабун',
  'Lao G': 'Лао Джи',
  Leo: 'Лео',
  'Charlotte Lola': 'Шарлотта Лола',
  Makino: 'Макино',
  Mansherry: 'Маншерри',
  Marguerite: 'Маргарет',
  Neptune: 'Нептун',
  'Nefertari Cobra': 'Нефертари Кобра',
  Oars: 'Оарс',
  Pedro: 'Педро',
  Pekoms: 'Пекомс',
  Pell: 'Пелл',
  Pica: 'Пика',
  'Portgas D. Rouge': 'Портгас Д. Руж',
  Satori: 'Сатори',
  Sugar: 'Сахарок',
  Spandam: 'Спандам',
  Sentomaru: 'Сэнтомару',
  Shakuyaku: 'Сякуяку (Шакки)',
  Shyarly: 'Сярли',
  Hajrudin: 'Хайрудин',
  Gerd: 'Герд',
  Helmeppo: 'Хельмеппо',
  Tsuru: 'Цуру',
  Chimney: 'Чимни',
  'Charlotte Brûlée': 'Шарлотта Брюле',
  'Charlotte Cracker': 'Шарлотта Крекер',
  'Charlotte Galette': 'Шарлотта Галетт',
  "Charlotte Mont-d'Or": 'Шарлотта Мон-Дор',
  'Charlotte Perospero': 'Шарлотта Перосперо',
  'Charlotte Smoothie': 'Шарлотта Смузи',
  'Charlotte Chiffon': 'Шарлотта Шифон',
  Karasu: 'Карасу',
  'Belo Betty': 'Бело Бетти',
  Morley: 'Морли',
  Lindbergh: 'Линдберг',
  Ginny: 'Джинни',
  Absalom: 'Абсалом',
  'Jaguar D. Saul': 'Ягуар Д. Саул',
  Ulti: 'Ульти',
  'Black Maria': 'Блэк Мария',
  "Who's-Who": 'Хуз Ху',
  Aramaki: 'Арамаки (Рёкугю)',
  Road: 'Роуд',
  Shiryu: 'Ширю',
  'Charlotte Oven': 'Шарлотта Овен',
  'Page One': 'Пейдж Ван',
  'Figarland Shamrock': 'Фигарланд Шемрок',
  'Ethanbaron V. Nusjuro': 'Итанбарон В. Нусджуро',
  'Topman Warcury': 'Топман Воркури',
  'Marcus Mars': 'Маркус Марс',
  'Shepherd Ju Peter': 'Шепард Джу Питер',
  'Vegapunk/Lilith': 'Лилит',
  'Vegapunk/York': 'Йорк',
  'Avalo Pizarro': 'Авало Писарро',
  Iceburg: 'Айсбёрг',
  Urouge: 'Урог',
  Paulie: 'Паули',
  'Shimotsuki Kuina': 'Куина',
  'X Drake': 'Икс Дрейк',
  'Nico Olvia': 'Нико Ольвия',
}

const AFFILIATION_OVERRIDES = { Magellan: ['Мировое правительство'], Izou: ['Пираты Белоуса', 'Вано'], Ulti: ['Пираты Зверей'], 'Page One': ['Пираты Зверей'] }

function affiliationsOf(text) {
  const found = AFFILIATION_RULES.filter(([, re]) => re.test(text)).map(([label]) => label)
  if (found.length) return found
  return [/pirates|crew|barto club/i.test(text) ? 'Другие пираты' : 'Другое']
}

const matchCategories = (rules, cats) => rules.filter(([, re]) => cats.some((c) => re.test(c))).map(([label]) => label)

function field(box, name) {
  const raw = infobox(box, name) ?? ''
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

function charBox(text) {
  const start = text.indexOf('{{Char Box')
  if (start < 0) return null
  let depth = 0
  for (let i = start; i < text.length - 1; i++) {
    const pair = text.slice(i, i + 2)
    if (pair === '{{') depth++, i++
    else if (pair === '}}') {
      depth--, i++
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  return text.slice(start)
}

function splitTop(raw) {
  const parts = []
  let depth = 0
  let parens = 0
  let current = ''
  for (let i = 0; i < raw.length; i++) {
    const pair = raw.slice(i, i + 2)
    if (pair === '{{' || pair === '[[') {
      depth++
      current += pair
      i++
      continue
    }
    if (pair === '}}' || pair === ']]') {
      depth--
      current += pair
      i++
      continue
    }
    const ch = raw[i]
    if (ch === '(') parens++
    if (ch === ')') parens = Math.max(0, parens - 1)
    if (depth === 0 && parens === 0 && (ch === ';' || ch === ',' || ch === '\n')) {
      parts.push(current)
      current = ''
      continue
    }
    current += ch
  }
  parts.push(current)
  return parts.flatMap((p) => p.split(/<br\s*\/?>/i))
}

function stripTemplates(s) {
  let out = ''
  let depth = 0
  for (let i = 0; i < s.length; i++) {
    const pair = s.slice(i, i + 2)
    if (pair === '{{') {
      depth++
      i++
    } else if (pair === '}}' && depth > 0) {
      depth--
      i++
    } else if (depth === 0) out += s[i]
  }
  return out.replace(/<ref[\s\S]*?(\/>|<\/ref>)/g, '')
}

const PAST = /\((?:[^)]*\b)?(former|formerly|defected|resigned|disbanded|temporary|temporarily|dissolved|infiltrated|undercover|spy|descended|deceased|expelled|fired|revoked|double agent|secret)\b/i

function affiliationEntries(raw) {
  const all = splitTop(raw)
    .filter((e) => !/noncanon/i.test(e))
    .map((e) => plain(stripTemplates(e)).trim())
    .filter(Boolean)
  const current = all.filter((e) => !PAST.test(e))
  return current.length ? current : all
}

function bounty(box) {
  const nums = [...field(box, 'bounty').matchAll(/\{\{B\}\}\s*([\d,]+)/g)].map((m) => Number(m[1].replace(/,/g, '')))
  return nums.length ? Math.max(...nums) : 0
}

function debutChapter(box) {
  const m = field(box, 'first').match(/Chapter (\d+)/i)
  return m ? Number(m[1]) : null
}

const arcIndexOf = (chapter) => ARCS.reduce((idx, [start], i) => (chapter >= start ? i : idx), 0)

async function categoriesOf(titles) {
  const out = {}
  for (let i = 0; i < titles.length; i += 10) {
    const batch = titles.slice(i, i + 10)
    let cont = ''
    do {
      const res = await getJson(`${API}?action=query&format=json&redirects=1&prop=categories&cllimit=500&titles=${encodeURIComponent(batch.join('|'))}${cont}`)
      for (const p of Object.values(res.query.pages)) (out[p.title] ??= []).push(...(p.categories ?? []).map((c) => c.title))
      cont = res.continue?.clcontinue ? `&clcontinue=${encodeURIComponent(res.continue.clcontinue)}` : ''
    } while (cont)
  }
  return out
}

async function cachedFor(file, names, load) {
  const kept = await cachedJson(CACHE, file, () => load(names))
  const missing = names.filter((name) => !(name in kept))
  if (!missing.length) return kept
  const merged = { ...kept, ...(await load(missing)) }
  await fs.writeFile(path.join(CACHE, file), JSON.stringify(merged))
  return merged
}

async function main() {
  await fs.mkdir(path.join(CACHE, 'img'), { recursive: true })
  await fs.mkdir(THUMBS, { recursive: true })
  await fs.mkdir(path.join(OUT_IMG, 'full'), { recursive: true })

  const names = [...new Set([...ANSWERS, ...EXTRAS])]
  const pages = await cachedFor('pages.json', names, (list) => wikiPages(API, list))
  const tabs = Object.fromEntries(names.map((n) => [n, pages[n]?.text?.match(/\{\{([^{}|]+ Tabs Top)\}\}/)?.[1]]).filter(([, t]) => t))
  const templates = await cachedFor('templates.json', [...new Set(Object.values(tabs))], async (list) => {
    const res = await wikiQuery(API, list.map((t) => `Template:${t}`), 'prop=revisions&rvprop=content&rvslots=main')
    return Object.fromEntries(Object.entries(res).map(([t, p]) => [t.replace(/^Template:/, ''), p.revisions?.[0]?.slots?.main?.['*'] ?? '']))
  })
  const categories = await cachedFor('categories.json', names, (list) => categoriesOf(list))
  const images = await cachedFor('images.json', names, async (list) => {
    const res = await wikiQuery(API, list, 'prop=pageimages&piprop=original')
    return Object.fromEntries(Object.entries(res).map(([t, p]) => [t, p.original?.source ?? null]))
  })

  const result = []
  await pool(names, 8, async (name) => {
    const page = pages[name]
    if (!page?.text) return console.warn('missing page', name)
    const box = charBox(tabs[name] ? templates[tabs[name]] : page.text)
    if (!box) return console.warn('no char box', name)
    const pending = PENDING.includes(name)
    if (!pending) {
      const buf = await cachedDownload(path.join(CACHE, 'img'), String(page.id), [images[name]])
      if (!buf) return console.warn('no image', name)
      try {
        await writeFullAndThumb(buf, path.join(OUT_IMG, 'full', `${page.id}.webp`), path.join(THUMBS, `${page.id}.webp`), 96)
      } catch (e) {
        return console.warn('image failed', name, e.message)
      }
    }
    const cats = categories[name] ?? []
    const chapter = debutChapter(box)
    if (chapter === null) return console.warn('no debut chapter', name)
    const arcIndex = arcIndexOf(chapter)
    const affiliationText = affiliationEntries(field(box, 'affiliation')).join('\n')
    const races = matchCategories(RACE_RULES, cats)
    result.push({
      id: page.id,
      name: NAMES[name] ?? ruName(name, page.ru, transliterate),
      nameEn: EN_NAMES[name] ?? name,
      gender: GENDER_FIX[name] ?? matchCategories(SEX_CATEGORIES, cats)[0] ?? 'Другое',
      races: RACE_FIX[name] ?? (races.length ? races : ['Человек']),
      affiliations: AFFILIATION_OVERRIDES[name] ?? affiliationsOf(affiliationText),
      fruits: matchCategories(FRUIT_RULES, cats),
      haki: HAKI_FIX[name] ?? matchCategories(HAKI_RULES, cats),
      bounty: bounty(box),
      arc: ARCS[arcIndex][1],
      arcIndex,
      answer: ANSWERS.includes(name),
      ...(pending ? { hidden: true, thumb: -1 } : {}),
    })
  })

  dropDeleted(result, 'onepiece')

  const before = await fs.readFile(OUT_JSON, 'utf8').then((raw) => new Map(JSON.parse(raw).map((one) => [one.id, one]))).catch(() => new Map())
  for (const one of result) if (before.get(one.id)?.nameUk) one.nameUk = before.get(one.id).nameUk

  onlyAnswers(result)
  result.sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  const shown = result.filter((one) => !one.hidden)
  if (shown.every((one) => before.get(one.id)?.thumb >= 0)) for (const one of shown) one.thumb = before.get(one.id).thumb
  else await writeAtlas(shown, THUMBS, path.join(OUT_IMG, 'thumbs.webp'), OUT_ATLAS, 12, 96)
  await pruneImages(path.join(OUT_IMG, 'full'), shown)
  await fs.writeFile(OUT_JSON, JSON.stringify(result, null, 1))
  console.log(`wrote ${result.length} characters (${result.filter((c) => c.answer).length} answerable)`)
}

main()
