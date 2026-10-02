import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

export const ROOT = path.resolve(import.meta.dirname, '..')
export const PUBLIC = path.join(ROOT, 'apps', 'web', 'public')
export const UA = { 'User-Agent': 'naruto-test-build/1.0' }

export async function getJson(url) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers: UA }).catch(() => null)
    if (res?.ok) return res.json()
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)))
  }
  throw new Error(`failed ${url}`)
}

export async function cachedJson(dir, name, load) {
  const file = path.join(dir, name)
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'))
  } catch {
    const data = await load()
    await fs.writeFile(file, JSON.stringify(data))
    return data
  }
}

export async function wikiQuery(api, titles, params) {
  const out = {}
  for (let i = 0; i < titles.length; i += 40) {
    const batch = titles.slice(i, i + 40).join('|')
    const res = await getJson(`${api}?action=query&format=json&redirects=1&${params}&titles=${encodeURIComponent(batch)}`)
    const back = Object.fromEntries([...(res.query.normalized ?? []), ...(res.query.redirects ?? [])].map((x) => [x.to, x.from]))
    for (const page of Object.values(res.query.pages)) {
      let title = page.title
      while (back[title]) title = back[title]
      out[title] = page
    }
  }
  return out
}

export async function wikiPages(api, titles) {
  const res = await wikiQuery(api, titles, 'prop=revisions|info|langlinks&rvprop=content&rvslots=main&lllang=ru&lllimit=500')
  return Object.fromEntries(
    Object.entries(res).map(([t, p]) => [
      t,
      {
        id: p.pageid ?? null,
        text: p.revisions?.[0]?.slots?.main?.['*'] ?? null,
        length: p.length ?? 0,
        ru: p.langlinks?.[0]?.['*'] ?? null,
      },
    ]),
  )
}

export async function wikiImageUrls(api, files) {
  const res = await wikiQuery(api, files.map((f) => `File:${f}`), 'prop=imageinfo&iiprop=url')
  return Object.fromEntries(Object.entries(res).map(([t, p]) => [t.replace(/^File:/, ''), p.imageinfo?.[0]?.url ?? null]))
}

export async function categoryMembers(api, category) {
  const titles = []
  let cont = ''
  do {
    const res = await getJson(
      `${api}?action=query&format=json&list=categorymembers&cmnamespace=0&cmlimit=500&cmtitle=${encodeURIComponent(`Category:${category}`)}${cont}`,
    )
    titles.push(...res.query.categorymembers.map((m) => m.title))
    cont = res.continue ? `&cmcontinue=${encodeURIComponent(res.continue.cmcontinue)}` : ''
  } while (cont)
  return titles
}

export function galleryImage(text, prefer = /anime/i) {
  const block = text?.match(/\|\s*image\s*=\s*<gallery>([\s\S]*?)<\/gallery>/i)?.[1]
  if (!block) return null
  const rows = block
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /\.(png|jpe?g|webp)/i.test(line))
    .map((line) => {
      const [file, label = ''] = line.split('|')
      return { file: file.trim(), label: label.trim() }
    })
  return rows.find((row) => prefer.test(row.label))?.file ?? null
}

export function infobox(text, fieldName) {
  if (!text) return null
  const name = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const value = text.match(new RegExp(`^\\|\\s*${name}\\s*=([\\s\\S]*?)(?=^\\||^\\}\\})`, 'mi'))?.[1]?.trim()
  if (value) return value
  return text.match(new RegExp(`^\\|\\s*${name}\\s*=\\s*(.+?)\\}\\}\\s*$`, 'mi'))?.[1]?.trim() || null
}

export function plain(value) {
  if (!value) return ''
  return value
    .replace(/<ref[^>]*\/>/g, '')
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, '')
    .replace(/\{\{(?:ref|r|tt)\|[^{}]*\}\}/gi, '')
    .replace(/\{\{nihongo\|([^|{}]*)[^{}]*\}\}/gi, '$1')
    .replace(/\{\{(?:org|loc|fam|w)\|([^|{}]*)[^{}]*\}\}/gi, '$1')
    .replace(/\{\{[^{}]*\}\}/g, '')
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/'''?/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
}

export function plainList(value) {
  return plain(value)
    .split(/\n|,(?![^(]*\))/)
    .map((s) => s.replace(/^\s*\*+\s*/, '').trim())
    .filter(Boolean)
}

export function stripParens(s) {
  return s.replace(/\s*\([^)]*\)\s*/g, ' ').trim()
}

async function download(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { headers: UA }).catch(() => null)
    if (res?.ok) return Buffer.from(await res.arrayBuffer())
    if (res?.status === 404) return null
    await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
  }
  return null
}

const PLACEHOLDER = /no[_ -]?(image|pic|photo)|not[_ -]?available|placeholder/i

export async function cachedDownload(dir, key, urls) {
  const file = path.join(dir, key)
  try {
    return await fs.readFile(file)
  } catch {
    for (const url of (urls ?? []).filter(Boolean).filter((url) => !PLACEHOLDER.test(url))) {
      const buf = await download(url)
      if (buf) {
        await fs.mkdir(dir, { recursive: true })
        await fs.writeFile(file, buf)
        return buf
      }
    }
    return null
  }
}

export async function pickPicture(dir, key, urls) {
  for (const [index, url] of (urls ?? []).filter(Boolean).entries()) {
    const buf = await cachedDownload(path.join(dir, `source-${index}`), key, [url])
    if (buf?.length) return buf
  }
  return null
}

export const SQUARE = 800

export const squareSide = ({ width, height }) => Math.min(SQUARE, width, height)

export const CARD = { width: 288, height: 384 }

export const MINI = { width: 168, height: 224 }

export async function framed(source, width, height, quality) {
  const back = await sharp(source).resize(width, height, { fit: 'cover' }).blur(18).modulate({ brightness: 0.75 }).toBuffer()
  const front = await sharp(source).resize(width, height, { fit: 'inside' }).toBuffer()
  return sharp(back).composite([{ input: front, gravity: 'center' }]).webp({ quality }).toBuffer()
}

export async function writeCard(source, cardPath, frame) {
  await fs.mkdir(path.dirname(cardPath), { recursive: true })
  if (frame) {
    await fs.writeFile(cardPath, await framed(source, CARD.width, CARD.height, 82))
    return
  }
  await sharp(source)
    .resize(CARD.width, CARD.height, { fit: 'cover', position: 'top' })
    .webp({ quality: 80 })
    .toFile(cardPath)
}

export async function writeMini(source, miniPath, shape = 'square') {
  await fs.mkdir(path.dirname(miniPath), { recursive: true })
  const box = shape === 'square' ? { width: MINI.width, height: MINI.width } : MINI
  await sharp(source)
    .resize(box.width, box.height, { fit: 'cover', position: 'top' })
    .webp({ quality: 78 })
    .toFile(miniPath)
}

export async function writeFullAndThumb(buf, fullPath, thumbPath, cell, { big, frame, shape = 'square' } = {}) {
  const letterbox = frame ?? null
  const trimmed = await sharp(buf).trim().png().toBuffer({ resolveWithObject: true })
  const { width, height } = trimmed.info
  const detailed = big ? await sharp(big).trim().png().toBuffer({ resolveWithObject: true }) : null
  const source = detailed && detailed.info.width > width ? detailed.data : trimmed.data
  const cardPath = fullPath.replace(`${path.sep}full${path.sep}`, `${path.sep}card${path.sep}`)
  const tight = letterbox ?? width < 420

  if (shape === 'square') {
    const full = await sharp(source).resize(squareSide(trimmed.info), squareSide(trimmed.info), { fit: 'cover', position: 'top' }).webp({ quality: 88 }).toBuffer()
    await fs.writeFile(fullPath, full)
    await writeCard(trimmed.data, cardPath, tight)
    await sharp(full).resize(cell, cell, { fit: 'cover' }).webp({ quality: 88 }).toFile(thumbPath)
    return
  }

  await sharp(source)
    .resize({ width: 800, height: 900, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 88 })
    .toFile(fullPath)
  await writeCard(trimmed.data, cardPath, tight)
  if (tight) {
    await fs.writeFile(thumbPath, await framed(trimmed.data, cell, cell, 88))
    return
  }
  const side = Math.min(width, height)
  await sharp(trimmed.data)
    .extract({ left: Math.floor((width - side) / 2), top: 0, width: side, height: side })
    .resize(cell, cell, { fit: 'cover', position: sharp.strategy.attention })
    .webp({ quality: 88 })
    .toFile(thumbPath)
}

export async function writeAtlas(entities, thumbDir, outFile, metaFile, cols, cell) {
  const rows = Math.ceil(entities.length / cols)
  await sharp({ create: { width: cols * cell, height: rows * cell, channels: 3, background: '#111' } })
    .composite(
      entities.map((e, i) => ({
        input: path.join(thumbDir, `${e.id}.webp`),
        left: (i % cols) * cell,
        top: Math.floor(i / cols) * cell,
      })),
    )
    .webp({ quality: 84 })
    .toFile(outFile)
  entities.forEach((e, i) => (e.thumb = i))

  const version = await picsVersion(path.dirname(outFile))
  await fs.writeFile(metaFile, JSON.stringify({ cols, rows, cell, version }))
  await saveVersion(path.basename(path.dirname(outFile)), version)
}

export async function picsVersion(folder) {
  const parts = []
  for (const kind of ['full', 'card', 'thumbs.webp']) {
    const target = path.join(folder, kind)
    if (kind.endsWith('.webp')) {
      const info = await fs.stat(target).catch(() => null)
      if (info) parts.push(`${kind}:${info.size}`)
      continue
    }
    for (const file of (await fs.readdir(target).catch(() => [])).sort()) {
      const info = await fs.stat(path.join(target, file))
      parts.push(`${kind}/${file}:${info.size}`)
    }
  }
  return createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 8)
}

export async function saveVersion(game, version) {
  const file = path.join(ROOT, 'packages', 'game', 'data', 'versions.json')
  const all = JSON.parse(await fs.readFile(file, 'utf8').catch(() => '{}'))
  all[game] = version
  await fs.writeFile(file, `${JSON.stringify(all, null, 1)}\n`)
}

export async function pool(items, size, fn) {
  let i = 0
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (i < items.length) await fn(items[i++])
    }),
  )
}

export function ruName(enName, ruTitle, transliterate) {
  if (ruTitle) return stripParens(ruTitle)
  return stripParens(enName)
    .split(/\s+and\s+/i)
    .map((part) => transliterate(part))
    .join(' и ')
}

const GENERIC_NAME =
  /'s (father|mother|wife|husband|son|daughter|grandfather|grandmother|brother|sister|parents|relatives)\b|\b(unidentified|unnamed|nameless)\b|\brelatives\b|^the three\b|\bcommander$|^mayor of\b|^(mr|mrs|ms|miss)\.? /i

export function keepNotable(ranked, keep) {
  return ranked.filter((c, i) => !GENERIC_NAME.test(c.nameEn ?? c.name) && (c.answer || i < keep))
}

export async function pruneImages(dir, entities) {
  const keep = new Set(entities.map((e) => `${e.id}.webp`))
  const folders = path.basename(dir) === 'full' ? ['full', 'card', 'mini'] : [path.basename(dir)]
  for (const folder of folders) {
    const target = path.join(path.dirname(dir), folder)
    for (const file of await fs.readdir(target).catch(() => [])) {
      if (!keep.has(file)) await fs.unlink(path.join(target, file))
    }
  }
}
