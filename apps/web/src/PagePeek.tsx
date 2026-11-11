'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import BannerArt from './BannerArt'
import HeroPeek, { type PeekStats } from './HeroPeek'
import { spotLook } from './banners'
import { pageZoom } from './profile-zoom'
import { useI18n } from './i18n'
import { CloseIcon } from './icons'
import type { User } from './auth'

const BANNER_RATIO = 2800 / 780
const GLOW_CROP = 1.12
const GLOW_WIDE = 1440
const GLOW_GROW = 1.5
const HERO_TOP = 111

export default function PagePeek({ user, stats, banner, frame }: { user: User | null; stats: PeekStats | null; banner: string | null; frame: string | null }) {
  const { l } = useI18n()
  const [wide, setWide] = useState(0)

  useEffect(() => {
    const sync = () => setWide(window.innerWidth)
    sync()
    window.addEventListener('resize', sync)
    return () => window.removeEventListener('resize', sync)
  }, [])

  if (!wide) return null

  const zoom = pageZoom(wide)
  const stretch = GLOW_CROP + (Math.max(0, GLOW_WIDE - wide) / GLOW_WIDE) * GLOW_GROW
  const look = banner ? spotLook(banner) : undefined

  return (
    <section className="peek-sheet">
      <button type="button" className="peek-close" aria-label={l({ ru: 'Закрыть', uk: 'Закрити', en: 'Close' })} title={l({ ru: 'Закрыть', uk: 'Закрити', en: 'Close' })}>
        <CloseIcon />
      </button>
      {!!banner && (
        <span className="profile-glow" aria-hidden style={{ height: (wide / BANNER_RATIO) * stretch }}>
          <BannerArt id={banner} look={{ desktop: look }} place="profile" focus />
        </span>
      )}
      <div className="peek-column" style={{ zoom, paddingTop: HERO_TOP / zoom } as CSSProperties}>
        <HeroPeek user={user} stats={stats} banner={banner} frame={frame} under={false} bare />
        <div className="peek-board" aria-hidden>
          {[0, 1].map((block) => (
            <section key={block} className="card peek-block">
              <header>
                <span className="sk peek-title" />
                <span className="sk peek-chip" />
              </header>
              <div className="peek-row">
                {Array.from({ length: 4 }, (_, index) => (
                  <span key={index} className="sk peek-item" />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </section>
  )
}
