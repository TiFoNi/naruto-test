'use client'

import type { CSSProperties, ReactNode } from 'react'
import BackButton from './BackButton'
import { useI18n } from './i18n'
import { useHref } from './router'
import { HERO_TILES_MAX, PROFILE_BLOCKS_DEFAULT, hasDaily, type ModeId, type ProfileBlock } from '@nanda/game'


function Head({ withMark }: { withMark?: boolean }) {
  return (
    <header className="sk-head">
      {withMark && <span className="sk mark" />}
      <span className="sk line" />
      <span className="sk line sub" />
    </header>
  )
}

function PlayGhost({ mode }: { mode?: string }) {
  const { t } = useI18n()
  const href = useHref()

  return (
    <div className="game-view sk-page">
      <BackButton href={href.home}>{t('play.back')}</BackButton>
      <header className="game-head">
        <div className="game-title">
          <div className="game-name">
            <span className="sk mark" />
            <span className="sk line" />
          </div>
        </div>
        {!!mode && hasDaily(mode as ModeId) && (
          <div className="game-switches">
            <span className="sk tabs" />
          </div>
        )}
      </header>
      <section className="play-layout">
        <div className="play-main">
          <span className="sk panel" />
          <span className="sk tries" />
        </div>
        <aside className="play-side">
          <span className="sk stats" />
          <span className="sk legend" />
          <span className="sk actions" />
        </aside>
      </section>
    </div>
  )
}

export function ProfileGhost() {
  const { t } = useI18n()
  const href = useHref()
  const plan = { blocks: PROFILE_BLOCKS_DEFAULT, sides: {} as Record<string, number>, sizes: {} as Record<string, number>, tiles: HERO_TILES_MAX }
  const cards: Record<ProfileBlock, ReactNode> = {
    worlds: (
      <section className="card worlds-card">
        <header>
          <span className="sk title" />
          <span className="sk chip" />
        </header>
        <ul className="world-shelf">
          {Array.from({ length: 4 }, (_, index) => (
            <li key={index}>
              <span className="sk world-pic" />
            </li>
          ))}
        </ul>
      </section>
    ),
    awards: (
      <section className="card soon-card">
        <header>
          <span className="sk title" />
          <span className="sk chip" />
        </header>
        <ul className="soon-badges">
          {Array.from({ length: 4 }, (_, index) => (
            <li key={index}>
              <span className="sk soon-mark" />
            </li>
          ))}
        </ul>
      </section>
    ),
    facts: (
      <section className="card profile-card">
        <div className="profile-facts">
          <span className="sk fact" />
          <span className="sk fact" />
        </div>
      </section>
    ),
    activity: (
      <section className="card activity-card">
        <header>
          <span className="sk title" />
        </header>
        <ul className="activity">
          {Array.from({ length: 5 }, (_, index) => (
            <li key={index}>
              <span className="sk dot" />
              <span className="sk row" />
              <span className="sk when" />
            </li>
          ))}
        </ul>
      </section>
    ),
  }

  const seats = plan.blocks.map((block, index) => ({ block, index, side: plan.sides[block] ?? index % 2 }))

  return (
    <div className="profile sk-profile">
      <BackButton href={href.home}>{t('profile.back')}</BackButton>
      <section className="profile-hero">
        <div className="profile-banner" aria-hidden />
        <div className="profile-hero-body">
          <div className="profile-hero-id">
            <span className="sk ava" />
            <div className="profile-hero-main">
              <div className="profile-hero-name">
                <span className="sk nick" />
                <span className="sk tag" />
              </div>
              <div className="level-panel">
                <div className="level-line">
                  <span className="sk chip wide" />
                  <span className="sk chip lvl" />
                </div>
                <span className="sk bar" />
              </div>
            </div>
          </div>
          <div className="profile-hero-tiles">
            {Array.from({ length: plan.tiles }, (_, index) => (
              <div key={index} className="hero-tile">
                <span className="sk chip" />
                <span className="sk big" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="profile-grid">
        {[0, 1].map((column) => (
          <div className="profile-stack" key={column}>
            {seats
              .filter((seat) => seat.side === column)
              .map(({ block, index }) => (
                <div
                  className={`profile-slot slot-${block}`}
                  key={block}
                  style={{ order: index, ...(plan.sizes[block] ? { '--slot-h': `${plan.sizes[block]}px` } : {}) } as CSSProperties}
                >
                  {cards[block]}
                </div>
              ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function BoardGhost() {
  return (
    <div className="leaderboard sk-page">
      <Head />
      <div className="lb-filters">
        <span className="sk tabs" />
      </div>
      <div className="lb-layout">
        <section className="lb-main">
          <span className="sk season" />
          <span className="sk table" />
        </section>
        <aside className="lb-side">
          <span className="sk side" />
        </aside>
      </div>
    </div>
  )
}

export function AwardsGhost() {
  const { t } = useI18n()
  const href = useHref()

  return (
    <div className="awards-page sk-page">
      <BackButton href={href.profile}>{t('nav.profile')}</BackButton>
      <section className="card awards-hero">
        <span className="sk ring" />
        <span className="sk head" />
        <div className="awards-hero-body">
          <span className="sk line" />
          <div className="awards-shelf">
            <span className="sk shelf-label" />
            {Array.from({ length: 8 }, (_, index) => (
              <span key={index} className="sk chip-square" />
            ))}
          </div>
        </div>
        <div className="awards-tiers">
          {Array.from({ length: 6 }, (_, index) => (
            <span key={index} className="sk tier-card" />
          ))}
        </div>
      </section>
      <div className="awards-sort">
        <span className="sk pills" />
        <span className="sk rail" />
      </div>

      {Array.from({ length: 2 }, (_, group) => (
        <section key={group} className="awards-group">
          <span className="sk group-title" />
          <div className="awards-grid">
            {Array.from({ length: group ? 3 : 6 }, (_, index) => (
              <span key={index} className="sk award" />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function SettingsGhost() {
  const { t } = useI18n()
  const href = useHref()

  return (
    <div className="settings sk-page">
      <BackButton href={href.profile}>{t('nav.profile')}</BackButton>
      <Head />
      <div className="settings-layout">
        <span className="sk nav" />
        <span className="sk block" />
      </div>
    </div>
  )
}

function PlainGhost() {
  return (
    <div className="sk-page sk-plain">
      <Head />
      <span className="sk panel" />
      <span className="sk tries" />
    </div>
  )
}

function MatesGhost() {
  const { t } = useI18n()
  const href = useHref()

  return (
    <div className="mates sk-page">
      <BackButton href={href.profile}>{t('nav.profile')}</BackButton>
      <Head />
      <span className="sk block short" />
      <span className="sk block" />
    </div>
  )
}

export default function PageSkeleton({ section, mode }: { section?: string; mode?: string }) {
  if (section === 'play') return <PlayGhost mode={mode} />
  if (section === 'profile' || section === 'u') return <ProfileGhost />
  if (section === 'leaderboard') return <BoardGhost />
  if (section === 'achievements') return <AwardsGhost />
  if (section === 'settings') return <SettingsGhost />
  if (section === 'friends') return <MatesGhost />
  return <PlainGhost />
}
