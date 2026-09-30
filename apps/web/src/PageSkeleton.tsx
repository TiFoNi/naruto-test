'use client'

import BackButton from './BackButton'
import { useI18n } from './i18n'
import { useHref } from './router'

function Head({ withMark }: { withMark?: boolean }) {
  return (
    <header className="sk-head">
      {withMark && <span className="sk mark" />}
      <span className="sk line" />
      <span className="sk line sub" />
    </header>
  )
}

function PlayGhost() {
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
        <div className="game-switches">
          <span className="sk tabs" />
          <span className="sk tabs" />
        </div>
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

function ProfileGhost() {
  const { t } = useI18n()
  const href = useHref()

  return (
    <div className="profile sk-page">
      <BackButton href={href.home}>{t('profile.back')}</BackButton>
      <div className="profile-grid">
        <div className="profile-column">
          <span className="sk who" />
          <span className="sk streak" />
          <span className="sk activity" />
        </div>
        <div className="profile-middle">
          <section className="profile-metrics">
            <span className="sk metric" />
            <span className="sk metric" />
            <span className="sk metric" />
            <span className="sk metric" />
          </section>
          <div className="profile-middle-cols">
            <div className="profile-column">
              <span className="sk panel-tall" />
            </div>
            <div className="profile-column">
              <span className="sk panel-tall" />
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

export default function PageSkeleton({ section }: { section?: string }) {
  if (section === 'play') return <PlayGhost />
  if (section === 'profile' || section === 'u') return <ProfileGhost />
  if (section === 'leaderboard') return <BoardGhost />
  if (section === 'achievements') return <AwardsGhost />
  if (section === 'settings') return <SettingsGhost />
  return <PlainGhost />
}
