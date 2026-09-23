import fs from 'node:fs/promises'
import path from 'node:path'
import {
  ROOT,
  cachedDownload,
  cachedJson,
  infobox,
  plain,
  pool,
  pruneImages,
  wikiImageUrls,
  wikiPages,
  wikiQuery,
  writeAtlas,
  writeFullAndThumb,
} from './lib.mjs'
import { dropDeleted, onlyAnswers } from './dropped.mjs'

const API = 'https://mortalkombat.fandom.com/api.php'
const CACHE = path.join(ROOT, '.cache', 'mk')
const THUMBS = path.join(CACHE, 'thumb')
const OUT_IMG = path.join(ROOT, 'public', 'mk')
const OUT_JSON = path.join(ROOT, 'src', 'data', 'mk.json')
const OUT_ATLAS = path.join(ROOT, 'src', 'data', 'mk-atlas.json')

const GOOD = 'Добро'
const EVIL = 'Зло'
const NEUTRAL = 'Нейтралитет'

const FIGHTERS = [
  ['Hanzo Hasashi', 'Scorpion', 'Скорпион', true, ['Ширай Рю'], NEUTRAL],
  ['Kuai Liang', 'Sub-Zero', 'Саб-Зиро', true, ['Лин Куэй'], GOOD],
  ['Bi-Han', 'Noob Saibot', 'Нуб Сайбот', true, ['Лин Куэй', 'Братство Тени'], EVIL],
  ['Liu Kang', 'Liu Kang', 'Лю Кан', true, ['Шаолинь', 'Белый Лотос'], GOOD],
  ['Kung Lao', 'Kung Lao', 'Кун Лао', true, ['Шаолинь', 'Белый Лотос'], GOOD],
  ['Raiden', 'Raiden', 'Райден', true, ['Боги'], GOOD],
  ['Johnny Cage', 'Johnny Cage', 'Джонни Кейдж', true, ['Спецназ'], GOOD],
  ['Sonya Blade', 'Sonya Blade', 'Соня Блейд', true, ['Спецназ'], GOOD],
  ['Jax Briggs', 'Jax', 'Джакс', true, ['Спецназ'], GOOD],
  ['Kano', 'Kano', 'Кано', true, ['Чёрный Дракон'], EVIL],
  ['Kitana', 'Kitana', 'Китана', true, ['Королевская семья Эдении'], GOOD],
  ['Mileena', 'Mileena', 'Милина', true, ['Армия Внешнего мира'], EVIL],
  ['Jade', 'Jade', 'Джейд', true, ['Королевская семья Эдении'], GOOD],
  ['Shang Tsung', 'Shang Tsung', 'Шан Цунг', true, ['Армия Внешнего мира'], EVIL],
  ['Shao Kahn', 'Shao Kahn', 'Шао Кан', true, ['Армия Внешнего мира'], EVIL],
  ['Goro', 'Goro', 'Горо', true, ['Шокан', 'Армия Внешнего мира'], EVIL],
  ['Kintaro', 'Kintaro', 'Кинтаро', true, ['Шокан', 'Армия Внешнего мира'], EVIL],
  ['Sindel', 'Sindel', 'Синдел', true, ['Королевская семья Эдении'], GOOD],
  ['Baraka', 'Baraka', 'Барака', true, ['Таркатаны', 'Армия Внешнего мира'], EVIL],
  ['Reptile', 'Reptile', 'Рептилия', true, ['Армия Внешнего мира'], EVIL],
  ['Ermac', 'Ermac', 'Эрмак', true, ['Армия Внешнего мира'], NEUTRAL],
  ['Smoke', 'Smoke', 'Смоук', true, ['Лин Куэй'], GOOD],
  ['Cyrax', 'Cyrax', 'Сайракс', true, ['Лин Куэй'], NEUTRAL],
  ['Sektor', 'Sektor', 'Сектор', true, ['Лин Куэй'], EVIL],
  ['Nightwolf', 'Nightwolf', 'Ночной Волк', true, ['Матоки'], GOOD],
  ['Kabal', 'Kabal', 'Кабал', true, ['Чёрный Дракон'], NEUTRAL],
  ['Kurtis Stryker', 'Stryker', 'Страйкер', true, ['Спецназ'], GOOD],
  ['Sheeva', 'Sheeva', 'Шива', true, ['Шокан', 'Армия Внешнего мира'], EVIL],
  ['Motaro', 'Motaro', 'Мотаро', true, ['Армия Внешнего мира'], EVIL],
  ['Quan Chi', 'Quan Chi', 'Куан Чи', true, ['Братство Тени'], EVIL],
  ['Shinnok', 'Shinnok', 'Шиннок', true, ['Боги', 'Братство Тени'], EVIL],
  ['Fujin', 'Fujin', 'Фудзин', true, ['Боги'], GOOD],
  ['Jarek', 'Jarek', 'Джарек', false, ['Чёрный Дракон'], EVIL],
  ['Tanya', 'Tanya', 'Таня', true, ['Братство Тени'], EVIL],
  ['Reiko', 'Reiko', 'Рейко', false, ['Братство Тени'], EVIL],
  ['Kai', 'Kai', 'Кай', false, ['Шаолинь', 'Белый Лотос'], GOOD],
  ['Frost', 'Frost', 'Фрост', true, ['Лин Куэй'], EVIL],
  ['Kenshi Takahashi', 'Kenshi', 'Кенши', true, ['Спецназ'], GOOD],
  ['Li Mei', 'Li Mei', 'Ли Мэй', true, ['Армия Внешнего мира'], GOOD],
  ["Bo' Rai Cho", "Bo' Rai Cho", 'Бо Рай Чо', true, ['Шаолинь'], GOOD],
  ['Mavado', 'Mavado', 'Мавадо', false, ['Красный Дракон'], EVIL],
  ['Hsu Hao', 'Hsu Hao', 'Сю Хао', false, ['Красный Дракон'], EVIL],
  ['Nitara', 'Nitara', 'Нитара', true, [], NEUTRAL],
  ['Drahmin', 'Drahmin', 'Драмин', false, ['Братство Тени'], EVIL],
  ['Moloch', 'Moloch', 'Молох', false, ['Братство Тени'], EVIL],
  ['Onaga', 'Onaga', 'Онага', true, ['Армия Внешнего мира'], EVIL],
  ['Havik', 'Havik', 'Хавик', true, [], NEUTRAL],
  ['Ashrah', 'Ashrah', 'Ашра', true, [], GOOD],
  ['Hotaru', 'Hotaru', 'Хотару', false, ['Армия Внешнего мира'], NEUTRAL],
  ['Kobra', 'Kobra', 'Кобра', false, ['Чёрный Дракон'], EVIL],
  ['Kira', 'Kira', 'Кира', false, ['Чёрный Дракон'], EVIL],
  ['Shujinko', 'Shujinko', 'Шуджинко', false, [], GOOD],
  ['Taven', 'Taven', 'Тавен', false, [], GOOD],
  ['Daegon', 'Daegon', 'Дэгон', false, ['Красный Дракон'], EVIL],
  ['Blaze', 'Blaze', 'Блейз', false, [], GOOD],
  ['Cassie Cage', 'Cassie Cage', 'Кэсси Кейдж', true, ['Спецназ'], GOOD],
  ['Jacqui Briggs', 'Jacqui Briggs', 'Джеки Бриггс', true, ['Спецназ'], GOOD],
  ['Takeda Takahashi', 'Takeda', 'Такеда', true, ['Спецназ', 'Ширай Рю'], GOOD],
  ['Kung Jin', 'Kung Jin', 'Кун Цзинь', true, ['Шаолинь'], GOOD],
  ['Ferra & Torr', 'Ferra & Torr', 'Ферра и Торр', true, ['Армия Внешнего мира'], EVIL],
  ["D'Vorah", "D'Vorah", 'Ди’Вора', true, ['Армия Внешнего мира'], EVIL],
  ['Kotal Kahn', 'Kotal Kahn', 'Котал Кан', true, ['Армия Внешнего мира'], NEUTRAL],
  ['Erron Black', 'Erron Black', 'Эррон Блэк', true, ['Армия Внешнего мира'], NEUTRAL],
  ['Kollector', 'Kollector', 'Коллектор', true, ['Армия Внешнего мира'], EVIL],
  ['Geras', 'Geras', 'Герас', true, ['Кроника'], EVIL],
  ['Cetrion', 'Cetrion', 'Цетрион', true, ['Боги'], EVIL],
  ['Kronika', 'Kronika', 'Кроника', true, ['Кроника', 'Боги'], EVIL],
  ['Rain', 'Rain', 'Рейн', true, ['Армия Внешнего мира'], EVIL],
  ['Tremor', 'Tremor', 'Тремор', false, ['Чёрный Дракон'], EVIL],
  ['Sareena', 'Sareena', 'Сарина', false, ['Братство Тени'], NEUTRAL],
  ['Chameleon', 'Chameleon', 'Хамелеон', false, [], NEUTRAL],
  ['Khameleon', 'Khameleon', 'Кхамелеон', false, [], NEUTRAL],
  ['Skarlet', 'Skarlet', 'Скарлет', true, ['Армия Внешнего мира'], EVIL],
]

const GAMES = [
  ['MK (1992)', /^Mortal Kombat \(1992 video game\)$|^Mortal Kombat$/],
  ['MK II', /^Mortal Kombat II$/],
  ['MK 3', /^(Ultimate )?Mortal Kombat 3|^Mortal Kombat Trilogy$|^Ultimate Mortal Kombat/],
  ['MK 4', /^Mortal Kombat 4$|^Mortal Kombat Gold$|^Mortal Kombat Mythologies|^Mortal Kombat: Special Forces$/],
  ['Deadly Alliance', /Deadly Alliance|Tournament Edition/],
  ['Deception', /Deception|Unchained/],
  ['Shaolin Monks', /Shaolin Monks/],
  ['Armageddon', /Armageddon/],
  ['MK vs DC', /DC Universe/],
  ['MK (2011)', /^Mortal Kombat \(2011/],
  ['MK X', /^Mortal Kombat X$/],
  ['MK 11', /^Mortal Kombat 11$/],
  ['MK 1', /^Mortal Kombat 1$/],
]

const SEX = { Male: 'Мужской', Female: 'Женский' }

const SPECIES_RULES = [
  ['Бог', /\b(god|goddess|elder god|titan)\b/i],
  ['Призрак', /spectre|revenant|wraith|ghost/i],
  ['Киборг', /cyborg/i],
  ['Эденианец', /edenian/i],
  ['Таркатан', /tarkatan/i],
  ['Шокан', /shokan/i],
  ['Заурианец', /saurian|zaterran/i],
  ['Демон', /oni|demon|netherrealm/i],
  ['Кентавр', /centaur/i],
  ['Дракон', /dragon|draconic/i],
  ['Искусственный', /half-?breed|clone|hybrid|tarkatan-edenian|construct|soul/i],
  ['Человек', /human|earthrealmer/i],
]

const ORIGIN_RULES = [
  ['Земное царство', /earthrealm|japan|china|usa|united states|america|australia|mexico|korea/i],
  ['Внешний мир', /outworld/i],
  ['Эдения', /edenia/i],
  ['Преисподняя', /netherrealm/i],
  ['Небеса', /heavens|elder gods|sky temple/i],
  ['Хаосцарство', /chaosrealm/i],
  ['Орденцарство', /orderrealm/i],
  ['Мир Зетерры', /zaterra/i],
  ['Вампирий мир', /vaeternus/i],
]

const IMAGE_OVERRIDES = {
  'Kuai Liang': 'Sub-Zero MK11 render.png',
  'Bi-Han': 'Noob Saibot MK11 render.png',
}

const MALE = new Set(['Kung Lao', 'Kotal Kahn', 'Cyrax', 'Sektor', 'Takeda Takahashi'])

const DEBUT_OVERRIDES = { 'Kenshi Takahashi': 4, "Bo' Rai Cho": 4, Onaga: 5 }

const OVERRIDES = {
  'Bi-Han': { species: ['Призрак'], origin: 'Земное царство' },
  'Hanzo Hasashi': { species: ['Призрак'] },
  Ermac: { species: ['Искусственный'], origin: 'Внешний мир' },
  Mileena: { species: ['Искусственный'], origin: 'Внешний мир' },
  Reptile: { species: ['Заурианец'], origin: 'Мир Зетерры' },
  Raiden: { species: ['Бог'], origin: 'Небеса' },
  Fujin: { species: ['Бог'], origin: 'Небеса' },
  Shinnok: { species: ['Бог'], origin: 'Небеса' },
  Cetrion: { species: ['Бог'], origin: 'Небеса' },
  Kronika: { species: ['Бог'], origin: 'Небеса' },
  Geras: { species: ['Бог'], origin: 'Небеса' },
  Rain: { species: ['Эденианец', 'Бог'], origin: 'Эдения' },
  Onaga: { species: ['Дракон'], origin: 'Внешний мир' },
  Motaro: { species: ['Кентавр'], origin: 'Внешний мир' },
  Nitara: { species: ['Вампир'], origin: 'Вампирий мир' },
  Moloch: { species: ['Демон'], origin: 'Преисподняя' },
  Drahmin: { species: ['Демон'], origin: 'Преисподняя' },
  Ashrah: { species: ['Демон'], origin: 'Преисподняя' },
  Havik: { species: ['Хаосцарец'], origin: 'Хаосцарство' },
  Hotaru: { species: ['Орденцарец'], origin: 'Орденцарство' },
  'Quan Chi': { species: ['Демон'], origin: 'Преисподняя' },
  "D'Vorah": { species: ['Китинн'], origin: 'Внешний мир' },
  'Kotal Kahn': { species: ['Осх-Текк'], origin: 'Внешний мир' },
  Kollector: { species: ['Наккаданец'], origin: 'Внешний мир' },
  'Ferra & Torr': { species: ['Внешнемирец'], origin: 'Внешний мир' },
  Skarlet: { species: ['Искусственный'], origin: 'Внешний мир' },
  Sareena: { species: ['Демон'], origin: 'Преисподняя' },
  Tremor: { species: ['Человек'], origin: 'Земное царство' },
  Chameleon: { species: ['Заурианец'], origin: 'Мир Зетерры' },
  Khameleon: { species: ['Заурианец'], origin: 'Мир Зетерры' },
  'Shang Tsung': { species: ['Человек'], origin: 'Земное царство' },
  Kitana: { species: ['Эденианец'], origin: 'Эдения' },
  Jade: { species: ['Эденианец'], origin: 'Эдения' },
  Sindel: { species: ['Эденианец'], origin: 'Эдения' },
  Tanya: { species: ['Эденианец'], origin: 'Эдения' },
  Taven: { species: ['Бог'], origin: 'Эдения' },
  Daegon: { species: ['Бог'], origin: 'Эдения' },
  Blaze: { species: ['Бог'], origin: 'Эдения' },
  'Li Mei': { species: ['Внешнемирец'], origin: 'Внешний мир' },
  "Bo' Rai Cho": { species: ['Внешнемирец'], origin: 'Внешний мир' },
  'Shao Kahn': { species: ['Бог'], origin: 'Внешний мир' },
  Baraka: { species: ['Таркатан'], origin: 'Внешний мир' },
  Goro: { species: ['Шокан'], origin: 'Внешний мир' },
  Kintaro: { species: ['Шокан'], origin: 'Внешний мир' },
  Sheeva: { species: ['Шокан'], origin: 'Внешний мир' },
  Reiko: { species: ['Человек'], origin: 'Внешний мир' },
  'Erron Black': { species: ['Человек'], origin: 'Земное царство' },
  Cyrax: { species: ['Человек', 'Киборг'] },
  Sektor: { species: ['Человек', 'Киборг'] },
  Smoke: { species: ['Человек', 'Киборг'] },
  'Jax Briggs': { species: ['Человек', 'Киборг'] },
  Frost: { species: ['Человек', 'Киборг'] },
}

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

const firstTimeline = (raw) => {
  const parts = raw.split(/(?:'''\s*)?\d(?:<sup>)?(?:st|nd|rd)(?:<\/sup>)?\s*(?:&[^:]*)?Timelines?:?(?:\s*''')?/i)
  return (parts.length > 1 ? parts[1] : parts[0]) ?? ''
}

function debutIndex(text) {
  const links = [...field(text, 'Games').matchAll(/\[\[([^\]|]+)/g)].map((m) => m[1].trim())
  const indexes = links.map((l) => GAMES.findIndex(([, re]) => re.test(l))).filter((i) => i >= 0)
  return indexes.length ? Math.min(...indexes) : null
}

async function main() {
  await fs.mkdir(path.join(CACHE, 'img'), { recursive: true })
  await fs.mkdir(THUMBS, { recursive: true })
  await fs.mkdir(path.join(OUT_IMG, 'full'), { recursive: true })

  const titles = FIGHTERS.map(([t]) => t)
  const pages = await cachedJson(CACHE, 'pages.json', () => wikiPages(API, titles))
  const images = await cachedJson(CACHE, 'images.json', async () => {
    const res = await wikiQuery(API, titles, 'prop=pageimages&piprop=original')
    return Object.fromEntries(Object.entries(res).map(([t, p]) => [t, p.original?.source ?? null]))
  })
  const fixed = await cachedJson(CACHE, 'image-overrides.json', () => wikiImageUrls(API, Object.values(IMAGE_OVERRIDES)))

  const result = []
  await pool(FIGHTERS, 8, async ([title, nameEn, nameRu, answer, affiliations, alignment]) => {
    const page = pages[title]
    if (!page?.text) return console.warn('missing page', title)
    const override = IMAGE_OVERRIDES[title]
    const buf = await cachedDownload(path.join(CACHE, 'img'), override ? `${page.id}-fixed` : String(page.id), override ? [fixed[override]] : [images[title]])
    if (!buf) return console.warn('no image', title)
    try {
      await writeFullAndThumb(buf, path.join(OUT_IMG, 'full', `${page.id}.webp`), path.join(THUMBS, `${page.id}.webp`), 96)
    } catch (e) {
      return console.warn('image failed', title, e.message)
    }
    const debut = DEBUT_OVERRIDES[title] ?? debutIndex(page.text)
    if (debut === null) return console.warn('no debut', title)
    const speciesText = plain(firstTimeline(field(page.text, 'Species')))
    const originText = plain(firstTimeline(field(page.text, 'Origin')))
    const known = OVERRIDES[title] ?? {}
    const species = known.species ?? SPECIES_RULES.filter(([, re]) => re.test(speciesText)).map(([l]) => l).slice(0, 2)
    result.push({
      id: page.id,
      name: nameRu,
      nameEn,
      aliases: title !== nameEn ? title : undefined,
      gender: MALE.has(title) ? 'Мужской' : (SEX[plain(field(page.text, 'Gender')).trim()] ?? 'Другое'),
      species: species.length ? species : ['Человек'],
      affiliations: affiliations.length ? affiliations : ['Одиночка'],
      origin: known.origin ?? ORIGIN_RULES.find(([, re]) => re.test(originText))?.[0] ?? 'Земное царство',
      alignment,
      debut: GAMES[debut][0],
      debutIndex: debut,
      answer,
    })
  })

  dropDeleted(result, 'mk')

  onlyAnswers(result)
  result.sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  await writeAtlas(result, THUMBS, path.join(OUT_IMG, 'thumbs.webp'), OUT_ATLAS, 12, 96)
  await pruneImages(path.join(OUT_IMG, 'full'), result)
  await fs.writeFile(OUT_JSON, JSON.stringify(result, null, 1))
  console.log(`wrote ${result.length} fighters (${result.filter((c) => c.answer).length} answerable)`)
}

main()
