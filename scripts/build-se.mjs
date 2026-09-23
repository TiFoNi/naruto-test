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
  wikiPages,
  wikiQuery,
  writeAtlas,
  writeFullAndThumb,
} from './lib.mjs'
import { transliterate } from './ru.mjs'
import { dropDeleted } from './dropped.mjs'

const API = 'https://souleater.fandom.com/api.php'
const CACHE = path.join(ROOT, '.cache', 'se')
const THUMBS = path.join(CACHE, 'thumb')
const OUT_IMG = path.join(ROOT, 'public', 'se')
const OUT_JSON = path.join(ROOT, 'src', 'data', 'se.json')
const OUT_ATLAS = path.join(ROOT, 'src', 'data', 'se-atlas.json')
const ANSWER_POOL_SIZE = 50
const KEEP = 65

const ARCS = [
  [0, 'Пролог'],
  [1, 'Особые уроки'],
  [9, 'Чёрный дракон'],
  [16, 'Предатели'],
  [29, 'Фестиваль смерти'],
  [45, 'Операция «Баба-яга»'],
  [63, 'Книга Эйбона'],
  [82, 'Безумная кровь'],
  [91, 'Война на Луне'],
]

const SPECIES_RULES = [
  ['Человек', /^Category:Human$/],
  ['Ведьма', /^Category:Witch$/],
  ['Колдун', /^Category:Sorcerer$/],
  ['Бог смерти', /^Category:(Death God|Grim Reaper)$/],
  ['Демон', /^Category:Demon$/],
  ['Великий древний', /^Category:Great Old One$/],
  ['Истинный бог', /^Category:True God$/],
  ['Яйцо кишина', /^Category:Kishin Egg$/],
  ['Искусственное создание', /^Category:(Artificial Creation|Golem)$/],
  ['Оборотень', /^Category:Werewolf$/],
]

const ROLE_RULES = [
  ['Мастер', /^Category:Meister$/],
  ['Оружие', /^Category:Demon Weapon$/],
]

const AFFILIATION_RULES = [
  ['Шибусэн', /^Category:DWMA$/],
  ['Класс EAT', /^Category:EAT Class$/],
  ['Класс NOT', /^Category:NOT Class$/],
  ['Спартой', /^Category:Spartoi$/],
  ['Орден ведьм', /^Category:Witch Order$/],
  ['Арахнофобия', /^Category:Arachnophobia$/],
  ['Банда Ноя', /^Category:Noah's (Gang|Group)$/],
  ['Фракция Медузы', /^Category:Medusa's Faction$/],
  ['Оружие Смерти', /^Category:Death's Weapon$/],
  ['Разведка Шибусэна', /^Category:DWMA-CIA$/],
  ['Легионы Жнеца', /^Category:Eight Reaper Legions$/],
]

const SKIP_CATEGORIES = /^Category:(Non Canon|Bones Continuity|Soul Eater GAIDEN|Soul Eater Gaiden Characters|Mention-Only|Soul Eater NOT! Characters)$/

const EXCLUDE = new Set([
  'Greatest Old One of Power',
  'Great Old One of Power',
  'Table of Contents',
  'Little Ogre',
  'Black Clown',
  'Purple Clown',
  'Tsar Pushka',
  'Succubus',
  'Fisherking',
  'Dengu Dinga',
  'Hemming',
  'Three Body Merge Mizune',
  'Five Body Merge Mizune',
  'Oldest Golem',
  "Giriko's Descendant",
  'Wrath of the Pharoh',
  'White Rabbit',
  'Brush-san',
  'Zukun',
  'Sonson-J',
  'Thompson mother',
  'Heming',
  "Chupa♡Cabra's bartender",
  'Mizune (eldest daughter)',
  'Noah (Lust)',
  'Noah (Envy)',
  'Al Capone',
  'Alexandre',
  'Zubaidah',
  'Rasputin',
  'Auntie',
  'Taruho Firefly',
  'Tabatha Butterfly',
  'Librarian',
  'Little Bunny',
  'Lupin',
  'Pig',
  'Ryoku',
  'Vajra',
  'Carpenter Gen',
  'Thompson Mother',
  'Unknown Prisoner',
  "Chupa♡Cabra's Bartender",
  'Ahab',
  "Ahab's Meister",
])

const NAMES = {
  'Maka Albarn': 'Мака Альбарн',
  'Soul Evans': 'Соул Эванс',
  'Black☆Star': 'Блэк☆Стар',
  'Tsubaki Nakatsukasa': 'Цубаки Накацукаса',
  'Death the Kid': 'Смерть-Кид',
  'Liz Thompson': 'Лиз Томпсон',
  'Patty Thompson': 'Патти Томпсон',
  'Franken Stein': 'Франкен Штейн',
  'Spirit Albarn': 'Спирит Альбарн',
  Death: 'Шинигами',
  'Sid Barrett': 'Сид Барретт',
  'Marie Mjolnir': 'Мари Мьёльнир',
  'Medusa Gorgon': 'Медуза Горгон',
  'Arachne Gorgon': 'Арахна Горгон',
  'Shaula Gorgon': 'Шаула Горгон',
  Crona: 'Крона',
  Ragnarok: 'Рагнарёк',
  Asura: 'Асура',
  Excalibur: 'Экскалибур',
  'Eruka Frog': 'Эрука Фрог',
  Mizune: 'Мизунэ',
  Free: 'Фри',
  'Mifune': 'Мифунэ',
  'Angela Leon': 'Анджела Леон',
  'Kim Diehl': 'Ким Диль',
  'Jacqueline O. Lantern Dupré': 'Жаклин Дюпре',
  'Ox Ford': 'Окс Форд',
  'Harvar D. Éclair': 'Харвар Эклер',
  'Kilik Rung': 'Килик Рун',
  'Pot of Fire': 'Горшок Огня',
  'Pot of Thunder': 'Горшок Грома',
  'Justin Law': 'Джастин Ло',
  'Tezca Tlipoca': 'Тескатлипока',
  'Azusa Yumi': 'Адзуса Юми',
  'Naigus Mira': 'Мира Найгус',
  'Mira Naigus': 'Мира Найгус',
  'Blair': 'Блэр',
  'Giriko': 'Гирико',
  'Mosquito': 'Москит',
  'Noah': 'Ной',
  'Gopher': 'Гофер',
  'Little Demon': 'Маленький демон',
  'Maka\'s Mother': 'Мать Маки',
  'Wes Law': 'Уэс Эванс',
  'Clown': 'Клоун',
  'Flying Dutchman': 'Летучий Голландец',
  'Sonson J. C.': 'Сон Сон',
  'Kilik': 'Килик',
  'Marie': 'Мари',
  'Stein': 'Штейн',
  'Rachel Boyd': 'Рэйчел Бойд',
  'Fire and Thunder': 'Огонь и Гром',
  'Arachnophobia': 'Арахнофобия',
  'White Star': 'Уайт Стар',
  'Masamune Nakatsukasa': 'Масамунэ Накацукаса',
  'Enrique': 'Энрике',
  'Lord Death': 'Шинигами',
  'Eibon': 'Эйбон',
  'Nygus': 'Найгус',
  'Elizabeth Thompson': 'Лиз Томпсон',
  'Patricia Thompson': 'Патти Томпсон',
  'Kirikou Rung': 'Килик Рун',
  'Kimial Diehl': 'Ким Диль',
  "Jacqueline O'Lantern Dupre": 'Жаклин Дюпре',
  'Mizune (mother)': 'Мизунэ',
  'Noah (Greed)': 'Ной',
  'Wes Evans': 'Уэс Эванс',
  'Sonson J. C.': 'Сон Сон',
  'Jacqueline O-Lantern Dupré': 'Жаклин Дюпре',
  'Harvar Eclair': 'Харвар Эклер',
  'Thunder': 'Горшок Грома',
  'Fire': 'Горшок Огня',
  'Joe Buttataki': 'Джо Буттатаки',
  'Hero': 'Хиро',
  'White☆Star': 'Уайт☆Стар',
  'Mabaa': 'Мабаа',
  'Feodor': 'Фёдор',
  'Jinn Galland': 'Джинн Галланд',
  'Mizune': 'Мизунэ',
  'Free': 'Фри',
  'Mifune': 'Мифунэ',
  'Eruka Frog': 'Эрука Фрог',
  'Tsubaki Nakatsukasa': 'Цубаки Накацукаса',
  'Rachel Boyd': 'Рэйчел Бойд',
}

const keepTemplates = (value) => value.replace(/\{\{c\|[^{}]*\}\}/gi, '').replace(/\{\{([^|{}]+)\}\}/g, '$1')

function genderOf(cats, text) {
  if (cats.includes('Category:Female')) return 'Женский'
  if (cats.includes('Category:Male')) return 'Мужской'
  const sex = plain(keepTemplates(field(text, 'sex')))
  if (/female/i.test(sex)) return 'Женский'
  if (/male/i.test(sex)) return 'Мужской'
  return 'Неизвестно'
}

function affiliationsOf(cats) {
  const found = matchRules(AFFILIATION_RULES, cats)
  if (found.some((a) => a !== 'Шибусэн' && a !== 'Орден ведьм' && a !== 'Арахнофобия') && !found.includes('Шибусэн')) {
    const school = ['Класс EAT', 'Класс NOT', 'Спартой', 'Разведка Шибусэна', 'Оружие Смерти', 'Легионы Жнеца']
    if (found.some((a) => school.includes(a))) found.unshift('Шибусэн')
  }
  return found.length ? found : ['Сами по себе']
}

const matchRules = (rules, values) => rules.filter(([, re]) => values.some((v) => re.test(v))).map(([label]) => label)

function field(text, name) {
  const start = text.match(new RegExp(`\\|\\s*${name}\\s*=`, 'i'))
  if (!start) return ''
  let i = start.index + start[0].length
  let square = 0
  let curly = 0
  const from = i
  for (; i < text.length; i++) {
    const pair = text.slice(i, i + 2)
    if (pair === '[[') square++, i++
    else if (pair === ']]') square--, i++
    else if (pair === '{{') curly++, i++
    else if (pair === '}}') {
      if (curly === 0) break
      curly--, i++
    } else if (text[i] === '|' && square === 0 && curly === 0) break
  }
  return text.slice(from, i).trim()
}

const DEBUT_OVERRIDES = {
  'Medusa Gorgon': 1,
  'Arachne Gorgon': 30,
  'Patricia Thompson': 0,
  'Shaula Gorgon': 74,
  'Tezca Tlipoca': 57,
  'Enrique': 57,
}

function debutChapter(text, name) {
  if (DEBUT_OVERRIDES[name] !== undefined) return DEBUT_OVERRIDES[name]
  const lines = plain(field(text, 'debut').replace(/\{\{c\|[^{}]*\}\}/gi, ''))
    .split('\n')
    .map((l) => l.replace(/^\s*\*+\s*/, '').trim())
    .filter((l) => l && !/\(NOT!?\)|Monotone Princess|Soul Eater NOT/i.test(l))
  for (const line of lines) {
    if (/(?:Prologue|Chapter 0\.)\s*#?\s*\d+/i.test(line)) return 0
    const chapter = line.match(/Chapter (\d+)/i)
    if (chapter) return Number(chapter[1])
  }
  return null
}

const arcIndexOf = (chapter) => ARCS.reduce((idx, [start], i) => (chapter >= start ? i : idx), 0)

async function main() {
  await fs.mkdir(path.join(CACHE, 'img'), { recursive: true })
  await fs.mkdir(THUMBS, { recursive: true })
  await fs.mkdir(path.join(OUT_IMG, 'full'), { recursive: true })

  const names = (
    await cachedJson(CACHE, 'members2.json', async () => [
      ...new Set(
        (
          await Promise.all(
            ['Character', 'Male', 'Female', 'Unknown Sex', 'Human', 'Witch', 'Demon Weapon', 'Meister', 'Death God', 'Sorcerer', 'Great Old One', 'Kishin Egg'].map(
              (c) => categoryMembers(API, c),
            ),
          )
        ).flat(),
      ),
    ])
  ).filter((n) => !n.includes('/'))
  const pages = await cachedJson(CACHE, 'pages.json', () => wikiPages(API, names))
  const candidates = names.filter((n) => !EXCLUDE.has(n) && pages[n]?.text && /\{\{Character infobox/i.test(pages[n].text) && debutChapter(pages[n].text, n) !== null)
  const categories = await cachedJson(CACHE, 'categories.json', async () => {
    const res = await wikiQuery(API, candidates, 'prop=categories&cllimit=500')
    return Object.fromEntries(Object.entries(res).map(([t, p]) => [t, (p.categories ?? []).map((c) => c.title)]))
  })
  const images = await cachedJson(CACHE, 'images.json', async () => {
    const res = await wikiQuery(API, candidates, 'prop=pageimages&piprop=original')
    return Object.fromEntries(Object.entries(res).map(([t, p]) => [t, p.original?.source ?? null]))
  })

  const result = []
  await pool(candidates, 8, async (name) => {
    const { id, text, ru, length } = pages[name]
    const cats = categories[name] ?? []
    if (cats.some((c) => SKIP_CATEGORIES.test(c))) return
    if (!cats.some((c) => /^Category:(Character|Human|Witch|Sorcerer|Demon Weapon|Meister|Death God|Great Old One|Kishin Egg)$/.test(c))) return
    if (cats.includes('Category:Creatures in the Book of Eibon')) return
    const buf = await cachedDownload(path.join(CACHE, 'img'), String(id), [images[name]])
    if (!buf) return console.warn('no image', name)
    try {
      await writeFullAndThumb(buf, path.join(OUT_IMG, 'full', `${id}.webp`), path.join(THUMBS, `${id}.webp`), 96)
    } catch (e) {
      return console.warn('image failed', name, e.message)
    }
    const arcIndex = arcIndexOf(debutChapter(text, name))
    const species = matchRules(SPECIES_RULES, cats)
    result.push({
      id,
      name: NAMES[name] ?? ruName(name, ru, transliterate),
      nameEn: name.replace(/\s*\([^)]*\)$/, ''),
      gender: genderOf(cats, text),
      species: species.length ? species : ['Человек'],
      role: matchRules(ROLE_RULES, cats)[0] ?? 'Нет',
      affiliations: affiliationsOf(cats),
      side: cats.includes('Category:Antagonist') ? 'Злодей' : cats.includes('Category:Protagonists') ? 'Герой' : 'Нейтралитет',
      status: cats.includes('Category:Deceased') ? 'Мёртв' : 'Жив',
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
  dropDeleted(result, 'se')
  result.sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  await writeAtlas(result, THUMBS, path.join(OUT_IMG, 'thumbs.webp'), OUT_ATLAS, 12, 96)
  await pruneImages(path.join(OUT_IMG, 'full'), result)
  await fs.writeFile(OUT_JSON, JSON.stringify(result, null, 1))
  console.log(`wrote ${result.length} characters (${result.filter((c) => c.answer).length} answerable)`)
}

main()
