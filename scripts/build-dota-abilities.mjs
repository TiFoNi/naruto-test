import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { ROOT, cachedDownload, cachedJson, getJson, pool } from './lib.mjs'

const CACHE = path.join(ROOT, '.cache', 'dota-abilities')
const OUT_IMG = path.join(ROOT, 'public', 'dota', 'abilities')
const OUT_JSON = path.join(ROOT, 'src', 'data', 'dota-abilities.json')
const HERODATA = (lang, id) => `https://www.dota2.com/datafeed/herodata?language=${lang}&hero_id=${id}`
const ICON = (key) => `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/abilities/${key}.png`
const LANGS = { en: 'english', ru: 'russian', uk: 'ukrainian' }
const SIZE = 128
const SKIP = /^generic_|_empty\d*$|^special_bonus/
const STAGES = [
  { blur: 9, saturation: 0 },
  { blur: 6, saturation: 0 },
  { blur: 4, saturation: 0.25 },
  { blur: 2.5, saturation: 0.55 },
  { blur: 1.2, saturation: 0.85 },
]

async function main() {
  await fs.mkdir(path.join(CACHE, 'img'), { recursive: true })
  await fs.mkdir(OUT_IMG, { recursive: true })
  for (const i of STAGES.keys()) await fs.mkdir(path.join(OUT_IMG, `s${i}`), { recursive: true })
  const heroes = JSON.parse(await fs.readFile(path.join(ROOT, 'src', 'data', 'dota.json'), 'utf8'))

  const feeds = {}
  await pool(heroes, 6, async (hero) => {
    feeds[hero.id] = {}
    for (const [lang, feedLang] of Object.entries(LANGS)) {
      const data = await cachedJson(CACHE, `${hero.id}-${lang}.json`, () => getJson(HERODATA(feedLang, hero.id)))
      feeds[hero.id][lang] = data.result.data.heroes[0].abilities
    }
  })

  const result = {}
  const seen = new Map()
  for (const hero of heroes) {
    const [en, ru, uk] = ['en', 'ru', 'uk'].map((l) => feeds[hero.id][l])
    const picked = en.filter(
      (a) =>
        !SKIP.test(a.name) &&
        !a.ability_is_innate &&
        !a.ability_is_granted_by_shard &&
        !a.ability_is_granted_by_scepter &&
        a.name_loc &&
        !/^#|^DOTA_/.test(a.name_loc),
    )
    for (const a of picked) seen.set(a.name, (seen.get(a.name) ?? 0) + 1)
    result[hero.id] = picked.map((a) => ({
      key: a.name,
      name: {
        en: a.name_loc,
        ru: ru.find((x) => x.name === a.name)?.name_loc || a.name_loc,
        uk: uk.find((x) => x.name === a.name)?.name_loc || a.name_loc,
      },
    }))
  }

  const keep = new Set()
  await pool(Object.values(result).flat(), 10, async (ability) => {
    if (seen.get(ability.key) > 1) return
    const buf = await cachedDownload(path.join(CACHE, 'img'), ability.key, [ICON(ability.key)])
    if (!buf) return console.warn('no icon', ability.key)
    try {
      const base = await sharp(buf).resize(SIZE, SIZE, { fit: 'cover' }).png().toBuffer()
      await sharp(base).webp({ quality: 90 }).toFile(path.join(OUT_IMG, `${ability.key}.webp`))
      for (const [i, stage] of STAGES.entries()) {
        await sharp(base)
          .blur(stage.blur)
          .modulate({ saturation: stage.saturation })
          .webp({ quality: 70 })
          .toFile(path.join(OUT_IMG, `s${i}`, `${ability.key}.webp`))
      }
      keep.add(ability.key)
    } catch (e) {
      console.warn('icon failed', ability.key, e.message)
    }
  })

  for (const id of Object.keys(result)) {
    result[id] = result[id].filter((a) => keep.has(a.key))
    if (!result[id].length) delete result[id]
  }
  for (const dir of [OUT_IMG, ...[...STAGES.keys()].map((i) => path.join(OUT_IMG, `s${i}`))]) {
    for (const file of await fs.readdir(dir)) {
      if (file.endsWith('.webp') && !keep.has(file.replace(/\.webp$/, ''))) await fs.unlink(path.join(dir, file))
    }
  }
  await fs.writeFile(OUT_JSON, JSON.stringify(result))
  const total = Object.values(result).reduce((n, list) => n + list.length, 0)
  console.log(`wrote ${total} abilities for ${Object.keys(result).length} heroes`)
}

main()
