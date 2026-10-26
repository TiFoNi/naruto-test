'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { HERO_TILES_MAX, TONE_HEX, isHeroTile, levelAt, type HeroTile } from '@nanda/game'
import Avatar from './Avatar'
import { GAMES } from './games'
import BannerArt from './BannerArt'
import ProfileStage, { useNarrow } from './ProfileStage'
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
  const [tight, setTight] = useState(false)
  const narrow = useNarrow()

  useEffect(() => {
    const grid = pads.current
    if (!grid || typeof ResizeObserver === 'undefined') return
    const check = () => {
      const cell = grid.firstElementChild?.getBoundingClientRect()
      setTight(!!cell && cell.width < 200)
    }
    check()
    const watcher = new ResizeObserver(check)
    watcher.observe(grid)
    return () => watcher.disconnect()
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

  const tilesBlock =
    slots.length > 0 ? (
      <div
        className={`profile-hero-tiles ${narrow ? 'is-under' : ''}`}
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
    ) : null

  return (
    <>
      <section className="profile-hero shop-mock">
        <ProfileStage
          art={
            <>
              {!!banner && (
                <span className="profile-art" aria-hidden>
                  <BannerArt id={banner} look={user?.bannerLooks?.[banner]} place="profile" />
                </span>
              )}
              <div className="profile-banner" aria-hidden />
            </>
          }
        >
          <div className="profile-hero-id">
            <Avatar id={user?.id} name={user?.nickname ?? '?'} avatar={user?.avatar} frame={frame} />
            <div className="profile-hero-main">
              <div className="profile-hero-name" style={(nickHex ? { '--nick': nickHex } : {}) as CSSProperties}>
                <span className="hero-nick-line">
                  <span className="hero-nick-who">
                    <h1>{user?.nickname ?? '—'}</h1>
                  </span>
                </span>
                {user?.tag && <i className="player-tag">#{user.tag}</i>}
                {worn && <i className={`player-title is-${worn} is-under`}>{t(`title.${worn}` as UiKey)}</i>}
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
          {!narrow && tilesBlock}
        </ProfileStage>
      </section>

      {narrow && tilesBlock && <div className="profile-hero-body is-under profile-tiles-out">{tilesBlock}</div>}
    </>
  )
}
