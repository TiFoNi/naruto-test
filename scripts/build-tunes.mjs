import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { TUNE_CUTS, TUNE_FULL, TUNE_PEAKS } from '../packages/game/src/specs.ts'

const run = promisify(execFile)
const ROOT = path.resolve(import.meta.dirname, '..')
const RAW = path.join(ROOT, '.cache', 'tunes')
const LIST = path.join(ROOT, 'scripts', 'data', 'tunes.json')
const OUT = path.join(ROOT, 'packages', 'game', 'data', 'tunes.json')

const account = process.env.R2_ACCOUNT_ID
const accessKeyId = process.env.R2_ACCESS_KEY_ID
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
if (!account || !accessKeyId || !secretAccessKey) throw new Error('немає ключів R2')

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${account}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
})
const Bucket = process.env.R2_BUCKET ?? 'nandaguessr'

const dry = process.argv.includes('--dry')
const only = process.argv.find((arg) => !arg.startsWith('-') && arg !== process.argv[0] && arg !== process.argv[1])

async function sourceOf(id) {
  const names = await fs.readdir(RAW).catch(() => [])
  const hit = names.find((name) => name.replace(/\.[^.]+$/, '') === String(id))
  return hit ? path.join(RAW, hit) : null
}

const LEAD = 0.12
const HOLD = 6
const SHARE = 0.5
const LATEST = 5

async function soundAt(source) {
  const { stdout } = await run('ffmpeg', [
    '-v', 'error',
    '-t', '40',
    '-i', source,
    '-vn', '-ac', '1', '-ar', '1000',
    '-f', 's16le', 'pipe:1',
  ], { encoding: 'buffer', maxBuffer: 1 << 26 })

  const samples = stdout.length >> 1
  if (!samples) return 0

  const windows = []
  for (let from = 0; from + 100 <= samples; from += 100) {
    let sum = 0
    for (let at = from; at < from + 100; at++) {
      const value = stdout.readInt16LE(at * 2)
      sum += value * value
    }
    windows.push(Math.sqrt(sum / 100))
  }
  if (!windows.length) return 0

  const ranked = [...windows].sort((a, b) => a - b)
  const loud = ranked[Math.floor(ranked.length * 0.7)]
  const floor = loud * SHARE

  for (let at = 0; at + HOLD < windows.length; at++) {
    if (windows[at] < floor) continue
    let kept = 0
    for (let ahead = at; ahead < at + HOLD; ahead++) if (windows[ahead] >= floor * 0.8) kept += 1
    if (kept >= HOLD - 2) return Math.min(LATEST, Math.max(0, at / 10 - LEAD))
  }

  const quiet = ranked[ranked.length - 1] * 0.04
  for (let at = 0; at < windows.length; at++) if (windows[at] > quiet) return Math.min(LATEST, Math.max(0, at / 10 - LEAD))
  return 0
}

async function slice(source, start, seconds) {
  const spot = path.join(RAW, `.cut-${process.pid}.m4a`)
  const fade = Math.min(0.25, seconds * 0.25)
  const steps = ['-v', 'error', '-y', '-ss', String(start), '-t', String(seconds), '-i', source, '-vn', '-ac', '2', '-ar', '44100', '-c:a', 'aac', '-b:a', '128k']
  if (fade > 0.04) steps.push('-af', `afade=t=out:st=${(seconds - fade).toFixed(3)}:d=${fade.toFixed(3)}`)
  steps.push(spot)

  await run('ffmpeg', steps)
  const cut = await fs.readFile(spot)
  await fs.rm(spot, { force: true })
  return cut
}

async function peaksOf(source, start) {
  const { stdout } = await run('ffmpeg', [
    '-v', 'error',
    '-ss', String(start),
    '-t', String(TUNE_FULL),
    '-i', source,
    '-vn', '-ac', '1', '-ar', '8000',
    '-f', 's16le', 'pipe:1',
  ], { encoding: 'buffer', maxBuffer: 1 << 26 })

  const samples = stdout.length >> 1
  const span = Math.max(1, Math.floor(samples / TUNE_PEAKS))
  const peaks = []
  for (let bucket = 0; bucket < TUNE_PEAKS; bucket++) {
    let sum = 0
    let seen = 0
    for (let at = bucket * span; at < Math.min(samples, (bucket + 1) * span); at++) {
      const value = stdout.readInt16LE(at * 2) / 32768
      sum += value * value
      seen++
    }
    peaks.push(seen ? Math.sqrt(sum / seen) : 0)
  }
  const loudest = Math.max(...peaks, 0.0001)
  return peaks.map((one) => Math.round((one / loudest) * 100) / 100)
}

const list = JSON.parse(await fs.readFile(LIST, 'utf8'))
const kept = []
const missing = []

for (const row of list) {
  if (only && String(row.id) !== only) continue
  if (row.hidden) continue
  const source = await sourceOf(row.id)
  if (!source) {
    missing.push(`${row.id} ${row.nameEn}`)
    continue
  }

  const start = row.start === undefined ? Math.round((await soundAt(source)) * 100) / 100 : Number(row.start) || 0
  const peaks = await peaksOf(source, start)

  let bytes = 0
  for (const seconds of TUNE_CUTS) {
    const cut = await slice(source, start, seconds)
    bytes += cut.length
    if (!dry) await s3.send(new PutObjectCommand({ Bucket, Key: `tunes/${row.id}/${seconds}.m4a`, Body: cut, ContentType: 'audio/mp4' }))
  }

  kept.push({
    id: row.id,
    name: row.name,
    nameUk: row.nameUk ?? row.nameEn,
    nameEn: row.nameEn,
    aliases: row.aliases ?? '',
    year: row.year ?? null,
    op: row.op ?? null,
    song: row.song ?? '',
    artist: row.artist ?? '',
    peaks,
    answer: true,
    thumb: 0,
  })
  console.log(`  ${String(row.id).padStart(3)} ${row.nameEn.slice(0, 34).padEnd(34)} від ${start.toFixed(2)} с, ${TUNE_CUTS.length} уривків, ${Math.round(bytes / 1024)} КБ`)
}

if (missing.length) console.warn(`немає аудіо для ${missing.length}: ${missing.join(', ')}`)

if (!kept.length) console.log(`поклади аудіо у ${path.relative(ROOT, RAW)} з іменами <id>.mp3`)
else if (dry) console.log(`\n--dry: нічого не залито, зібрано б ${kept.length}`)
else {
  const had = JSON.parse(await fs.readFile(OUT, 'utf8').catch(() => '[]'))
  const gone = new Set(list.filter((row) => row.hidden).map((row) => row.id))
  const merged = [...had.filter((one) => !kept.some((row) => row.id === one.id)), ...kept]
    .sort((a, b) => a.id - b.id)
    .map(({ hidden, ...row }) => (gone.has(row.id) ? { ...row, hidden: true } : row))
  await fs.writeFile(OUT, `${JSON.stringify(merged, null, 1)}\n`)
  console.log(`\nу tunes.json тепер ${merged.length}`)
}
