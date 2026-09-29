import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { ImageResponse } from 'next/og'
import sharp from 'sharp'
import { BRAND } from './brand'

export const OG_SIZE = { width: 1200, height: 630 }

let cached: Promise<Buffer[]> | null = null

const font = () => {
  cached ??= Promise.all(
    ['manrope-latin.ttf', 'manrope-cyrillic.ttf'].map((file) => readFile(path.join(process.cwd(), 'src', 'fonts', file))),
  )
  return cached
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
  const limit = narrow ? 9 : 14
  if (title.length > 34 || longest > limit + 3) return 48
  if (title.length > 20 || longest > limit) return 60
  return 84
}

type Card = {
  eyebrow?: string
  title: string
  note?: string
  tags?: string[]
  accent?: string
  faces?: string[]
}

export async function ogCard({ eyebrow, title, note, tags = [], accent = BRAND.accent, faces = [] }: Card) {
  const data = await font().catch(() => null)
  const room = faces.length ? 540 : 1040

  return new ImageResponse(
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
          backgroundImage: `radial-gradient(900px 500px at 82% -10%, ${accent}44, transparent 70%)`,
          color: '#eef0f3',
          fontFamily: 'Manrope',
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
          <div style={{ display: 'flex', fontSize: 34, letterSpacing: -0.5 }}>
            <span>Nanda</span>
            <span style={{ color: accent }}>Guessr</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, width: room, marginTop: tags.length ? -20 : 0 }}>
          {eyebrow && (
            <div style={{ width: room, fontSize: 26, letterSpacing: 3, textTransform: 'uppercase', color: accent }}>{eyebrow}</div>
          )}
          <div style={{ width: room, fontSize: headline(title, faces.length > 0), lineHeight: 1.05, letterSpacing: -2 }}>{title}</div>
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
      fonts: data ? data.map((body) => ({ name: 'Manrope', data: body, style: 'normal' as const, weight: 800 as const })) : undefined,
    },
  )
}
