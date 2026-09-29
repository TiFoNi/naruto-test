import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { ImageResponse } from 'next/og'
import sharp from 'sharp'
import { BRAND } from './brand'

export const OG_SIZE = { width: 1200, height: 630 }

const FILES = [
  { name: 'Manrope', file: 'manrope-latin.ttf' },
  { name: 'ManropeCyr', file: 'manrope-cyrillic.ttf' },
  { name: 'Unbounded', file: 'unbounded-latin.ttf' },
  { name: 'UnboundedCyr', file: 'unbounded-cyrillic.ttf' },
] as const

let cached: Promise<{ name: string; data: Buffer }[]> | null = null

const font = () => {
  cached ??= Promise.all(
    FILES.map(async ({ name, file }) => ({ name, data: await readFile(path.join(process.cwd(), 'src', 'fonts', file)) })),
  )
  return cached
}

const HAZE = Buffer.from(
  `<svg width="${OG_SIZE.width}" height="${OG_SIZE.height}"><defs><linearGradient id="m" x1="0" y1="0" x2="1" y2="0">` +
    '<stop offset="0%" stop-color="#fff" stop-opacity="1"/><stop offset="28%" stop-color="#fff" stop-opacity="1"/>' +
    '<stop offset="56%" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>' +
    `<rect width="${OG_SIZE.width}" height="${OG_SIZE.height}" fill="url(#m)"/></svg>`,
)

const SHADE = Buffer.from(
  `<svg width="${OG_SIZE.width}" height="${OG_SIZE.height}"><defs><linearGradient id="s" x1="0" y1="0" x2="1" y2="0">` +
    '<stop offset="0%" stop-color="#05070a" stop-opacity="0.92"/><stop offset="30%" stop-color="#05070a" stop-opacity="0.8"/>' +
    '<stop offset="55%" stop-color="#05070a" stop-opacity="0.16"/><stop offset="100%" stop-color="#05070a" stop-opacity="0.04"/>' +
    `</linearGradient></defs><rect width="${OG_SIZE.width}" height="${OG_SIZE.height}" fill="url(#s)"/></svg>`,
)

export async function ogBackground(game: string) {
  for (const ext of ['jpg', 'jpeg', 'png', 'webp']) {
    try {
      const body = await readFile(path.join(process.cwd(), 'src', 'og-bg', `${game}.${ext}`))
      const sharp_ = sharp(body).resize(OG_SIZE.width, OG_SIZE.height, { fit: 'cover' })
      const base = await sharp_.png().toBuffer()
      const soft = await sharp(base)
        .blur(22)
        .composite([{ input: HAZE, blend: 'dest-in' }])
        .png()
        .toBuffer()
      const png = await sharp(base)
        .composite([
          { input: soft, blend: 'over' },
          { input: SHADE, blend: 'over' },
        ])
        .png()
        .toBuffer()
      return `data:image/png;base64,${png.toString('base64')}`
    } catch {
      /* немає такого файлу — пробуємо наступне розширення */
    }
  }
  return null
}

export async function asPng(url: string) {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const body = await sharp(Buffer.from(await res.arrayBuffer())).resize(232, 310, { fit: 'cover' }).png().toBuffer()
    return `data:image/png;base64,${body.toString('base64')}`
  } catch {
    return null
  }
}

const headline = (title: string, narrow: boolean) => {
  const longest = Math.max(...title.split(/\s+/).map((word) => word.length))
  const limit = narrow ? 8 : 12
  if (title.length > 30 || longest > limit + 3) return 40
  if (title.length > 18 || longest > limit) return 50
  return 64
}

type Card = {
  eyebrow?: string
  title: string
  note?: string
  tags?: string[]
  accent?: string
  faces?: string[]
  background?: string | null
}

export async function ogCard({ eyebrow, title, note, tags = [], accent = BRAND.accent, faces = [], background }: Card) {
  const data = await font().catch(() => null)
  const room = background ? 460 : faces.length ? 450 : 1040

  const card = new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '0 80px',
          position: 'relative',
          background: '#0d0f12',
          backgroundImage: background
            ? `url(${background})`
            : `radial-gradient(900px 500px at 82% -10%, ${accent}44, transparent 70%)`,
          backgroundSize: '1200px 630px',
          color: '#eef0f3',
          fontFamily: 'Manrope, ManropeCyr',
        }}
      >
        <div style={{ position: 'absolute', top: 64, left: 80, display: 'flex', alignItems: 'center', gap: 18 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 64,
              height: 64,
              borderRadius: 18,
              background: accent,
              color: '#0d0f12',
              fontSize: 34,
              letterSpacing: -1.5,
              transform: 'rotate(-6deg)',
            }}
          >
            {BRAND.mark}
          </div>
          <div style={{ display: 'flex', fontFamily: 'Unbounded, UnboundedCyr', fontSize: 30, letterSpacing: -0.5 }}>
            <span>Nanda</span>
            <span style={{ color: accent }}>Guessr</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, width: room, marginTop: tags.length ? -20 : 0 }}>
          {eyebrow && (
            <div style={{ width: room, fontSize: 26, letterSpacing: 3, textTransform: 'uppercase', color: accent }}>{eyebrow}</div>
          )}
          <div style={{ width: room, fontFamily: 'Unbounded, UnboundedCyr', fontSize: headline(title, faces.length > 0), lineHeight: 1.16, letterSpacing: -1.5 }}>
            {title}
          </div>
          {note && <div style={{ width: room, fontSize: 30, color: '#a7afbb' }}>{note}</div>}
        </div>

        {faces.length > 0 && (
          <div style={{ position: 'absolute', top: 148, right: 74, display: 'flex' }}>
            {faces.slice(0, 3).map((src, i) => (
              <img
                key={src}
                src={src}
                width={232}
                height={310}
                style={{
                  marginLeft: i === 0 ? 0 : -58,
                  borderRadius: 22,
                  border: '3px solid #1d2229',
                  objectFit: 'cover',
                  transform: `rotate(${(i - 1) * 7}deg) translateY(${i === 1 ? -14 : 10}px)`,
                  boxShadow: '0 24px 50px rgba(0,0,0,0.6)',
                }}
              />
            ))}
          </div>
        )}

        <div style={{ position: 'absolute', bottom: 72, left: 80, display: 'flex', gap: 14, height: tags.length ? 'auto' : 0 }}>
          {tags.map((tag) => (
            <div
              key={tag}
              style={{
                display: 'flex',
                padding: '12px 24px',
                borderRadius: 999,
                border: '1px solid #2a3038',
                background: '#161a1f',
                color: '#a7afbb',
                fontSize: 26,
              }}
            >
              {tag}
            </div>
          ))}
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: data
        ? data.map(({ name, data: body }) => ({ name, data: body, style: 'normal' as const, weight: 700 as const }))
        : undefined,
    },
  )

  const small = await sharp(Buffer.from(await card.arrayBuffer())).jpeg({ quality: 82, mozjpeg: true }).toBuffer()

  return new Response(new Uint8Array(small), {
    headers: {
      'content-type': 'image/jpeg',
      'cache-control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800',
    },
  })
}
