import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import opentype from 'opentype.js'

const app = new URL('../apps/web/app/', import.meta.url).pathname
const cache = join(tmpdir(), 'nanda-fonts')
mkdirSync(cache, { recursive: true })

const FONTS = {
  'Unbounded-800.ttf': 'Unbounded:800',
  'Manrope-700.ttf': 'Manrope:700',
}

async function font(file) {
  const path = join(cache, file)
  if (!existsSync(path)) {
    const css = await fetch(`https://fonts.googleapis.com/css?family=${FONTS[file]}&subset=latin,cyrillic`, {
      headers: { 'user-agent': 'Mozilla/4.0' },
    }).then((r) => r.text())
    const url = css.match(/https[^)]*\.ttf/)?.[0]
    if (!url) throw new Error(`не знайшов шрифт ${file}`)
    writeFileSync(path, Buffer.from(await fetch(url).then((r) => r.arrayBuffer())))
  }
  return opentype.parse(readFileSync(path).buffer)
}

const display = await font('Unbounded-800.ttf')
const body = await font('Manrope-700.ttf')

const width = (font, text, size) => font.getAdvanceWidth(text, size)

const round = (value) => Number(value.toFixed(2))

function serialise(path) {
  const out = []
  for (const c of path.commands) {
    if (c.type === 'M') out.push(`M${round(c.x)} ${round(c.y)}`)
    else if (c.type === 'L') out.push(`L${round(c.x)} ${round(c.y)}`)
    else if (c.type === 'Q') out.push(`Q${round(c.x1)} ${round(c.y1)} ${round(c.x)} ${round(c.y)}`)
    else if (c.type === 'C') out.push(`C${round(c.x1)} ${round(c.y1)} ${round(c.x2)} ${round(c.y2)} ${round(c.x)} ${round(c.y)}`)
    else if (c.type === 'Z') out.push('Z')
  }
  return out.join('')
}

function label(font, text, x, y, size, fill, anchor = 'start') {
  const shift = anchor === 'middle' ? width(font, text, size) / 2 : 0
  return `<path d="${serialise(font.getPath(text, x - shift, y, size))}" fill="${fill}"/>`
}

const MARK = `
  <g transform="translate(112 148) rotate(-6 60 60)">
    <rect x="0" y="0" width="120" height="120" rx="36" fill="url(#skin)"/>
    <g transform="translate(60 60) scale(1.62) translate(-32 -32)">
      <path fill="#0d0f12" d="M26.6 38.2c-.2-3.3.5-5.5 3.3-7.9 2-1.7 2.8-2.7 2.8-4.1 0-1.7-1.2-2.8-3.1-2.8-2 0-3.3 1.2-3.6 3.3l-5.9-.5c.5-4.9 4-8 9.7-8 5.6 0 9.2 2.9 9.2 7.4 0 2.7-1.2 4.5-4.1 6.9-2.2 1.8-2.8 2.9-2.7 5.7z"/>
      <circle cx="29.6" cy="45.4" r="3.4" fill="#0d0f12"/>
      <rect x="40.4" y="21.6" width="5.6" height="17.4" rx="2.8" fill="#0d0f12"/>
      <circle cx="43.2" cy="45.4" r="3.4" fill="#0d0f12"/>
    </g>
  </g>`

const chips = ['По признакам', 'По картинке', 'По способности', 'Ежедневный']
const CHIP_SIZE = 27
const PAD = 34
const GAP = 16

let cursor = 112
const chipMarkup = chips
  .map((text) => {
    const w = width(body, text, CHIP_SIZE) + PAD * 2
    const box = `<rect x="${cursor.toFixed(1)}" y="410" width="${w.toFixed(1)}" height="58" rx="18" fill="#171b21"/>`
    const caption = label(body, text, cursor + w / 2, 448, CHIP_SIZE, '#8b93a1', 'middle')
    cursor += w + GAP
    return box + caption
  })
  .join('\n    ')

const nanda = width(display, 'Nanda', 76)

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="skin" x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#ffb055"/><stop offset="1" stop-color="#ff7a0a"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.42" cy="0.08" r="0.85">
      <stop offset="0" stop-color="#ff8a1f" stop-opacity="0.26"/>
      <stop offset="0.5" stop-color="#ff8a1f" stop-opacity="0.07"/>
      <stop offset="1" stop-color="#ff8a1f" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="#0d0f12"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  ${MARK}
  ${label(display, 'Nanda', 268, 243, 76, '#eef0f3')}
  ${label(display, 'Guessr', 268 + nanda, 243, 76, '#ff8a1f')}
  ${label(body, 'Угадай персонажа аниме, манги и игр', 112, 352, 40, '#a7afbb')}
  ${chipMarkup}
  ${label(body, 'nandaguessr.com', 112, 545, 30, '#ff8a1f')}
</svg>`

await sharp(Buffer.from(svg), { density: 144 }).resize(1200, 630).png().toFile(`${app}opengraph-image.png`)
await sharp(`${app}icon.svg`, { density: 600 }).resize(180, 180).png().toFile(`${app}apple-icon.png`)
console.log('лого, apple-icon і og-картинка оновлені')
