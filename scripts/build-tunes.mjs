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

async function soundAt(source) {
  const { stdout } = await run('ffmpeg', [
    '-v', 'error',
    '-t', '40',
    '-i', source,
    '-vn', '-ac', '1', '-ar', '1000',
    '-f', 's16le', 'pipe:1',
  ], { encoding: 'buffer', maxBuffer: 1 << 26 })

  const samples = stdout.length >> 1
  let loudest = 0
  for (let at = 0; at < samples; at++) loudest = Math.max(loudest, Math.abs(stdout.readInt16LE(at * 2)))
  const floor = loudest * 0.04
  for (let at = 0; at < samples; at++) {
    if (Math.abs(stdout.readInt16LE(at * 2)) > floor) return Math.max(0, at / 1000 - 0.08)
  }
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
    fame: Math.min(4, Math.max(1, Math.round(Number(row.fame)) || 2)),
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
  const merged = [...had.filter((one) => !kept.some((row) => row.id === one.id)), ...kept].sort((a, b) => a.id - b.id)
  await fs.writeFile(OUT, `${JSON.stringify(merged, null, 1)}\n`)
  console.log(`\nу tunes.json тепер ${merged.length}`)
}
