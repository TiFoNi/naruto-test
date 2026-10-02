import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { GAME_SPECS } from '../packages/game/src/specs.ts'
import { PUBLIC, ROOT, pool, squareSide, writeAtlas, writeMini } from './lib.mjs'

const DATA = path.join(ROOT, 'packages', 'game', 'data')
const CELL = 96
const only = process.argv.slice(2).filter((arg) => !arg.startsWith('-'))

for (const [game, spec] of Object.entries(GAME_SPECS)) {
  if ((spec.shape ?? 'square') !== 'square') continue
  if (only.length && !only.includes(game)) continue

  const file = path.join(DATA, `${spec.data}.json`)
  const named = path.join(DATA, `${spec.data}-atlas.json`)
  const atlasFile = (await fs.stat(named).catch(() => null)) ? named : path.join(DATA, 'atlas.json')
  const folder = path.join(PUBLIC, spec.images)
  if (!(await fs.stat(file).catch(() => null))) continue

  const list = JSON.parse(await fs.readFile(file, 'utf8'))
  const cols = JSON.parse(await fs.readFile(atlasFile, 'utf8')).cols
  const thumbs = path.join(ROOT, '.cache', 'reshape', spec.images)
  await fs.mkdir(thumbs, { recursive: true })

  let done = 0
  await pool(list, 8, async (entity) => {
    const full = path.join(folder, 'full', `${entity.id}.webp`)
    const source = await fs.readFile(full).catch(() => null)
    if (!source) return

    const side = squareSide(await sharp(source).metadata())
    const square = await sharp(source).resize(side, side, { fit: 'cover', position: 'top' }).webp({ quality: 88 }).toBuffer()

    await fs.writeFile(full, square)
    await writeMini(square, path.join(folder, 'mini', `${entity.id}.webp`), 'square')
    await sharp(square).resize(CELL, CELL, { fit: 'cover' }).webp({ quality: 88 }).toFile(path.join(thumbs, `${entity.id}.webp`))
    done++
  })

  if (!done) {
    console.log(`${game.padEnd(9)} картинок нема, пропускаю`)
    continue
  }

  await writeAtlas(list, thumbs, path.join(folder, 'thumbs.webp'), atlasFile, cols, CELL)
  await fs.writeFile(file, JSON.stringify(list, null, 1))
  await fs.rm(thumbs, { recursive: true, force: true })
  console.log(`${game.padEnd(9)} квадратів ${done}, атлас ${cols}×${Math.ceil(list.length / cols)}`)
}
