'use client'

import BackButton from './BackButton'
import { useI18n } from './i18n'
import { useHref } from './router'
import { hasDaily, type ModeId } from '@nanda/game'
import { WEEKDAYS } from './weekdays'

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

export function ProfileGhost({ own }: { own: boolean }) {
  const { t, lang } = useI18n()
  const href = useHref()

  return (
    <div className="profile sk-profile">
      <BackButton href={href.home}>{t('profile.back')}</BackButton>
      <div className="profile-grid">
        <div className="profile-column">
          <section className="card profile-card">
            <div className="profile-id">
              <span className="sk ava" />
              <div className="profile-names">
                <span className="sk nick" />
                <span className="sk tag" />
              </div>
            </div>
            <div className="level-panel">
              <div className="level-line">
                <span className="sk chip" />
                <span className="sk chip wide" />
              </div>
              <span className="sk bar" />
              <div className="level-line">
                <span className="sk chip" />
                <span className="sk chip wide" />
              </div>
            </div>
            <div className="profile-facts">
              {Array.from({ length: 4 }, (_, index) => (
                <span key={index} className="sk fact" />
              ))}
            </div>
            {!own && (
              <div className="profile-acts">
                <span className="sk act" />
                <span className="sk act" />
              </div>
            )}
          </section>

          {own && (
            <section className="card streak-card">
              <header>
                <span className="sk title" />
                <span className="sk chip" />
              </header>
              <div className="streak-now">
                <span className="sk flame" />
                <span className="sk count" />
                <span className="sk days" />
              </div>
              <ul className="streak-week">
                {WEEKDAYS[lang].map((name) => (
                  <li key={name}>
                    <span className="sk day" />
                    <small>{name}</small>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="card activity-card">
            <header>
              <span className="sk title" />
            </header>
            <ul className="activity">
              {Array.from({ length: 5 }, (_, index) => (
                <li key={index}>
                  <span className="sk dot" />
                  <span className="sk row">
                    <span className="sk row-main" />
                    <span className="sk row-sub" />
                  </span>
                  <span className="sk when" />
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="profile-middle">
          <section className="profile-metrics">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="card">
                <span className="sk chip" />
                <span className="sk big" />
              </div>
            ))}
          </section>
          <div className="profile-middle-cols">
            <div className="profile-column">
              <section className="card worlds-card">
                <header>
                  <div className="card-title">
                    <span className="sk title" />
                    <span className="sk chip wide" />
                  </div>
                </header>
                <ul className="worlds">
                  {Array.from({ length: 6 }, (_, index) => (
                    <li key={index}>
                      <span className="sk tag-box" />
                      <span className="sk name" />
                      <span className="sk count-mini" />
                      <span className="sk bar" />
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <div className="profile-column">
              <section className="card modes-card">
                <header>
                  <span className="sk title" />
                  <span className="sk chip" />
                </header>
                <ul className="modes-list">
                  {Array.from({ length: 10 }, (_, index) => (
                    <li key={index}>
                      <span className="sk name" />
                      <span className="sk count-mini" />
                      <span className="sk share" />
                      <span className="sk bar" />
                    </li>
                  ))}
                </ul>
              </section>

              <section className="card soon-card">
                <header>
                  <span className="sk title" />
                </header>
                <span className="sk chip wide" />
                <span className="sk chip wide" />
                <ul className="soon-badges">
                  {Array.from({ length: 6 }, (_, index) => (
                    <li key={index} />
                  ))}
                </ul>
                {own && <span className="sk open" />}
              </section>
            </div>
          </div>
        </div>
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

function AwardsGhost() {
  const { t } = useI18n()
  const href = useHref()

  return (
    <div className="awards-page sk-page">
      <BackButton href={href.profile}>{t('nav.profile')}</BackButton>
      <Head />
      <div className="awards-top">
        <span className="sk metric" />
        <span className="sk metric" />
        <span className="sk metric" />
      </div>
      <span className="sk showcase" />
      <span className="sk tabs" />
      <div className="sk-awards">
        {Array.from({ length: 6 }, (_, index) => (
          <span key={index} className="sk award" />
        ))}
      </div>
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
  if (section === 'profile' || section === 'u') return <ProfileGhost own={section === 'profile'} />
  if (section === 'leaderboard') return <BoardGhost />
  if (section === 'achievements') return <AwardsGhost />
  if (section === 'settings') return <SettingsGhost />
  if (section === 'friends') return <MatesGhost />
  return <PlainGhost />
}
