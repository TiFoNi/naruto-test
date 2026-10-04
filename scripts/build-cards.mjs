import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { CARD, PUBLIC, pool, writeCard } from './lib.mjs'

async function collect() {
  const jobs = []
  for (const game of await fs.readdir(PUBLIC, { withFileTypes: true })) {
    if (!game.isDirectory()) continue
    const full = path.join(PUBLIC, game.name, 'full')
    for (const file of await fs.readdir(full).catch(() => [])) {
      if (!file.endsWith('.webp')) continue
      jobs.push({ source: path.join(full, file), card: path.join(PUBLIC, game.name, 'card', file) })
    }
  }
  return jobs
}

async function fresh(job) {
  const [source, card] = await Promise.all([fs.stat(job.source), fs.stat(job.card).catch(() => null)])
  return card !== null && card.mtimeMs >= source.mtimeMs
}

async function main() {
  const jobs = await collect()
  let made = 0
  let skipped = 0
  await pool(jobs, 8, async (job) => {
    if (await fresh(job)) return skipped++
    const { width = 0, height = 0 } = await sharp(job.source).metadata()
    const need = Math.max(CARD.width / width, CARD.height / height)
    await writeCard(job.source, job.card, need > 1.2)
    made++
    if (made % 200 === 0) console.log(`  зроблено ${made}…`)
  })
  console.log(`картки для дашборда: створено ${made}, актуальних ${skipped}`)
}

main()
