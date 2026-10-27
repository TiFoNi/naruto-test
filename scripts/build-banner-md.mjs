import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const DIR = path.resolve(import.meta.dirname, '..', 'apps', 'web', 'public', 'banners')
const WIDTH = 1600

const files = fs.readdirSync(DIR).filter((name) => name.endsWith('.webp') && !name.endsWith('-md.webp'))

for (const name of files.sort()) {
  const from = path.join(DIR, name)
  const into = path.join(DIR, name.replace('.webp', '-md.webp'))
  const { width } = await sharp(from).metadata()
  await sharp(from)
    .resize({ width: Math.min(WIDTH, width), kernel: 'lanczos3' })
    .webp({ quality: 90, effort: 6, smartSubsample: true })
    .toFile(into)
  const before = fs.statSync(from).size
  const after = fs.statSync(into).size
  console.log(`${name.padEnd(16)} ${Math.round(before / 1024)}K → ${Math.round(after / 1024)}K`)
}
