import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { PUBLIC, ROOT } from './lib.mjs'

const FROM = path.join(ROOT, 'apps', 'web', 'src', 'og-bg')
const INTO = path.join(PUBLIC, 'banners')
const SIZE = { width: 2800, height: 780 }

const shots = (await fs.readdir(FROM)).filter((one) => one.endsWith('.png'))
await fs.mkdir(INTO, { recursive: true })

for (const shot of shots) {
  const id = shot.replace('.png', '')
  const out = path.join(INTO, `${id}.webp`)
  await sharp(path.join(FROM, shot)).resize(SIZE.width, SIZE.height, { fit: 'cover', position: 'attention', kernel: 'lanczos3' }).webp({ quality: 82 }).toFile(out)
  const { size } = await fs.stat(out)
  console.log(`${id} — ${Math.round(size / 1024)} КБ`)
}

console.log(`готово: ${shots.length} банерів у public/banners`)
