import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const DIR = path.resolve(import.meta.dirname, '..', 'apps', 'web', 'public', 'frames')
const SIDE = 512

const files = fs.readdirSync(DIR).filter((name) => name.endsWith('.webp') && !/-(sm|md)\.webp$/.test(name))

for (const name of files.sort()) {
  const from = path.join(DIR, name)
  const into = path.join(DIR, name.replace('.webp', '-md.webp'))
  await sharp(from).resize(SIDE, SIDE, { kernel: 'lanczos3' }).webp({ quality: 92, alphaQuality: 100, effort: 6 }).toFile(into)
  console.log(`${name.padEnd(16)} ${Math.round(fs.statSync(from).size / 1024)}K → ${Math.round(fs.statSync(into).size / 1024)}K`)
}
