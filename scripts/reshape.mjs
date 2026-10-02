import fs from 'node:fs/promises'
import path from 'node:path'
import { GAME_SPECS } from '../packages/game/src/specs.ts'
import { CELL, PUBLIC, ROOT, derive, pool, writeAtlas } from './lib.mjs'

const DATA = path.join(ROOT, 'packages', 'game', 'data')
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
    const fullPath = path.join(folder, 'full', `${entity.id}.webp`)
    const source = await fs.readFile(fullPath).catch(() => null)
    if (!source) return

    const { full, mini, thumb } = await derive(source, 'square')
    await fs.writeFile(fullPath, full)
    await fs.mkdir(path.join(folder, 'mini'), { recursive: true })
    await fs.writeFile(path.join(folder, 'mini', `${entity.id}.webp`), mini)
    await fs.writeFile(path.join(thumbs, `${entity.id}.webp`), thumb)
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
