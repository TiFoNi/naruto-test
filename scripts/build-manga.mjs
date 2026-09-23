import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { ROOT, pruneImages, writeAtlas } from './lib.mjs'
import { dropDeleted, onlyAnswers } from './dropped.mjs'

const SEEDS = path.join(ROOT, 'seeds', 'manga')
const CACHE = path.join(ROOT, '.cache', 'manga')
const THUMBS = path.join(CACHE, 'thumb')
const OUT_IMG = path.join(ROOT, 'public', 'manga')
const OUT_JSON = path.join(ROOT, 'src', 'data', 'manga.json')
const OUT_ATLAS = path.join(ROOT, 'src', 'data', 'manga-atlas.json')

const TITLES = [
  ['one-piece', 'Ван Пис', 'One Piece', 'Эйитиро Ода', 1997, 'Сёнэн', 'Выходит'],
  ['naruto', 'Наруто', 'Naruto', 'Масаси Кисимото', 1999, 'Сёнэн', 'Завершена'],
  ['bleach', 'Блич', 'Bleach', 'Тайто Кубо', 2001, 'Сёнэн', 'Завершена'],
  ['dragon-ball', 'Драгон Болл', 'Dragon Ball', 'Акира Торияма', 1984, 'Сёнэн', 'Завершена'],
  ['death-note', 'Тетрадь смерти', 'Death Note', 'Цугуми Оба, Такэси Обата', 2003, 'Сёнэн', 'Завершена'],
  ['aot', 'Атака титанов', 'Attack on Titan', 'Хадзимэ Исаяма', 2009, 'Сёнэн', 'Завершена'],
  ['fma', 'Стальной алхимик', 'Fullmetal Alchemist', 'Хирому Аракава', 2001, 'Сёнэн', 'Завершена'],
  ['hxh', 'Хантер × Хантер', 'Hunter × Hunter', 'Ёсихиро Тогаси', 1998, 'Сёнэн', 'Выходит'],
  ['berserk', 'Берсерк', 'Berserk', 'Кэнтаро Миура', 1989, 'Сэйнэн', 'Выходит'],
  ['vagabond', 'Вагабонд', 'Vagabond', 'Такэхико Иноуэ', 1998, 'Сэйнэн', 'Выходит'],
  ['20th-century-boys', 'Дети 20-го века', '20th Century Boys', 'Наоки Урасава', 1999, 'Сэйнэн', 'Завершена'],
  ['vinland-saga', 'Сага о Винланде', 'Vinland Saga', 'Макото Юкимура', 2005, 'Сэйнэн', 'Выходит'],
  ['tokyo-ghoul', 'Токийский гуль', 'Tokyo Ghoul', 'Суй Исида', 2011, 'Сэйнэн', 'Завершена'],
  ['kny', 'Клинок, рассекающий демонов', 'Demon Slayer', 'Коёхару Готогэ', 2016, 'Сёнэн', 'Завершена'],
  ['jujutsu-kaisen', 'Магическая битва', 'Jujutsu Kaisen', 'Гэгэ Акутами', 2018, 'Сёнэн', 'Завершена'],
  ['chainsaw-man', 'Человек-бензопила', 'Chainsaw Man', 'Тацуки Фудзимото', 2018, 'Сёнэн', 'Выходит'],
  ['mha', 'Моя геройская академия', 'My Hero Academia', 'Кохэй Хорикоси', 2014, 'Сёнэн', 'Завершена'],
  ['jojo', 'ДжоДжо', "JoJo's Bizarre Adventure", 'Хирохико Араки', 1987, 'Сёнэн', 'Выходит'],
  ['slam-dunk', 'Слэм-данк', 'Slam Dunk', 'Такэхико Иноуэ', 1990, 'Сёнэн', 'Завершена'],
  ['one-punch-man', 'Ванпанчмен', 'One Punch Man', 'ONE, Юскэ Мурата', 2012, 'Сэйнэн', 'Выходит'],
  ['nana', 'Нана', 'Nana', 'Ай Ядзава', 2000, 'Сёдзё', 'Выходит'],
  ['sailor-moon', 'Сейлор Мун', 'Sailor Moon', 'Наоко Такэути', 1991, 'Сёдзё', 'Завершена'],
  ['punpun', 'Спокойной ночи, Пунпун', 'Oyasumi Punpun', 'Инио Асано', 2007, 'Сэйнэн', 'Завершена'],
  ['blame', 'Блэйм!', 'Blame!', 'Цутому Нихэй', 1997, 'Сэйнэн', 'Завершена'],
  ['gintama', 'Гинтама', 'Gintama', 'Хидэаки Сорати', 2003, 'Сёнэн', 'Завершена'],
  ['akira', 'Акира', 'Akira', 'Кацухиро Отомо', 1982, 'Сэйнэн', 'Завершена'],
  ['parasyte', 'Паразит', 'Parasyte', 'Хитоси Ивааки', 1988, 'Сэйнэн', 'Завершена'],
  ['dorohedoro', 'Дорохедоро', 'Dorohedoro', 'Кю Хаясида', 2000, 'Сэйнэн', 'Завершена'],
  ['ashita-no-joe', 'Завтрашний Джо', 'Ashita no Joe', 'Тэцуя Тиба', 1968, 'Сёнэн', 'Завершена'],
  ['hellsing', 'Хеллсинг', 'Hellsing', 'Кота Хирано', 1997, 'Сэйнэн', 'Завершена'],
  ['liar-game', 'Игра лжецов', 'Liar Game', 'Синобу Кайтани', 2005, 'Сэйнэн', 'Завершена'],
  ['witch-hat', 'Ателье колдовских колпаков', 'Witch Hat Atelier', 'Камомэ Сирахама', 2016, 'Сэйнэн', 'Выходит'],
  ['houseki', 'Страна самоцветов', 'Land of the Lustrous', 'Харуко Итикава', 2012, 'Сэйнэн', 'Завершена'],
  ['evangelion', 'Евангелион', 'Neon Genesis Evangelion', 'Ёсиюки Садамото', 1994, 'Сёнэн', 'Завершена'],
  ['beck', 'Бек', 'Beck', 'Харольд Сакуиси', 1999, 'Сёнэн', 'Завершена'],
  ['my-dearest-self', 'Моё дорогое я со злым умыслом', 'My Dearest Self with Malice Aforethought', 'Хадзимэ Инорю, Сёта Ито', 2020, 'Сёнэн', 'Завершена'],
  ['homunculus', 'Гомункул', 'Homunculus', 'Хидэо Ямамото', 2003, 'Сэйнэн', 'Завершена'],
  ['real', 'Реальность', 'Real', 'Такэхико Иноуэ', 1999, 'Сэйнэн', 'Выходит'],
  ['dungeon-meshi', 'Подземелье вкусностей', 'Delicious in Dungeon', 'Рёко Куи', 2014, 'Сэйнэн', 'Завершена'],
  ['yotsuba', 'Ёцуба!', 'Yotsuba&!', 'Киёхико Адзума', 2003, 'Сэйнэн', 'Выходит'],
  ['claymore', 'Клеймор', 'Claymore', 'Норихиро Яги', 2001, 'Сёнэн', 'Завершена'],
  ['jigokuraku', 'Адский рай', "Hell's Paradise", 'Юдзи Каку', 2018, 'Сёнэн', 'Завершена'],
  ['black-clover', 'Чёрный клевер', 'Black Clover', 'Юки Табата', 2015, 'Сёнэн', 'Выходит'],
  ['tomodachi-game', 'Игра друзей', 'Tomodachi Game', 'Микото Ямагути', 2013, 'Сёнэн', 'Выходит'],
  ['kokou-no-hito', 'Скалолаз', 'The Climber', 'Синъити Сакамото', 2007, 'Сэйнэн', 'Завершена'],
  ['ajin', 'Получеловек', 'Ajin', 'Гамон Сакураи', 2012, 'Сэйнэн', 'Завершена'],
  ['gantz', 'Ганц', 'Gantz', 'Хироя Оку', 2000, 'Сэйнэн', 'Завершена'],
  ['fire-punch', 'Огненный удар', 'Fire Punch', 'Тацуки Фудзимото', 2016, 'Сёнэн', 'Завершена'],
  ['fable', 'Басня', 'The Fable', 'Кацухиса Минами', 2014, 'Сэйнэн', 'Выходит'],
  ['kingdom', 'Царство', 'Kingdom', 'Ясухиса Хара', 2006, 'Сэйнэн', 'Выходит'],
]

const MANGADEX_IDS = {
  real: '62b74aa6-24df-4b91-b76d-39e7ab3c3ca5',
  evangelion: 'dc33209f-d9d4-40df-a468-cca047b63979',
  'liar-game': 'd8779116-f000-446a-af46-cc221c0e7fc9',
  claymore: 'be8fe64b-37da-4fba-b14d-603aba19be1f',
  jigokuraku: 'cb77e4a6-3921-43b9-9d64-7d78cd3205ce',
  ajin: '331deec0-fb1a-4680-9248-8a0fc55b5b07',
  'tomodachi-game': 'b35f67b6-bfb9-4cbd-86f0-621f37e6cb41',
  'witch-hat': '67e7453b-9ee5-4ae5-9316-215b03e4a71d',
  houseki: '37bf7574-641e-4665-b992-f2ba8d4652b8',
  beck: '4cf9b503-439a-48f7-9fc5-21831087a421',
  homunculus: '231d5196-1f41-4eba-af8d-841d40bc548d',
  'dungeon-meshi': 'd90ea6cb-7bc3-4d80-8af0-28557e6c4e17',
  yotsuba: '58be6aa6-06cb-4ca5-bd20-f1392ce451fb',
  'black-clover': 'e7eabe96-aa17-476f-b431-2497d5e9d060',
  'kokou-no-hito': 'bb8310e4-6050-4a43-984e-f7bbdfce23b1',
  gantz: 'f7268daa-9d63-4e3b-9d2a-97b85b39d0cd',
  'fire-punch': '6fef1f74-a0ad-4f0d-99db-d32a7cd24098',
  fable: '5209fe10-4a14-403f-8837-2ccf8cced253',
  fma: 'dd8a907a-3850-4f95-ba03-ba201a8399e3',
  'death-note': '75ee72ab-c6bf-4b87-badd-de839156934c',
  hxh: 'db692d58-4b13-4174-ae8c-30c515c0689c',
  jojo: '5ed1f8fc-a119-4cbc-aeae-26ce2bd3f838',
  dorohedoro: '34f45c13-2b78-4900-8af2-d0bb551101f4',
  'ashita-no-joe': '4ee5e960-6329-4e1d-b038-93e8e0d53589',
  hellsing: '6fcfaa0e-6023-403e-97f9-5301dd3c258c',
  naruto: 'a787b10a-02d0-46c0-8236-0d01d69ad4a3',
  parasyte: '6ee67785-4fd5-4f84-8be9-f448314777d0',
  'sailor-moon': '00148825-e802-456c-8cfd-e10ab05d58c6',
  bleach: '239d6260-d71f-43b0-afff-074e3619e3de',
  mha: '4f3bcae4-2d96-4c9d-932c-90181d9c873e',
  berserk: '801513ba-a712-498c-8f57-cae55b38cc92',
  punpun: '4301d363-ee02-43f4-ae24-4cbf29a74830',
  'one-piece': 'a1c7c817-4e59-43b7-9365-09675a149a6f',
  vagabond: 'd1a9fdeb-f713-407f-960c-8326b586e6fd',
  'slam-dunk': '319df2e2-e6a6-4e3a-a31c-68539c140a84',
}

const UA = { 'User-Agent': 'nandaguessr-build/1.0' }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function getJson(url) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers: UA }).catch(() => null)
    if (res?.ok) return res.json()
    await sleep(1500 * (attempt + 1))
  }
  return null
}

async function resolveId(slug, nameEn, year) {
  if (MANGADEX_IDS[slug]) return MANGADEX_IDS[slug]
  const search = await getJson(`https://api.mangadex.org/manga?title=${encodeURIComponent(nameEn)}&limit=5&order[relevance]=desc`)
  const list = search?.data ?? []
  const named = list.find((m) => {
    const titles = [m.attributes.title.en, ...(m.attributes.altTitles ?? []).map((t) => Object.values(t)[0])].filter(Boolean)
    return titles.some((t) => t.toLowerCase() === nameEn.toLowerCase())
  })
  return (named ?? list.find((m) => Math.abs((m.attributes.year ?? 0) - year) <= 1))?.id ?? null
}

async function coverUrl(id) {
  const list = await getJson(`https://api.mangadex.org/cover?manga[]=${id}&order[volume]=asc&limit=40`)
  const covers = list?.data ?? []
  const first =
    ['ja', 'en'].map((locale) => covers.find((c) => c.attributes.volume === '1' && c.attributes.locale === locale)).find(Boolean) ??
    covers.find((c) => c.attributes.volume === '1') ??
    covers[0]
  if (first) return `https://uploads.mangadex.org/covers/${id}/${first.attributes.fileName}`
  const manga = await getJson(`https://api.mangadex.org/manga/${id}?includes[]=cover_art`)
  const art = manga?.data?.relationships?.find((r) => r.type === 'cover_art')
  return art ? `https://uploads.mangadex.org/covers/${id}/${art.attributes.fileName}` : null
}

async function fetchCover(slug, nameEn, year) {
  const file = path.join(SEEDS, slug, 'cover.jpg')
  if (await fs.access(file).then(() => true, () => false)) return file
  const id = await resolveId(slug, nameEn, year)
  await sleep(1100)
  if (!id) return null
  const url = await coverUrl(id)
  await sleep(1100)
  if (!url) return null
  const res = await fetch(url, { headers: UA }).catch(() => null)
  if (!res?.ok) return null
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, Buffer.from(await res.arrayBuffer()))
  return file
}

const IMAGE = /\.(jpe?g|png|webp|gif|avif)$/i
const PAGE_WIDTH = 900
const PAGE_HEIGHT = 1300
const QUALITY = 86
const CELL = 96

async function pagesOf(slug) {
  const dir = path.join(SEEDS, slug)
  const files = (await fs.readdir(dir).catch(() => [])).filter((f) => IMAGE.test(f)).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
  const cover = files.find((f) => /^cover\./i.test(f))
  const pages = files.filter((f) => f !== cover)
  return { dir, cover, pages }
}

async function main() {
  await fs.mkdir(THUMBS, { recursive: true })
  await fs.mkdir(path.join(OUT_IMG, 'full'), { recursive: true })
  await fs.mkdir(path.join(OUT_IMG, 'pages'), { recursive: true })
  for (const [slug] of TITLES) await fs.mkdir(path.join(SEEDS, slug), { recursive: true })

  const result = []
  let missing = 0
  for (const [index, [slug, name, nameEn, author, year, demographic, status]] of TITLES.entries()) {
    const id = index + 1
    const { dir, cover, pages: found } = await pagesOf(slug)
    if (!found.length) missing++

    const fetched = cover ? null : await fetchCover(slug, nameEn, year)
    const fromPage = found.length > 1 && !cover && !fetched
    const pages = fromPage ? found.slice(1) : found

    const pageDir = path.join(OUT_IMG, 'pages', String(id))
    await fs.rm(pageDir, { recursive: true, force: true })
    if (pages.length) await fs.mkdir(pageDir, { recursive: true })

    for (const [i, file] of pages.entries()) {
      await sharp(path.join(dir, file))
        .resize({ width: PAGE_WIDTH, height: PAGE_HEIGHT, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: QUALITY })
        .toFile(path.join(pageDir, `${i + 1}.webp`))
    }

    const coverFile = cover ? path.join(dir, cover) : (fetched ?? (fromPage ? path.join(dir, found[0]) : null))
    if (coverFile) {
      const source = await sharp(coverFile).rotate().toBuffer()
      await sharp(source)
        .resize({ width: 800, height: 900, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: QUALITY })
        .toFile(path.join(OUT_IMG, 'full', `${id}.webp`))
      await sharp(source)
        .resize(CELL, CELL, { fit: 'cover', position: sharp.strategy.attention })
        .webp({ quality: QUALITY })
        .toFile(path.join(THUMBS, `${id}.webp`))
    }


    result.push({ id, slug, name, nameEn, author, year, demographic, status, pages: pages.length, answer: pages.length > 0 })
  }

  dropDeleted(result, 'manga')
  onlyAnswers(result)
  const withImages = result.filter((m) => m.pages > 0)
  if (withImages.length) {
    await writeAtlas(withImages, THUMBS, path.join(OUT_IMG, 'thumbs.webp'), OUT_ATLAS, 8, CELL)
    for (const manga of result) manga.thumb ??= 0
  } else {
    for (const manga of result) manga.thumb = 0
    await fs.writeFile(OUT_ATLAS, JSON.stringify({ cols: 1, rows: 1, cell: CELL }))
  }
  await pruneImages(path.join(OUT_IMG, 'full'), result)
  await fs.writeFile(OUT_JSON, JSON.stringify(result, null, 1))

  console.log(`wrote ${result.length} titles, ${withImages.length} with pages (${result.reduce((s, m) => s + m.pages, 0)} pages total)`)
  if (missing) console.log(`без картинок: ${missing} — поклади їх у seeds/manga/<slug>/ і запусти ще раз`)
}

main()
