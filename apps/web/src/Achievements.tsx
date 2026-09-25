'use client'

import { useEffect, useMemo, useState } from 'react'
import { api } from './api'
import BackButton from './BackButton'
import { useI18n, type UiKey } from './i18n'
import Link from 'next/link'
import { CheckIcon, CloseIcon, LockIcon, PinIcon, TrophyIcon } from './icons'
import { useHref } from './router'
import { keepPerUser } from './session-cache'

type Tier = 'bronze' | 'silver' | 'gold' | 'legend'

type Award = {
  id: string
  category: string
  tier: Tier
  target: number
  xp: number
  secret: boolean
  done: boolean
  at: string | null
  progress: number
  rarity: number
}

type Board = {
  achievements: Award[]
  earned: number
  xp: number
  xpLeft: number
  rarest: { id: string; rarity: number } | null
  rank: number | null
  pinned: string[]
}

const PINNED_MAX = 6

type Filter = 'all' | 'done' | 'doing' | 'locked'

const CATEGORIES = ['guessing', 'duels', 'streaks', 'modes', 'worlds', 'ranking', 'secret']
const TIERS: Tier[] = ['bronze', 'silver', 'gold', 'legend']
const FILTERS: { id: Filter; label: UiKey }[] = [
  { id: 'all', label: 'ach.all' },
  { id: 'done', label: 'ach.done' },
  { id: 'doing', label: 'ach.doing' },
  { id: 'locked', label: 'ach.locked' },
]

const LOCALES = { ru: 'ru-RU', uk: 'uk-UA', en: 'en-GB' } as const

function Card({ award, pinned, onPin }: { award: Award; pinned: boolean; onPin: () => void }) {
  const { t, lang } = useI18n()
  const hidden = award.secret && !award.done
  const share = award.rarity > 0 ? t('ach.share', { share: award.rarity }) : ''

  return (
    <article className={`award ${award.tier} ${award.done ? 'done' : hidden ? 'hidden' : ''}`}>
      <span className="award-mark" aria-hidden>
        {award.done ? <CheckIcon /> : hidden ? <LockIcon /> : <TrophyIcon />}
      </span>
      {award.done && (
        <button type="button" className={`award-pin ${pinned ? 'on' : ''}`} title={t(pinned ? 'ach.unpin' : 'ach.pin')} aria-label={t(pinned ? 'ach.unpin' : 'ach.pin')} aria-pressed={pinned} onClick={onPin}>
          <PinIcon />
        </button>
      )}
      <div className="award-body">
        <div className="award-head">
          <b>{hidden ? '???' : t(`ach.${award.id}` as UiKey)}</b>
          <span className="award-tier">{hidden ? t('ach.secret') : t(`achTier.${award.tier}` as UiKey)}</span>
        </div>
        <p>{hidden ? t('ach.secretHint') : t(`ach.${award.id}.hint` as UiKey)}</p>
        <div className="award-foot">
          {award.done ? (
            <span className="award-date">
              <CheckIcon /> {award.at ? new Date(award.at).toLocaleDateString(LOCALES[lang], { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''}
            </span>
          ) : hidden ? (
            <span className="award-date muted">{t('ach.hidden')}</span>
          ) : (
            <span className="award-bar">
              <span style={{ width: `${Math.round((award.progress / award.target) * 100)}%` }} />
            </span>
          )}
          {!award.done && !hidden && (
            <span className="award-count">
              {award.progress} / {award.target}
            </span>
          )}
          {share && <span className="award-rarity">{share}</span>}
        </div>
      </div>
    </article>
  )
}

let known: Board | null = null

keepPerUser(() => {
  known = null
})

export default function Achievements() {
  const { t } = useI18n()
  const href = useHref()
  const [board, setBoard] = useState<Board | null>(known)
  const [error, setError] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')

  useEffect(() => {
    let alive = true
    api<Board>('achievements')
      .then(({ ok, data }) => {
        if (!alive) return
        if (ok) {
          known = data
          setBoard(data)
        } else setError(true)
      })
      .catch(() => alive && setError(true))
    return () => {
      alive = false
    }
  }, [])

  const list = board?.achievements ?? []
  const shown = useMemo(
    () =>
      list.filter((a) =>
        filter === 'done' ? a.done : filter === 'doing' ? !a.done && a.progress > 0 : filter === 'locked' ? !a.done && a.progress === 0 : true,
      ),
    [list, filter],
  )
  const counts: Record<Filter, number> = {
    all: list.length,
    done: list.filter((a) => a.done).length,
    doing: list.filter((a) => !a.done && a.progress > 0).length,
    locked: list.filter((a) => !a.done && a.progress === 0).length,
  }
  const share = list.length ? Math.round((counts.done / list.length) * 100) : 0
  const rarest = board?.rarest ? list.find((a) => a.id === board.rarest!.id) : null
  const pinned = board?.pinned ?? []

  const togglePin = (id: string) => {
    const next = pinned.includes(id) ? pinned.filter((p) => p !== id) : [...pinned, id].slice(0, PINNED_MAX)
    setBoard((current) => {
      const updated = current ? { ...current, pinned: next } : current
      known = updated
      return updated
    })
    void api('achievements', { pinned: next })
  }

  return (
    <div className="awards-page">
      <div className="awards-top">
        <header className="lb-head">
          <BackButton href={href.profile}>{t('nav.profile')}</BackButton>
          <h1>{t('ach.title')}</h1>
          <p className="muted">{t('ach.lead')}</p>
        </header>
      </div>

      {error ? (
        <div className="card center muted">{t('err.server')}</div>
      ) : (
        <>
          <div className="awards-summary">
            <div className="play-card awards-stat">
              <span className="play-card-title">{t('ach.collection')}</span>
              <p className="awards-big">
                <b>{counts.done}</b>
                <span>/ {list.length}</span>
                <i>{share}%</i>
              </p>
              <span className="lb-bar big">
                <span style={{ width: `${share}%` }} />
              </span>
            </div>

            <div className="play-card awards-stat">
              <span className="play-card-title">{t('ach.xpEarned')}</span>
              <p className="awards-big">
                <b>{board?.xp ?? 0}</b>
                <span>XP</span>
              </p>
              <small className="muted">{t('ach.xpLeft', { xp: board?.xpLeft ?? 0 })}</small>
            </div>

            <div className={`play-card awards-stat awards-rare ${rarest ? rarest.tier : ''}`}>
              {rarest ? (
                <>
                  <span className="award-mark" aria-hidden>
                    <TrophyIcon />
                  </span>
                  <span className="awards-rare-text">
                    <span className="play-card-title">{t('ach.rarest')}</span>
                    <b>{t(`ach.${rarest.id}` as UiKey)}</b>
                    <i>{t('ach.shareOnly', { share: rarest.rarity })}</i>
                  </span>
                </>
              ) : (
                <span className="awards-rare-text">
                  <span className="play-card-title">{t('ach.rarest')}</span>
                  <small className="muted">{t('ach.empty')}</small>
                </span>
              )}
            </div>

            <div className="play-card awards-tiers">
              {TIERS.map((tier) => {
                const all = list.filter((a) => a.tier === tier)
                const done = all.filter((a) => a.done).length
                return (
                  <span key={tier} className={`awards-tier ${tier}`}>
                    <i />
                    {t(`achTier.${tier}` as UiKey)}
                    <span className="lb-bar">
                      <span style={{ width: `${all.length ? (done / all.length) * 100 : 0}%` }} />
                    </span>
                    <b>
                      {done}/{all.length}
                    </b>
                  </span>
                )
              })}
            </div>
          </div>

          <section className="play-card awards-showcase">
            <div className="awards-showcase-copy">
              <h2>
                {t('ach.showcase')}
                <span>
                  {pinned.length}/{PINNED_MAX}
                </span>
              </h2>
              <p>{t('ach.showcaseHint')}</p>
            </div>
            <ol className="awards-slots">
              {Array.from({ length: PINNED_MAX }, (_, index) => {
                const award = pinned[index] ? list.find((a) => a.id === pinned[index]) : undefined
                return (
                  <li key={index} className={`awards-slot ${award ? award.tier : 'free'}`}>
                    <i>{index + 1}</i>
                    {award ? (
                      <>
                        <button type="button" className="awards-slot-drop" aria-label={t('ach.unpin')} onClick={() => togglePin(award.id)}>
                          <CloseIcon />
                        </button>
                        <span className="award-mark" aria-hidden>
                          <TrophyIcon />
                        </span>
                        <b>{t(`ach.${award.id}` as UiKey)}</b>
                      </>
                    ) : (
                      <span className="awards-slot-free">{t('ach.showcaseEmpty')}</span>
                    )}
                  </li>
                )
              })}
            </ol>
            <Link className="awards-showcase-link" href={href.profile}>
              {t('ach.myProfile')} →
            </Link>
          </section>

          <div className="awards-filters" role="tablist">
            {FILTERS.map(({ id, label }) => (
              <button key={id} type="button" role="tab" aria-selected={filter === id} className={filter === id ? 'active' : ''} onClick={() => setFilter(id)}>
                {t(label)} <b>{counts[id]}</b>
              </button>
            ))}
          </div>

          {CATEGORIES.map((category) => {
            const group = shown.filter((a) => a.category === category)
            if (!group.length) return null
            const total = list.filter((a) => a.category === category)
            return (
              <section key={category} className="awards-group">
                <h2>
                  {t(`achCat.${category}` as UiKey)}
                  <span>
                    {total.filter((a) => a.done).length}/{total.length}
                  </span>
                </h2>
                <div className="awards-grid">
                  {group.map((award) => (
                    <Card key={award.id} award={award} pinned={pinned.includes(award.id)} onPin={() => togglePin(award.id)} />
                  ))}
                </div>
              </section>
            )
          })}
        </>
      )}
    </div>
  )
}
