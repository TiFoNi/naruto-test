import fs from 'node:fs/promises'
import path from 'node:path'
import { PUBLIC, pool, writeMini } from './lib.mjs'

async function collect() {
  const jobs = []
  for (const game of await fs.readdir(PUBLIC, { withFileTypes: true })) {
    if (!game.isDirectory()) continue
    const card = path.join(PUBLIC, game.name, 'card')
    for (const file of await fs.readdir(card).catch(() => [])) {
      if (!file.endsWith('.webp')) continue
      jobs.push({ source: path.join(card, file), mini: path.join(PUBLIC, game.name, 'mini', file) })
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
    await writeMini(job.source, job.mini)
    made++
    if (made % 200 === 0) console.log(`  зроблено ${made}…`)
  })
  console.log(`дрібні картинки: створено ${made}, актуальних ${skipped}`)
}

main()
