import fs from 'node:fs'
import path from 'node:path'
import { GAME_SPECS } from '../packages/game/src/specs.ts'
import { ROOT, infobox } from './lib.mjs'

const FIELDS = {
  jjk: 'debutanime',
  csm: 'anime_debut',
  kny: 'anime_debut',
  tg: 'anime debut',
  hxh: 'anime debut',
  bleach: 'anime debut',
  bc: 'anime',
  dn: 'anime',
  jojo: 'animedebut',
}

const SHOWN = /episode|movie|ova|ona|film/i

const ALSO = {
  csm: ['Hirokazu Arai'],
  dn: ['L'],
  tg: ['Karren von Rosewald'],
  jojo: ['Narciso Anasui'],
}

for (const [game, field] of Object.entries(FIELDS)) {
  const cache = path.join(ROOT, '.cache', game, 'pages.json')
  const file = path.join(ROOT, 'packages', 'game', 'data', `${GAME_SPECS[game].data}.json`)
  if (!fs.existsSync(cache) || !fs.existsSync(file)) {
    console.warn(`${game}: немає даних, пропускаю`)
    continue
  }

  const pages = JSON.parse(fs.readFileSync(cache, 'utf8'))
  const list = JSON.parse(fs.readFileSync(file, 'utf8'))

  let shown = 0
  for (const entity of list) {
    const text = pages[entity.nameEn]?.text ?? ''
    const raw = infobox(text, field)
    entity.anime = (ALSO[game] ?? []).includes(entity.nameEn) || (!!raw && SHOWN.test(raw))
    if (entity.anime) shown++
  }

  fs.writeFileSync(file, JSON.stringify(list, null, 1))
  console.log(`${game.padEnd(8)} в аніме ${shown} з ${list.length}`)
}
