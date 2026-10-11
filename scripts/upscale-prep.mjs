import fs from 'node:fs/promises'
import path from 'node:path'
import { ROOT } from './lib.mjs'

const SEEDS = path.join(ROOT, 'seeds', 'shots')
const IN = path.join(ROOT, 'seeds', 'upscale', 'in')
const OUT = path.join(ROOT, 'seeds', 'upscale', 'out')
const KINDS = ['.jpg', '.jpeg', '.png', '.webp', '.avif']
const SMALL = Number(process.argv.find((one) => one.startsWith('--under='))?.slice(8) ?? 1024)

const sharp = (await import('sharp')).default

await fs.rm(IN, { recursive: true, force: true })
await fs.mkdir(IN, { recursive: true })
await fs.mkdir(OUT, { recursive: true })

const walk = async (dir) => {
  const out = []
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('_') || entry.name.startsWith('.')) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...(await walk(full)))
    else if (KINDS.includes(path.extname(entry.name).toLowerCase())) out.push(full)
  }
  return out
}

let taken = 0
let skipped = 0
for (const file of await walk(SEEDS)) {
  const { width = 0 } = await sharp(file).metadata()
  if (width >= SMALL) {
    skipped++
    continue
  }
  const flat = path.relative(SEEDS, file).replace(/[\\/]/g, '~')
  await fs.copyFile(file, path.join(IN, flat))
  taken++
}

console.log(`зібрано дрібних (<${SMALL}px): ${taken}, пропущено великих: ${skipped}`)
console.log(`\n1. відкрий Upscayl → Batch Upscayl`)
console.log(`2. вхідна тека:  ${IN}`)
console.log(`3. вихідна тека: ${OUT}`)
console.log(`4. модель Digital Art або Ultramix Balanced, масштаб 2x`)
console.log(`5. потім: node scripts/upscale-apply.mjs`)
