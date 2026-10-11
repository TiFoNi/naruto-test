import fs from 'node:fs/promises'
import path from 'node:path'
import { ROOT } from './lib.mjs'

const SEEDS = path.join(ROOT, 'seeds', 'shots')
const OUT = path.join(ROOT, 'seeds', 'upscale', 'out')
const sharp = (await import('sharp')).default

const files = await fs.readdir(OUT).catch(() => [])
if (!files.length) {
  console.log(`у ${OUT} порожньо — спершу прожени Upscayl`)
  process.exit(0)
}

let put = 0
let lost = 0
for (const file of files) {
  if (file.startsWith('.')) continue
  // Upscayl додає суфікс моделі: назва_upscayl_2x_digital-art.png
  const flat = file.replace(/_upscayl[^.]*/i, '')
  const base = flat.replace(/\.[^.]+$/, '')
  const target = path.join(SEEDS, base.replace(/~/g, path.sep))
  const near = await fs
    .readdir(path.dirname(target))
    .then((all) => all.find((one) => one.replace(/\.[^.]+$/, '') === path.basename(target)))
    .catch(() => null)
  if (!near) {
    lost++
    console.warn(`не знайшов, куди покласти: ${file}`)
    continue
  }
  const dest = path.join(path.dirname(target), near)
  const before = (await sharp(dest).metadata()).width
  const after = (await sharp(path.join(OUT, file)).metadata()).width
  await fs.copyFile(path.join(OUT, file), dest)
  console.log(`${path.relative(SEEDS, dest)}  ${before} → ${after}px`)
  put++
}

console.log(`\nповернуто: ${put}${lost ? `, не розпізнано: ${lost}` : ''}`)
console.log('далі: node scripts/build-shot-pics.mjs')
