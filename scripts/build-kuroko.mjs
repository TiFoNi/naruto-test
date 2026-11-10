import fs from 'node:fs/promises'
import path from 'node:path'
import { PUBLIC, ROOT, cachedJson, pickPicture, pool, pruneImages, wikiQuery, writeAtlas, writeFullAndThumb } from './lib.mjs'
import { anilistPictures, nameKey } from './anilist.mjs'

const API = 'https://kurokonobasuke.fandom.com/api.php'
const ANILIST = [11771, 16894, 20725]
const CACHE = path.join(ROOT, '.cache', 'kuroko')
const THUMBS = path.join(CACHE, 'thumb')
const OUT_IMG = path.join(PUBLIC, 'kuroko')
const OUT_JSON = path.join(ROOT, 'packages', 'game', 'data', 'kuroko.json')
const OUT_ATLAS = path.join(ROOT, 'packages', 'game', 'data', 'kuroko-atlas.json')

const M = 'Мужской'
const F = 'Женский'

const SEIRIN = 'Сейрин'
const TEIKO = 'Тейко'
const TOO = 'Тоо'
const KAIJO = 'Кайджо'
const SHUTOKU = 'Шутоку'
const YOSEN = 'Ёсен'
const RAKUZAN = 'Ракузан'
const KIRISAKI = 'Кирисаки Даичи'
const SHINKYO = 'Шинкё'
const SEIHO = 'Сейхо'
const FUKUDA = 'Фукуда Сого'
const MEIKO = 'Мейко'
const JOSEI = 'Джосей'
const SHOEI = 'Шоэй'

const PG = 'Разыгрывающий'
const SG = 'Атакующий защитник'
const SF = 'Лёгкий форвард'
const PF = 'Тяжёлый форвард'
const C = 'Центровой'
const COACH = 'Тренер'
const MANAGER = 'Менеджер'

const MIRACLES = 'Поколение чудес'
const UNCROWNED = 'Некоронованные короли'
const NONE = 'Нет'

const CHARACTERS = [
  ['Tetsuya Kuroko', 'Tetsuya Kuroko', 'Тецуя Куроко', 'Тецуя Куроко', M, [SEIRIN, TEIKO], [PG, SF], 168, MIRACLES, 1, 'Тэцуя'],
  ['Taiga Kagami', 'Taiga Kagami', 'Тайга Кагами', 'Тайґа Каґамі', M, [SEIRIN], PF, 190, NONE, 1],
  ['Daiki Aomine', 'Daiki Aomine', 'Дайки Аомине', 'Дайкі Аоміне', M, [TOO, TEIKO], PF, 192, MIRACLES, 13, 'Аоминэ'],
  ['Seijūrō Akashi', 'Seijuurou Akashi', 'Сейджуро Акаши', 'Сейджюро Акаші', M, [RAKUZAN, TEIKO], PG, 173, MIRACLES, 38, 'Сэйдзюро Акаси Сейдзюро'],
  ['Ryōta Kise', 'Ryouta Kise', 'Рёта Кисе', 'Рьота Кісе', M, [KAIJO, TEIKO], SF, 189, MIRACLES, 2, 'Рета Кисэ'],
  ['Shintarō Midorima', 'Shintarou Midorima', 'Шинтаро Мидорима', 'Шінтаро Мідоріма', M, [SHUTOKU, TEIKO], SG, 195, MIRACLES, 4, 'Синтаро'],
  ['Atsushi Murasakibara', 'Atsushi Murasakibara', 'Ацуши Мурасакибара', 'Ацуші Мурасакібара', M, [YOSEN, TEIKO], C, 208, MIRACLES, 26, 'Ацуси'],
  ['Satsuki Momoi', 'Satsuki Momoi', 'Сацуки Момои', 'Сацукі Момої', F, [TOO, TEIKO], MANAGER, 161, NONE, 13],
  ['Teppei Kiyoshi', 'Teppei Kiyoshi', 'Теппей Киёши', 'Теппей Кійоші', M, [SEIRIN, SHOEI], C, 193, UNCROWNED, 19, 'Киеси Киёси'],
  ['Kazunari Takao', 'Kazunari Takao', 'Казунари Такао', 'Казунарі Такао', M, [SHUTOKU], PG, 176, NONE, 4, 'Кадзунари'],
  ['Junpei Hyūga', 'Junpei Hyuuga', 'Джунпей Хьюга', 'Джюнпей Хюґа', M, [SEIRIN], SG, 178, NONE, 1, 'Дзюмпэй Хюга'],
  ['Riko Aida', 'Riko Aida', 'Рико Аида', 'Ріко Аіда', F, [SEIRIN], COACH, 156, NONE, 1],
  ['Shun Izuki', 'Shun Izuki', 'Шун Изуки', 'Шюн Ідзукі', M, [SEIRIN], PG, 174, NONE, 1, 'Сюн Идзуки'],
  ['Yukio Kasamatsu', 'Yukio Kasamatsu', 'Юкио Касамацу', 'Юкіо Касамацу', M, [KAIJO], PG, 178, NONE, 3],
  ['Shinji Koganei', 'Shinji Koganei', 'Шинджи Коганей', 'Шінджі Коґаней', M, [SEIRIN], SF, 170, NONE, 1, 'Синдзи'],
  ['Tatsuya Himuro', 'Tatsuya Himuro', 'Тацуя Химуро', 'Тацуя Хімуро', M, [YOSEN], SG, 183, NONE, 26],
  ['Shoichi Imayoshi', 'Shouichi Imayoshi', 'Шоичи Имаёши', 'Шьоічі Імайоші', M, [TOO], PG, 180, NONE, 14, 'Сёити Имаёси'],
  ['Rinnosuke Mitobe', 'Rinnosuke Mitobe', 'Ринносуке Митобе', 'Рінносуке Мітобе', M, [SEIRIN], [C, PF], 186, NONE, 1],
  ['Alexandra Garcia', 'Alexandra Garcia', 'Александра Гарсия', 'Александра Гарсія', F, [], COACH, 180, NONE, 44, 'Алекс'],
  ['Makoto Hanamiya', 'Makoto Hanamiya', 'Макото Ханамия', 'Макото Ханамія', M, [KIRISAKI], PG, 179, UNCROWNED, 29],
  ['Ryō Sakurai', 'Ryou Sakurai', 'Рё Сакураи', 'Рьо Сакураї', M, [TOO], SG, 175, NONE, 14],
  ['Kōsuke Wakamatsu', 'Kousuke Wakamatsu', 'Косуке Вакамацу', 'Косуке Вакамацу', M, [TOO], C, 193, NONE, 14],
  ['Katsunori Harasawa', 'Katsunori Harasawa', 'Кацунори Харасава', 'Кацунорі Харасава', M, [TOO], COACH, 187, NONE, 16],
  ['Kotarō Hayama', 'Kotarou Hayama', 'Котаро Хаяма', 'Котаро Хаяма', M, [RAKUZAN], SF, 180, UNCROWNED, 54],
  ['Kōki Furihata', 'Kouki Furihata', 'Коки Фурихата', 'Кокі Фуріхата', M, [SEIRIN], PG, 170, NONE, 1],
  ['Kagetora Aida', 'Kagetora Aida', 'Кагетора Аида', 'Каґетора Аіда', M, [SEIRIN], COACH, 181, NONE, 2],
  ['Chihiro Mayuzumi', 'Chihiro Mayuzumi', 'Чихиро Маюзуми', 'Чіхіро Маюдзумі', M, [RAKUZAN], PF, 182, NONE, 54, 'Тихиро Маюдзуми'],
  ['Kazuya Hara', 'Kazuya Hara', 'Казуя Хара', 'Казуя Хара', M, [KIRISAKI], PF, 188, NONE, 29],
  ['Mitsuhiro Hayakawa', 'Mitsuhiro Hayakawa', 'Мицухиро Хаякава', 'Міцухіро Хаякава', M, [KAIJO], PF, 185, NONE, 3],
  ['Shōgo Haizaki', 'Shougo Haizaki', 'Шого Хайзаки', 'Шьоґо Хайдзакі', M, [FUKUDA, TEIKO], SF, 188, NONE, 50, 'Сёго Хайдзаки'],
  ['Shūzō Nijimura', 'Shuuzou Nijimura', 'Шузо Ниджимура', 'Шюдзо Ніджімура', M, [TEIKO], PF, 179, NONE, 63, 'Сюдзо Нидзимура'],
  ['Reo Mibuchi', 'Reo Mibuchi', 'Рео Мибучи', 'Рео Мібучі', M, [RAKUZAN], SG, 188, UNCROWNED, 54, 'Мибути'],
  ['Yoshitaka Moriyama', 'Yoshitaka Moriyama', 'Ёшитака Морияма', 'Йошітака Моріяма', M, [KAIJO], SG, 181, NONE, 3],
  ['Kiyoshi Miyaji', 'Kiyoshi Miyaji', 'Киёши Мияджи', 'Кійоші Міяджі', M, [SHUTOKU], SF, 191, NONE, 7],
  ['Papa Mbaye Siki', 'Papa Mbai Siki', 'Папа Мбай Сики', 'Папа Мбай Сікі', M, [SHINKYO], C, 200, NONE, 6],
  ['Taisuke Ōtsubo', 'Taisuke Ootsubo', 'Тайсуке Оцубо', 'Тайсуке Оцубо', M, [SHUTOKU], C, 198, NONE, 7],
  ['Eikichi Nebuya', 'Eikichi Nebuya', 'Эйкичи Нэбуя', 'Ейкічі Небуя', M, [RAKUZAN], C, 190, UNCROWNED, 54],
  ['Tomoki Tsugawa', 'Tomoki Tsugawa', 'Томоки Цугава', 'Томокі Цуґава', M, [SEIHO], SG, 180, NONE, 8],
  ['Masako Araki', 'Masako Araki', 'Масако Араки', 'Масако Аракі', F, [YOSEN], COACH, 170, NONE, 45],
  ['Satoshi Tsuchida', 'Satoshi Tsuchida', 'Сатоши Цучида', 'Сатоші Цучіда', M, [SEIRIN], PF, 176, NONE, 1],
  ['Kōichi Kawahara', 'Kouichi Kawahara', 'Коичи Кавахара', 'Коічі Кавахара', M, [SEIRIN], SF, 175, NONE, 1],
  ['Hiroshi Fukuda', 'Hiroshi Fukuda', 'Хироши Фукуда', 'Хіроші Фукуда', M, [SEIRIN], C, 180, NONE, 1],
  ['Ryūhei Kasuga', 'Ryuuhei Kasuga', 'Рюхей Касуга', 'Рюхей Касуґа', M, [SEIHO], PG, 179, NONE, 8],
  ['Genta Takeuchi', 'Genta Takeuchi', 'Гента Такеучи', 'Ґента Такеучі', M, [KAIJO], COACH, 173, NONE, 3],
  ['Wei Liu', 'Wei Liu', 'Вэй Лю', 'Вей Лю', M, [YOSEN], SF, 203, NONE, 45],
  ['Kensuke Fukui', 'Kensuke Fukui', 'Кенсуке Фукуи', 'Кенсуке Фукуї', M, [YOSEN], PG, 176, NONE, 45],
  ['Shigehiro Ogiwara', 'Ogiwara Shigehiro', 'Шигехиро Огивара', 'Шіґехіро Оґівара', M, [MEIKO], SF, 177, NONE, 64],
  ['Tsutomu Iwamura', 'Tsutomu Iwamura', 'Цутому Ивамура', 'Цутому Івамура', M, [SEIHO], C, 187, NONE, 8],
  ['Kōji Kobori', 'Hiroshi Kobori', 'Коджи Кобори', 'Коджі Коборі', M, [KAIJO], C, 192, NONE, 3],
  ['Kōjirō Furuhashi', 'Koujirou Furuhashi', 'Коджиро Фурухаши', 'Коджіро Фурухаші', M, [KIRISAKI], SF, 186, NONE, 29],
  ['Kentarō Seto', 'Kentarou Seto', 'Кентаро Сето', 'Кентаро Сето', M, [KIRISAKI], C, 190, NONE, 29],
  ['Daisuke Narumi', 'Daisuke Narumi', 'Дайсуке Наруми', 'Дайсуке Нарумі', M, [JOSEI], C, 194, NONE, 28],
  ['Kenichi Okamura', 'Kenichi Okamura', 'Кеничи Окамура', 'Кенічі Окамура', M, [YOSEN], PF, 200, NONE, 45],
  ['Hideki Ishida', 'Hideki Ishida', 'Хидеки Ишида', 'Хідекі Ішіда', M, [FUKUDA], PG, 180, NONE, 52],
  ['Kazuhiro Mochizuki', 'Kazuhiro Mochizuki', 'Казухиро Мочизуки', 'Казухіро Мочідзукі', M, [FUKUDA], SG, 183, NONE, 52],
  ['Kōzō Shirogane', 'Kouzou Shirogane', 'Кодзо Широгане', 'Кодзо Шіроґане', M, [TEIKO], COACH, 176, NONE, 64],
]

async function main() {
  await fs.mkdir(path.join(CACHE, 'img'), { recursive: true })
  await fs.mkdir(THUMBS, { recursive: true })
  await fs.mkdir(path.join(OUT_IMG, 'full'), { recursive: true })

  const titles = CHARACTERS.map(([title]) => title)
  const pages = await cachedJson(CACHE, 'pages.json', async () => {
    const res = await wikiQuery(API, titles, 'prop=info')
    return Object.fromEntries(Object.entries(res).map(([title, page]) => [title, { id: page.pageid ?? null }]))
  })
  const missing = titles.filter((title) => !pages[title]?.id)
  if (missing.length) throw new Error(`немає сторінок: ${missing.join(', ')}`)

  const portraits = await cachedJson(CACHE, 'anilist.json', async () => Object.fromEntries(await anilistPictures(ANILIST)))

  const result = []
  await pool(CHARACTERS, 6, async ([title, anilistName, name, nameUk, gender, teams, position, height, group, episode, aliases]) => {
    const { id } = pages[title]
    const portrait = portraits[nameKey(anilistName)]
    if (!portrait) throw new Error(`немає портрета AniList: ${anilistName}`)
    const buf = await pickPicture(path.join(CACHE, 'img'), String(id), [portrait])
    if (!buf) throw new Error(`не завантажилась картинка: ${title}`)
    await writeFullAndThumb(buf, path.join(OUT_IMG, 'full', `${id}.webp`), path.join(THUMBS, `${id}.webp`), 96)
    result.push({
      id,
      name,
      nameUk,
      nameEn: title,
      ...(aliases ? { aliases } : {}),
      gender,
      teams: teams.length ? teams : ['Без команды'],
      position: [position].flat(),
      height,
      group,
      episode,
      answer: true,
    })
  })

  result.sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  await writeAtlas(result, THUMBS, path.join(OUT_IMG, 'thumbs.webp'), OUT_ATLAS, 10, 96)
  await pruneImages(path.join(OUT_IMG, 'full'), result)
  await fs.writeFile(OUT_JSON, JSON.stringify(result, null, 1))
  console.log(`wrote ${result.length} characters`)
}

main()
