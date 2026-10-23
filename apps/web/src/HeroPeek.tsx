'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { HERO_TILES_MAX, TONE_HEX, isHeroTile, levelAt, type HeroTile } from '@nanda/game'
import Avatar from './Avatar'
import { GAMES } from './games'
import { bannerClips, bannerPic, bannerSpot, isLive } from './banners'
import { useI18n, type UiKey } from './i18n'
import type { User } from './auth'

export type PeekStats = {
  tiles?: (string | null)[] | null
  totals?: { solved?: number }
  duels?: { played: number; wins: number }
  rank?: { position: number } | null
  awards?: number
  awardsTotal?: number
  challenges?: { solved: number }
  streak?: { current: number }
}

type Props = { user: User | null; stats: PeekStats | null; banner: string | null; frame: string | null }

const DEFAULT_TILES: HeroTile[] = ['solved', 'awards', 'streak']

const share = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0)

const medal = (place: number) => (place === 1 ? 'gold' : place === 2 ? 'silver' : place === 3 ? 'bronze' : '')

export default function HeroPeek({ user, stats, banner, frame }: Props) {
  const { t } = useI18n()
  const pads = useRef<HTMLDivElement>(null)
  const [spot, setSpot] = useState<'row' | 'column' | 'under'>('row')
  const [tight, setTight] = useState(false)

  useEffect(() => {
    const grid = pads.current
    if (!grid || typeof ResizeObserver === 'undefined') return
    const check = () => {
      const wide = grid.parentElement?.getBoundingClientRect().width ?? 0
      const room = wide - 60
      const area = 440 + Math.max(0, (room - 802) / 2)
      const slot = Math.max(150, Math.round((area - (HERO_TILES_MAX - 1) * 10) / HERO_TILES_MAX))
      grid.style.setProperty('--slot', `${slot}px`)
      const cell = grid.firstElementChild?.getBoundingClientRect()
      setSpot(wide <= 800 || room < 594 ? 'under' : slot >= 180 ? 'row' : 'column')
      setTight(!!cell && cell.width < 150)
    }
    check()
    const watcher = new ResizeObserver(check)
    watcher.observe(grid)
    window.addEventListener('resize', check)
    return () => {
      watcher.disconnect()
      window.removeEventListener('resize', check)
    }
  })

  const stand = levelAt(user?.xp ?? 0)
  const saved = stats?.tiles
  const slots = (Array.isArray(saved) ? saved.filter(isHeroTile) : DEFAULT_TILES).slice(0, HERO_TILES_MAX)

  const name = (wide: UiKey, slim: UiKey) => t(tight ? slim : wide)

  const faceOf = (one: HeroTile) => {
    if (one === 'duels')
      return {
        label: t('profile.duelsTitle'),
        value: stats?.duels?.played ? `${share(stats.duels.wins, stats.duels.played)}%` : '—',
      }
    if (one === 'rank')
      return { label: name('profile.rank', 'profile.rankShort'), value: stats?.rank ? `#${stats.rank.position}` : '—' }
    if (one === 'awards')
      return {
        label: name('profile.block.awards', 'profile.awardsShort'),
        value: `${stats?.awards ?? 0}`,
        tail: `/ ${stats?.awardsTotal ?? 0}`,
      }
    if (one === 'challenges')
      return { label: name('profile.challengeSolved', 'profile.challengeShort'), value: `${stats?.challenges?.solved ?? 0}` }
    if (one === 'streak')
      return { label: name('profile.streakTitle', 'profile.streakShort'), value: `${stats?.streak?.current ?? 0}` }
    return { label: name('profile.characters', 'profile.charactersShort'), value: `${stats?.totals?.solved ?? 0}` }
  }

  const worn = user?.title ?? null

  const nickHex = GAMES.find((game) => game.id === user?.nickTone)?.accent ?? (user?.nickTone && TONE_HEX.test(user.nickTone) ? user.nickTone : undefined)

  return (
    <section className="profile-hero shop-mock">
      {!!banner && (
        <span className="profile-art" aria-hidden>
          {isLive(banner) ? (
            <video autoPlay loop muted playsInline preload="auto" poster={bannerPic(banner)} style={{ objectPosition: bannerSpot(banner) }}>
              {bannerClips(banner).map((clip) => (
                <source key={clip.type} src={clip.src} type={clip.type} />
              ))}
            </video>
          ) : (
            <img src={bannerPic(banner)} alt="" style={{ objectPosition: bannerSpot(banner) }} />
          )}
        </span>
      )}
      <div className="profile-banner" aria-hidden />

      <div className={`profile-hero-body ${spot === 'under' ? 'is-under' : ''} ${spot === 'column' ? 'is-stack' : ''}`}>
        <div className="profile-hero-id">
          <Avatar id={user?.id} name={user?.nickname ?? '?'} avatar={user?.avatar} frame={frame} />
          <div className="profile-hero-main">
            <div className="profile-hero-name" style={(nickHex ? { '--nick': nickHex } : {}) as CSSProperties}>
              <span className="hero-nick-line">
                <h1>{user?.nickname ?? '—'}</h1>
                {worn && <i className={`player-title is-${worn}`}>{t(`title.${worn}` as UiKey)}</i>}
              </span>
              {user?.tag && <i className="player-tag">#{user.tag}</i>}
            </div>

            <div className="level-panel">
              <div className="level-line">
                <span className="level-xp">
                  <b>{stand.into}</b> / {stand.need} XP
                </span>
                <span className="profile-hero-level">{t('nav.level', { level: stand.level })}</span>
              </div>
              <div className="level-bar" aria-hidden>
                <i style={{ width: `${share(stand.into, stand.need)}%` }} />
              </div>
            </div>
          </div>
        </div>

        {slots.length > 0 && (
          <div
            className={`profile-hero-tiles ${spot === 'column' ? 'is-stack' : ''} ${spot === 'under' ? 'is-under' : ''}`}
            ref={pads}
          >
            {slots.map((one) => {
              const face = faceOf(one)
              return (
                <div
                  key={one}
                  className={`hero-tile ${one === 'rank' && stats?.rank ? medal(stats.rank.position) : ''}`}
                  style={{ animation: 'none' } as CSSProperties}
                >
                  <span>{face.label}</span>
                  <b>
                    {face.value}
                    {'tail' in face && face.tail ? <i>{face.tail}</i> : null}
                  </b>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
