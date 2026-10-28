import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const DIR = path.resolve(import.meta.dirname, '..', 'apps', 'web', 'public', 'banners')
const SIZES = { md: 1600, sm: 1200, xs: 800 }

const only = process.argv.slice(2)

const files = fs.readdirSync(DIR).filter((name) => name.endsWith('.webp') && !/-(md|sm|xs)\.webp$/.test(name))

for (const name of files.sort()) {
  const from = path.join(DIR, name)
  const { width } = await sharp(from).metadata()
  const sizes = []
  for (const [suffix, side] of Object.entries(SIZES)) {
    if (only.length && !only.includes(suffix)) continue
    const into = path.join(DIR, name.replace('.webp', `-${suffix}.webp`))
    await sharp(from)
      .resize({ width: Math.min(side, width), kernel: 'lanczos3' })
      .webp({ quality: 90, effort: 6, smartSubsample: true })
      .toFile(into)
    sizes.push(`${suffix} ${Math.round(fs.statSync(into).size / 1024)}K`)
  }
  console.log(`${name.padEnd(16)} ${Math.round(fs.statSync(from).size / 1024)}K → ${sizes.join(', ')}`)
}
