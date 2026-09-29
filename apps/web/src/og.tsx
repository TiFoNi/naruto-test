import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { ImageResponse } from 'next/og'
import { BRAND } from './brand'

export const OG_SIZE = { width: 1200, height: 630 }

let cached: Promise<Buffer[]> | null = null

const font = () => {
  cached ??= Promise.all(
    ['manrope-latin.ttf', 'manrope-cyrillic.ttf'].map((file) => readFile(path.join(process.cwd(), 'src', 'fonts', file))),
  )
  return cached
}

type Card = {
  eyebrow: string
  title: string
  note?: string
  tags?: string[]
  accent?: string
}

export async function ogCard({ eyebrow, title, note, tags = [], accent = BRAND.accent }: Card) {
  const data = await font().catch(() => null)

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          background: '#0d0f12',
          backgroundImage: `radial-gradient(900px 500px at 82% -10%, ${accent}44, transparent 70%)`,
          color: '#eef0f3',
          fontFamily: 'Manrope',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
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
            }}
          >
            {BRAND.mark}
          </div>
          <div style={{ display: 'flex', fontSize: 34, letterSpacing: -0.5 }}>
            <span>Nanda</span>
            <span style={{ color: accent }}>Guessr</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ fontSize: 26, letterSpacing: 3, textTransform: 'uppercase', color: accent }}>{eyebrow}</div>
          <div style={{ fontSize: title.length > 34 ? 68 : 84, lineHeight: 1.05, letterSpacing: -2 }}>{title}</div>
          {note && <div style={{ fontSize: 30, color: '#a7afbb' }}>{note}</div>}
        </div>

        <div style={{ display: 'flex', gap: 14 }}>
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
