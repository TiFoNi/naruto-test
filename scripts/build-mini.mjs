import fs from 'node:fs/promises'
import path from 'node:path'
import { GAME_SPECS } from '../packages/game/src/specs.ts'
import { PUBLIC, pool, writeMini } from './lib.mjs'

const SHAPES = Object.fromEntries(Object.values(GAME_SPECS).map((spec) => [spec.images, spec.shape ?? 'square']))

async function collect() {
  const jobs = []
  for (const game of await fs.readdir(PUBLIC, { withFileTypes: true })) {
    if (!game.isDirectory()) continue
    const shape = SHAPES[game.name] ?? 'square'
    const from = path.join(PUBLIC, game.name, shape === 'square' ? 'full' : 'card')
    for (const file of await fs.readdir(from).catch(() => [])) {
      if (!file.endsWith('.webp')) continue
      jobs.push({ source: path.join(from, file), mini: path.join(PUBLIC, game.name, 'mini', file), shape })
    }
  }
  return jobs
}

async function fresh(job) {
  const [source, mini] = await Promise.all([fs.stat(job.source), fs.stat(job.mini).catch(() => null)])
  return mini !== null && mini.mtimeMs >= source.mtimeMs
}

async function main() {
  const jobs = await collect()
  let made = 0
  let skipped = 0
  await pool(jobs, 8, async (job) => {
    if (await fresh(job)) return skipped++
    await writeMini(job.source, job.mini, job.shape)
    made++
  })
  console.log(`дрібні картинки: створено ${made}, актуальних ${skipped}`)
}

main()
