'use client'

import { useEffect, useMemo, useState } from 'react'
import { api } from './api'
import BackButton from './BackButton'
import { useI18n, type UiKey } from './i18n'
import Link from 'next/link'
import { ArrowIcon, CheckIcon, CloseIcon, GiftIcon, LockIcon, PinIcon, TrophyIcon } from './icons'
import { useAuth } from './auth'
import { putAwards } from './awards'
import { useHref } from './router'
import { keepPerUser } from './session-cache'

type Tier = 'bronze' | 'silver' | 'gold' | 'legend' | 'secret'

type Award = {
  id: string
  family: string
  category: string
  tier: Tier
  kind: 'life' | 'season'
  target: number
  xp: number
  secret: boolean
  done: boolean
  claimed: boolean
  at: string | null
  progress: number
  rarity: number
}

type Board = {
  achievements: Award[]
  earned: number
  xp: number
  xpLeft: number
  ready: number
  xpReady: number
  rarest: { id: string; rarity: number } | null
  rank: number | null
  pinned: string[]
}

const PINNED_MAX = 8

type Filter = 'all' | 'ready' | 'done' | 'doing' | 'locked'

const CATEGORIES = ['season', 'guessing', 'duels', 'streaks', 'modes', 'worlds', 'ranking', 'secret']
const TIERS: Tier[] = ['bronze', 'silver', 'gold', 'legend', 'secret']
const FILTERS: { id: Filter; label: UiKey }[] = [
  { id: 'all', label: 'ach.all' },
  { id: 'ready', label: 'ach.ready' },
  { id: 'done', label: 'ach.done' },
  { id: 'doing', label: 'ach.doing' },
  { id: 'locked', label: 'ach.locked' },
]

const LOCALES = { ru: 'ru-RU', uk: 'uk-UA', en: 'en-GB' } as const

type Family = {
  id: string
  single: boolean
  category: string
  kind: 'life' | 'season'
  steps: Award[]
  value: number
  next: Award | null
  ready: Award | null
  open: Award
  done: number
}

const families = (list: Award[]): Family[] => {
  const byFamily = new Map<string, Award[]>()
  for (const award of list) {
    const key = award.family ?? award.id
    byFamily.set(key, [...(byFamily.get(key) ?? []), award])
  }

  return [...byFamily.entries()].map(([id, all]) => {
    const steps = [...all].sort((one, two) => one.target - two.target)
    const next = steps.find((step) => !step.done) ?? null
    const ready = steps.find((step) => step.done && !step.claimed) ?? null
    return {
      id,
      single: steps.length === 1,
      category: steps[0].category,
      kind: steps[0].kind,
      steps,
      value: Math.max(...steps.map((step) => step.progress)),
      next,
      ready,
      open: ready ?? next ?? steps[steps.length - 1],
      done: steps.filter((step) => step.done).length,
    }
  })
}

function Card({ family, pinned, busy, onPin, onOpen }: { family: Family; pinned: string[]; busy: boolean; onPin: (id: string) => void; onOpen: (id: string) => void }) {
  const { t, lang } = useI18n()
  const { steps, value, next, ready, single } = family
  const last = steps[steps.length - 1]
  const hidden = steps.every((step) => step.secret && !step.done)
  const goal = next ?? last
  const crown = steps.filter((step) => step.done).pop() ?? steps[0]
  const name = single ? (hidden ? '???' : t(`ach.${steps[0].id}` as UiKey)) : t(`achFam.${family.id}` as UiKey)
  const hint = hidden ? t('ach.secretHint') : t(`ach.${goal.id}.hint` as UiKey)
  const share = goal.rarity > 0 ? t('ach.share', { share: goal.rarity }) : ''
  const held = steps.find((step) => step.claimed && pinned.includes(step.id))
  const pinnable = [...steps].reverse().find((step) => step.claimed)
  const whole = !next

  return (
    <article className={`award tier-${crown.tier} ${whole ? 'done' : ready ? 'is-ready' : ''} ${hidden ? 'hidden' : ''}`}>
      <button type="button" className="award-open" aria-label={name} disabled={busy} onClick={() => onOpen(family.open.id)}>
        <span className="award-mark" aria-hidden>
          {ready ? <GiftIcon /> : hidden ? <LockIcon /> : <TrophyIcon />}
        </span>
        <div className="award-body">
          <div className="award-head">
            <b>{name}</b>
            <span className="award-tier">
              {!single && <i className="award-steps">{family.done}/{steps.length}</i>}
              {hidden ? t('ach.secret') : t(`achTier.${crown.tier}` as UiKey)}
            </span>
          </div>
          <p title={hint}>{hint}</p>
          <span className="award-kind">{t(family.kind === 'season' ? 'ach.kindSeason' : 'ach.kindLife')}</span>
        </div>
        <div className="award-foot">
          {whole ? (
            <span className="award-date">
              <CheckIcon /> {last.at ? new Date(last.at).toLocaleDateString(LOCALES[lang], { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''}
            </span>
          ) : hidden ? (
            <span className="award-date muted">{t('ach.hidden')}</span>
          ) : null}

          <span className={`award-bar ${steps.length > 1 ? 'parts' : ''}`}>
            {steps.map((step, index) => {
              const floor = index === 0 ? 0 : steps[index - 1].target
              const fill = Math.max(0, Math.min(1, (value - floor) / Math.max(1, step.target - floor)))
              return (
                <span key={step.id} className={step.done ? 'done' : ''}>
                  <i style={{ width: `${Math.round(fill * 100)}%` }} />
                </span>
              )
            })}
          </span>

          {!whole && !hidden && (
            <span className="award-count">
              {value.toLocaleString(LOCALES[lang])} / {goal.target.toLocaleString(LOCALES[lang])}
            </span>
          )}
          {share && !hidden && (
            <span className="award-rarity" title={share}>
              {ready ? `${goal.rarity}%` : share}
            </span>
          )}
          {ready && <span className="award-reward">+{ready.xp} XP</span>}
        </div>
      </button>

      {pinnable && (
        <button
          type="button"
          className={`award-pin ${held ? 'on' : ''}`}
          title={t(held ? 'ach.unpin' : 'ach.pin')}
          aria-label={t(held ? 'ach.unpin' : 'ach.pin')}
          aria-pressed={!!held}
          onClick={() => onPin(held ? held.id : pinnable.id)}
        >
          <PinIcon />
        </button>
      )}
    </article>
  )
}

function AwardModal({
  award,
  pinned,
  busy,
  onPin,
  onClaim,
  onClose,
}: {
  award: Award
  pinned: boolean
  busy: boolean
  onPin: () => void
  onClaim: () => void
  onClose: () => void
}) {
  const { t, lang } = useI18n()
  const hidden = award.secret && !award.done
  const waiting = award.done && !award.claimed
  const percent = Math.min(Math.round((award.progress / award.target) * 100), 100)

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <section
        className={`card modal award-modal tier-${award.tier}`}
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="modal-close" aria-label={t('profile.close')} onClick={onClose}>
          <CloseIcon />
        </button>
        <span className="award-modal-mark" aria-hidden>
          {waiting ? <GiftIcon /> : hidden ? <LockIcon /> : <TrophyIcon />}
        </span>
        <h2>{hidden ? '???' : t(`ach.${award.id}` as UiKey)}</h2>
        <p className="award-modal-hint">{hidden ? t('ach.secretHint') : t(`ach.${award.id}.hint` as UiKey)}</p>
        <div className="award-modal-tags">
          <em>{hidden ? t('ach.secret') : t(`achTier.${award.tier}` as UiKey)}</em>
        </div>
        <span className="award-modal-kind">{t(award.kind === 'season' ? 'ach.kindSeason' : 'ach.kindLife')}</span>

        {!hidden && (
          <div className="award-modal-progress">
            <span className="award-bar">
              <span style={{ width: `${percent}%` }} />
            </span>
            <b>
              {Math.min(award.progress, award.target)} / {award.target}
            </b>
          </div>
        )}

        <dl className="award-modal-facts">
          <div>
            <dt>{t('ach.rewardTitle')}</dt>
            <dd>+{award.xp} XP</dd>
          </div>
          {award.rarity > 0 && (
            <div>
              <dt>{t('ach.rarityTitle')}</dt>
              <dd>{award.rarity}%</dd>
            </div>
          )}
          {award.claimed && award.at && (
            <div>
              <dt>{t('ach.gotTitle')}</dt>
              <dd>{new Date(award.at).toLocaleDateString(LOCALES[lang], { day: '2-digit', month: '2-digit', year: 'numeric' })}</dd>
            </div>
          )}
        </dl>

        <div className="award-modal-actions">
          {waiting && (
            <button type="button" className="primary" disabled={busy} onClick={onClaim}>
              {t('ach.claim', { xp: award.xp })}
            </button>
          )}
          {award.claimed && (
            <button type="button" className="ghost" disabled={busy} onClick={onPin}>
              <PinIcon /> {t(pinned ? 'ach.unpin' : 'ach.pin')}
            </button>
          )}
        </div>
      </section>
    </div>
  )
}

let known: Board | null = null

keepPerUser(() => {
  known = null
})

export default function Achievements() {
  const { t } = useI18n()
  const href = useHref()
  const { refresh } = useAuth()
  const [board, setBoard] = useState<Board | null>(known)
  const [error, setError] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [claiming, setClaiming] = useState<string | null>(null)
  const [opened, setOpened] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    api<Board>('achievements')
      .then(({ ok, data }) => {
        if (!alive) return
        if (ok) {
          known = data
          setBoard(data)
          putAwards(data.achievements)
        } else setError(true)
      })
      .catch(() => alive && setError(true))
    return () => {
      alive = false
    }
  }, [])

  const list = board?.achievements ?? []
  const rows = useMemo(() => families(list), [list])
  const fits = (one: Family, kind: Filter) =>
    kind === 'ready'
      ? !!one.ready
      : kind === 'done'
        ? !one.next
        : kind === 'doing'
          ? !!one.next && one.value > 0
          : kind === 'locked'
            ? !!one.next && one.value === 0
            : true
  const shown = useMemo(() => rows.filter((one) => fits(one, filter)), [rows, filter])
  const counts: Record<Filter, number> = {
    all: rows.length,
    ready: rows.filter((one) => fits(one, 'ready')).length,
    done: rows.filter((one) => fits(one, 'done')).length,
    doing: rows.filter((one) => fits(one, 'doing')).length,
    locked: rows.filter((one) => fits(one, 'locked')).length,
  }
  const share = list.length ? Math.round((list.filter((a) => a.done).length / list.length) * 100) : 0
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

  const active = opened ? (list.find((a) => a.id === opened) ?? null) : null

  useEffect(() => {
    if (!active) return
    const root = document.documentElement
    const held = { overflow: root.style.overflow, pad: document.body.style.paddingRight }
    const bar = window.innerWidth - root.clientWidth
    root.style.overflow = 'hidden'
    if (bar > 0) document.body.style.paddingRight = `${bar}px`
    const key = (event: KeyboardEvent) => event.key === 'Escape' && setOpened(null)
    window.addEventListener('keydown', key)
    return () => {
      root.style.overflow = held.overflow
      document.body.style.paddingRight = held.pad
      window.removeEventListener('keydown', key)
    }
  }, [active])

  const claim = async (id: string) => {
    setClaiming(id)
    const { ok, data } = await api<Board>('achievements', { claim: id })
    if (ok) {
      known = data
      setBoard(data)
      putAwards(data.achievements)
      void refresh()
    }
    setClaiming(null)
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

            <div className="play-card awards-tiers">
              {TIERS.map((tier) => {
                const all = list.filter((a) => a.tier === tier)
                const done = all.filter((a) => a.done).length
                return (
                  <span key={tier} className={`awards-tier tier-${tier}`}>
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
                  <li key={index} className={`awards-slot ${award ? `tier-${award.tier}` : 'free'}`}>
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
              {t('ach.myProfile')}
              <ArrowIcon />
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
            const group = shown.filter((one) => one.category === category)
            if (!group.length) return null
            const total = rows.filter((one) => one.category === category)
            return (
              <section key={category} className="awards-group">
                <h2>
                  {t(`achCat.${category}` as UiKey)}
                  <span>
                    {total.filter((one) => !one.next).length}/{total.length}
                  </span>
                </h2>
                <div className="awards-grid">
                  {group.map((one) => (
                    <Card
                      key={one.id}
                      family={one}
                      pinned={pinned}
                      busy={claiming === one.open.id}
                      onPin={togglePin}
                      onOpen={(id) => (one.ready ? void claim(one.ready.id) : setOpened(id))}
                    />
                  ))}
                </div>
              </section>
            )
          })}
        </>
      )}

      {active && (
        <AwardModal
          award={active}
          pinned={pinned.includes(active.id)}
          busy={claiming === active.id}
          onPin={() => togglePin(active.id)}
          onClaim={() => void claim(active.id)}
          onClose={() => setOpened(null)}
        />
      )}
    </div>
  )
}
