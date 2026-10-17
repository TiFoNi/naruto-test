import fs from 'node:fs/promises'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const LIST = path.join(ROOT, 'scripts', 'data', 'tunes.json')
const RAW = path.join(ROOT, '.cache', 'tunes')
const API = 'https://api.animethemes.moe'
const HEADERS = { 'user-agent': 'nandaguessr/1.0' }

const only = process.argv.find((arg) => /^\d+$/.test(arg))
const force = process.argv.includes('--force')

async function ask(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const answer = await fetch(url, { headers: HEADERS }).catch(() => null)
    if (answer?.ok) return answer.json()
    await new Promise((wait) => setTimeout(wait, 900 * (attempt + 1)))
  }
  return null
}

async function already(id) {
  const names = await fs.readdir(RAW).catch(() => [])
  return names.find((name) => name.replace(/\.[^.]+$/, '') === String(id))
}

await fs.mkdir(RAW, { recursive: true })

const rows = JSON.parse(await fs.readFile(LIST, 'utf8'))
const wanted = only ? rows.filter((row) => row.id === Number(only)) : rows
const missed = []
let taken = 0

for (const row of wanted) {
  const have = await already(row.id)
  if (have && !force) {
    console.log(`  ${String(row.id).padStart(3)} вже є — ${have}`)
    continue
  }

  if (!row.slug) {
    missed.push(`${row.id} ${row.nameEn}: немає slug`)
    continue
  }

  const found = await ask(`${API}/anime/${row.slug}?include=animethemes.song,animethemes.animethemeentries.videos.audio`)
  const theme = found?.anime?.animethemes?.find((one) => one.type === 'OP' && (one.sequence ?? 1) === row.op)
  const link = theme?.animethemeentries?.[0]?.videos?.[0]?.audio?.link

  if (!link) {
    missed.push(`${row.id} ${row.nameEn}: не знайшов OP${row.op}`)
    continue
  }

  const sound = await fetch(link, { headers: HEADERS }).catch(() => null)
  if (!sound?.ok) {
    missed.push(`${row.id} ${row.nameEn}: не завантажився ${link}`)
    continue
  }

  const bytes = Buffer.from(await sound.arrayBuffer())
  const ext = path.extname(new URL(link).pathname) || '.ogg'
  await fs.writeFile(path.join(RAW, `${row.id}${ext}`), bytes)
  taken += 1
  console.log(`  ${String(row.id).padStart(3)} ${row.nameEn.slice(0, 30).padEnd(30)} OP${row.op}  ${theme.song?.title ?? ''} — ${Math.round(bytes.length / 1024)} КБ`)
  await new Promise((wait) => setTimeout(wait, 300))
}

if (missed.length) console.warn(`\nне вийшло ${missed.length}:\n  ${missed.join('\n  ')}`)
console.log(`\nзавантажено ${taken}, лежить у ${path.relative(ROOT, RAW)}`)
