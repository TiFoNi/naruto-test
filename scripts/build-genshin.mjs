import fs from 'node:fs/promises'
import path from 'node:path'
import { PUBLIC, ROOT, cachedDownload, cachedJson, getJson, pool, pruneImages, writeAtlas, writeFullAndThumb } from './lib.mjs'

const API = 'https://gi.yatta.moe/api/v2'
const ASSETS = 'https://gi.yatta.moe/assets/UI'
const CACHE = path.join(ROOT, '.cache', 'genshin')
const THUMBS = path.join(CACHE, 'thumb')
const OUT_IMG = path.join(PUBLIC, 'genshin')
const OUT_JSON = path.join(ROOT, 'packages', 'game', 'data', 'genshin.json')
const OUT_ATLAS = path.join(ROOT, 'packages', 'game', 'data', 'genshin-atlas.json')
const LIMIT = Number(process.env.LIMIT) || 0

const ELEMENTS = {
  Wind: 'Анемо',
  Rock: 'Гео',
  Electric: 'Электро',
  Grass: 'Дендро',
  Water: 'Гидро',
  Fire: 'Пиро',
  Ice: 'Крио',
}

const WEAPONS = {
  WEAPON_SWORD_ONE_HAND: 'Меч',
  WEAPON_CLAYMORE: 'Двуручный меч',
  WEAPON_POLE: 'Копьё',
  WEAPON_CATALYST: 'Катализатор',
  WEAPON_BOW: 'Лук',
}

const REGIONS = {
  MONDSTADT: 'Мондштадт',
  LIYUE: 'Ли Юэ',
  INAZUMA: 'Инадзума',
  SUMERU: 'Сумеру',
  FONTAINE: 'Фонтейн',
  NATLAN: 'Натлан',
  NODKRAI: 'Нод-Край',
  NODKRAI_ZIBAI: 'Нод-Край',
  SNEZHNAYA: 'Снежная',
  SNEZHNAYA_STAR: 'Снежная',
  FATUI: 'Фатуи',
  OMNI_SCOURGE: 'Бездна',
  RANGER: 'Иной мир',
}

const GENDERS = { BOY: 'Мужской', MALE: 'Мужской', GIRL: 'Женский', LADY: 'Женский', LOLI: 'Женский' }

const splashOf = (icon) => icon.replace('UI_AvatarIcon_', 'UI_Gacha_AvatarImg_')

async function main() {
  await fs.mkdir(path.join(OUT_IMG, 'full'), { recursive: true })
  await fs.mkdir(THUMBS, { recursive: true })

  const [en, ru] = await Promise.all([
    cachedJson(CACHE, 'en.json', () => getJson(`${API}/en/avatar`)),
    cachedJson(CACHE, 'ru.json', () => getJson(`${API}/ru/avatar`)),
  ])

  const names = Object.fromEntries(Object.values(ru.data.items).map((one) => [one.id, one.name]))
  const now = Date.now() / 1000
  const list = Object.values(en.data.items)
    .filter((one) => one.region !== 'MAINACTOR' && ELEMENTS[one.element] && (one.release ?? 0) <= now)
    .sort((one, two) => (one.release ?? 0) - (two.release ?? 0))

  const picked = LIMIT ? list.slice(0, LIMIT) : list
  const result = []

  await pool(picked, 8, async (one) => {
    const id = one.id
    const splash = await cachedDownload(path.join(CACHE, 'img'), `${id}-splash`, [`${ASSETS}/${splashOf(one.icon)}.png`])
    const icon = await cachedDownload(path.join(CACHE, 'img'), `${id}-icon`, [`${ASSETS}/${one.icon}.png`])
    const source = splash ?? icon
    if (!source) return console.warn('no image', one.name)

    try {
      await writeFullAndThumb(source, path.join(OUT_IMG, 'full', `${id}.webp`), path.join(THUMBS, `${id}.webp`), 96)
    } catch (error) {
      return console.warn('image failed', one.name, error.message)
    }

    const name = names[id] ?? one.name
    result.push({
      id,
      name,
      nameEn: one.name,
      aliases: [...new Set([one.name, one.route, name].filter(Boolean))].join(' ').toLowerCase(),
      gender: GENDERS[one.bodyType] ?? 'Другое',
      element: ELEMENTS[one.element],
      weapon: WEAPONS[one.weaponType] ?? 'Другое',
      region: REGIONS[one.region] ?? 'Другое',
      rarity: one.rank,
      year: new Date((one.release ?? 0) * 1000).getUTCFullYear(),
      answer: true,
    })
  })

  result.sort((a, b) => a.name.localeCompare(b.name, 'ru'))

  await writeAtlas(result, THUMBS, path.join(OUT_IMG, 'thumbs.webp'), OUT_ATLAS, 12, 96)
  await pruneImages(path.join(OUT_IMG, 'full'), result)
  await fs.writeFile(OUT_JSON, JSON.stringify(result, null, 1))
  console.log(`wrote ${result.length} characters`)
}

main()
