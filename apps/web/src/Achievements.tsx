'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { api } from './api'
import BackButton from './BackButton'
import { AwardsGhost } from './PageSkeleton'
import { useI18n, type UiKey } from './i18n'
import { CheckIcon, CloseIcon, GiftIcon, LockIcon, PinIcon } from './icons'
import Rail from './Rail'
import AwardIcon from './awardIcons'
import { useAuth } from './auth'
import { putAwards } from './awards'
import { useHref } from './router'
import { keepPerUser } from './session-cache'

type Tier = 'bronze' | 'silver' | 'gold' | 'legend' | 'mythic' | 'secret'

type Award = {
  id: string
  family: string
  category: string
  tier: Tier
  kind: 'life' | 'season'
  target: number
  xp: number
  secret: boolean
  awarded: boolean
  unit: 'percent' | null
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

type Filter = 'all' | 'ready' | 'done' | 'doing' | 'secret'

const CATEGORIES = ['season', 'guessing', 'duels', 'streaks', 'modes', 'worlds', 'ranking', 'secret']
const TIERS: Tier[] = ['bronze', 'silver', 'gold', 'legend', 'mythic', 'secret']
const FILTERS: { id: Filter; label: UiKey }[] = [
  { id: 'all', label: 'ach.all' },
  { id: 'ready', label: 'ach.ready' },
  { id: 'done', label: 'ach.done' },
  { id: 'doing', label: 'ach.doing' },
  { id: 'secret', label: 'ach.secretOnes' },
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
    const steps = [...all].sort((one, two) => one.xp - two.xp || one.target - two.target)
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

const RANKS: Tier[] = ['bronze', 'silver', 'gold', 'legend', 'mythic', 'secret']

const byRank = (one: Family, two: Family) => {
  const last = (family: Family) => family.steps[family.steps.length - 1]
  return RANKS.indexOf(last(one).tier) - RANKS.indexOf(last(two).tier) || last(one).xp - last(two).xp || one.steps.length - two.steps.length
}

function Card({ family, busy, onOpen }: { family: Family; busy: boolean; onOpen: (id: string) => void }) {
  const { t, lang } = useI18n()
  const { steps, value, next, ready, single } = family
  const last = steps[steps.length - 1]
  const hidden = steps.every((step) => step.secret && !step.done)
  const goal = next ?? last
  const gained = steps.filter((step) => step.done).pop() ?? null
  const crown = gained ?? goal
  const name = single ? (hidden ? '???' : t(`ach.${steps[0].id}` as UiKey)) : t(`achFam.${family.id}` as UiKey)
  const hint = hidden ? t('ach.secretHint') : t(`ach.${goal.id}.hint` as UiKey)
  const seasonal = family.kind === 'season'
  const share = goal.rarity > 0 && !seasonal ? t('ach.share', { share: goal.rarity }) : ''
  const whole = !next

  return (
    <article className={`award ${seasonal ? 'is-season' : `tier-${crown.tier}`} ${whole ? 'done' : ready ? 'is-ready' : ''} ${hidden ? 'hidden' : ''}`}>
      <button type="button" className="award-open" aria-label={name} disabled={busy} onClick={() => onOpen(family.open.id)}>
        <span className="award-mark" aria-hidden>
          {ready ? <GiftIcon /> : hidden ? <LockIcon /> : <AwardIcon family={family.id} award={steps[0].id} />}
        </span>
        <div className="award-body">
          <div className="award-head">
            <b>{name}</b>
            <span className="award-tier">
              {!single && <i className="award-steps">{family.done}/{steps.length}</i>}
              {seasonal ? '' : hidden ? t('ach.secret') : t(`achTier.${crown.tier}` as UiKey)}
            </span>
          </div>
          <p title={hint}>{hint}</p>
        </div>
        <div className="award-foot">
          {whole ? (
            <span className="award-date">
              <CheckIcon /> {last.at ? new Date(last.at).toLocaleDateString(LOCALES[lang], { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''}
            </span>
          ) : hidden ? (
            <span className="award-date muted">{t('ach.hidden')}</span>
          ) : null}

          <span className={`award-bar ${steps.length > 1 ? 'parts' : ''} ${gained ? `tier-${gained.tier}` : ''}`}>
            {steps.map((step, index) => {
              const floor = index === 0 ? 0 : steps[index - 1].target
              const ramp = Math.max(0, Math.min(1, (value - floor) / Math.max(1, step.target - floor)))
              const fill = step.awarded ? (step.done ? 1 : 0) : ramp
              return (
                <span key={step.id} className={step.done ? 'done' : ''}>
                  <i style={{ width: `${Math.round(fill * 100)}%` }} />
                </span>
              )
            })}
          </span>

          {!whole && !hidden && !goal.awarded && (
            <span className="award-count">
              {value.toLocaleString(LOCALES[lang])} / {goal.target.toLocaleString(LOCALES[lang])}
              {goal.unit === 'percent' ? '%' : ''}
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
    </article>
  )
}

function AwardModal({
  award,
  steps,
  onStep,
  full,
  guest,
  pinnedIds,
  busy,
  onPin,
  onClaim,
  onClose,
}: {
  award: Award
  steps: Award[]
  onStep: (id: string) => void
  pinnedIds: string[]
  full: boolean
  guest: boolean
  busy: boolean
  onPin: (id: string) => void
  onClaim: () => void
  onClose: () => void
}) {
  const { t, lang } = useI18n()
  const hidden = award.secret && !award.done
  const waiting = award.done && !award.claimed
  const top = [...steps].reverse().find((step) => step.claimed)
  const held = !!top && pinnedIds.includes(top.id)
  const locked = !top || (full && !held)
  const percent = Math.min(Math.round((award.progress / award.target) * 100), 100)

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <section
        className={`card modal award-modal ${award.kind === 'season' ? 'is-season' : `tier-${award.tier}`} ${!hidden && steps.length > 1 ? 'has-steps' : ''}`}
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="modal-close" aria-label={t('profile.close')} onClick={onClose}>
          <CloseIcon />
        </button>
        <span className="award-modal-mark" aria-hidden>
          {waiting ? <GiftIcon /> : hidden ? <LockIcon /> : <AwardIcon family={award.family} award={award.id} />}
        </span>
        <h2>{hidden ? '???' : t(`ach.${award.id}` as UiKey)}</h2>
        <p className="award-modal-hint">{hidden ? t('ach.secretHint') : t(`ach.${award.id}.hint` as UiKey)}</p>
        {award.kind !== 'season' && (
          <div className="award-modal-tags">
            <em>{hidden ? t('ach.secret') : t(`achTier.${award.tier}` as UiKey)}</em>
          </div>
        )}
        <span className="award-modal-kind">{t(award.kind === 'season' ? 'ach.kindSeason' : 'ach.kindLife')}</span>

        {!hidden && !award.awarded && (
          <div className="award-modal-progress">
            <span className="award-bar">
              <span style={{ width: `${percent}%` }} />
            </span>
            <b>
              {Math.min(award.progress, award.target)} / {award.target}
              {award.unit === 'percent' ? '%' : ''}
            </b>
          </div>
        )}

        {!hidden && steps.length > 1 && (
          <div className="award-steps-list">
            <header>
              <b>{t('ach.stepsTitle')}</b>
              <span className="muted">{t('ach.stepsDone', { done: steps.filter((step) => step.done).length, total: steps.length })}</span>
            </header>
            <ol>
              {steps.map((step) => (
                <li
                  key={step.id}
                  className={`${award.kind === 'season' ? '' : `tier-${step.tier}`} ${step.done ? 'done' : ''} ${step.id === award.id ? 'now' : ''}`}
                >
                  <button type="button" onClick={() => onStep(step.id)} aria-current={step.id === award.id}>
                    <i>{step.done ? <CheckIcon /> : null}</i>
                    <b>
                      {step.target.toLocaleString(LOCALES[lang])}
                      {step.unit === 'percent' ? '%' : ''}
                    </b>
                    <span>{award.kind === 'season' ? '' : t(`achTier.${step.tier}` as UiKey)}</span>
                    <em>+{step.xp} XP</em>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        )}

        <dl className="award-modal-facts">
          <div>
            <dt>{t('ach.rewardTitle')}</dt>
            <dd>+{award.xp} XP</dd>
          </div>
          {award.rarity > 0 && award.kind !== 'season' && (
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
          {waiting && !guest && (
            <button type="button" className="primary" disabled={busy} onClick={onClaim}>
              {t('ach.claim', { xp: award.xp })}
            </button>
          )}
          {award.kind !== 'season' && !guest && (
            <button
              type="button"
              className="ghost"
              disabled={busy || locked}
              title={locked ? t(!top ? 'ach.pinNone' : 'ach.pinFull') : undefined}
              onClick={() => top && onPin(top.id)}
            >
              <PinIcon /> {t(held ? 'ach.unpin' : 'ach.pin')}
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

export default function Achievements({ id, nickname }: { id?: string; nickname?: string } = {}) {
  const { t } = useI18n()
  const href = useHref()
  const { refresh } = useAuth()
  const [board, setBoard] = useState<Board | null>(id ? null : known)
  const [error, setError] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [ink, setInk] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const tabs = useRef<HTMLDivElement>(null)
  const [group, setGroup] = useState<string>('all')
  const [claiming, setClaiming] = useState<string | null>(null)
  const [opened, setOpened] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    api<Board>(id ? `achievements?id=${id}` : 'achievements')
      .then(({ ok, data }) => {
        if (!alive) return
        if (ok) {
          if (!id) {
            known = data
            putAwards(data.achievements)
          }
          setBoard(data)
        } else setError(true)
      })
      .catch(() => alive && setError(true))
    return () => {
      alive = false
    }
  }, [id])

  const list = board?.achievements ?? []
  const rows = useMemo(() => families(list).sort(byRank), [list])
  const fits = (one: Family, kind: Filter) =>
    kind === 'ready'
      ? !!one.ready
      : kind === 'done'
        ? !one.next
        : kind === 'doing'
          ? !!one.next
          : kind === 'secret'
            ? one.steps.some((step) => step.secret)
            : true
  const inGroup = useMemo(() => (group === 'all' ? rows : rows.filter((one) => one.category === group)), [rows, group])
  const shown = useMemo(() => inGroup.filter((one) => fits(one, filter)), [inGroup, filter])
  const counts: Record<Filter, number> = {
    all: inGroup.length,
    ready: inGroup.filter((one) => fits(one, 'ready')).length,
    done: inGroup.filter((one) => fits(one, 'done')).length,
    doing: inGroup.filter((one) => fits(one, 'doing')).length,
    secret: inGroup.filter((one) => fits(one, 'secret')).length,
  }
  const lifetime = rows.filter((one) => one.kind !== 'season')
  const earned = lifetime.filter((one) => !one.next).length
  const share = lifetime.length ? Math.round((earned / lifetime.length) * 100) : 0
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

  const slide = useCallback(() => {
    const row = tabs.current
    const on = row?.querySelector<HTMLElement>(`button[data-filter="${filter}"]`)
    if (!row || !on) return
    setInk({ x: on.offsetLeft, y: on.offsetTop, w: on.offsetWidth, h: on.offsetHeight })
  }, [filter])

  useLayoutEffect(() => {
    slide()
  }, [slide, counts.all, counts.ready, counts.done, counts.doing, counts.secret])

  useEffect(() => {
    const row = tabs.current
    if (!row || typeof ResizeObserver === 'undefined') return
    const watcher = new ResizeObserver(slide)
    watcher.observe(row)
    return () => watcher.disconnect()
  }, [slide])

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

  if (!board && !error) return <AwardsGhost />

  return (
    <div className="awards-page">
      <BackButton href={id ? href.player(id) : href.profile}>{t(id ? 'profile.back' : 'nav.profile')}</BackButton>

      {error ? (
        <div className="card center muted">{t('err.server')}</div>
      ) : (
        <>
          <section className="card awards-hero">
            <div className="awards-ring" aria-hidden>
              <svg viewBox="0 0 120 120">
                <circle className="track" cx="60" cy="60" r="52" />
                <circle className="fill" cx="60" cy="60" r="52" strokeDasharray={`${(share / 100) * 326.7} 326.7`} />
              </svg>
              <span>
                <b>{earned}</b>
                <em>{t('ach.outOf', { total: lifetime.length })}</em>
              </span>
            </div>

            <h1>{id && nickname ? nickname : t('ach.title')}</h1>

            <div className="awards-hero-body">
              <p className="muted">{t(id ? 'ach.heroGuest' : 'ach.heroLead', { xp: board?.xp ?? 0 })}</p>
              <div className="awards-shelf">
                <span className="awards-shelf-label">
                  {t('ach.showcase')} {pinned.length}/{PINNED_MAX}
                </span>
                {Array.from({ length: PINNED_MAX }, (_, index) => {
                  const award = pinned[index] ? list.find((one) => one.id === pinned[index]) : undefined
                  if (!award)
                    return <span key={index} className="awards-chip free" aria-hidden />
                  if (id)
                    return (
                      <span key={award.id} className={`awards-chip tier-${award.tier}`} title={t(`ach.${award.id}` as UiKey)}>
                        <AwardIcon family={award.family} award={award.id} />
                      </span>
                    )
                  return (
                    <button
                      key={award.id}
                      type="button"
                      className={`awards-chip tier-${award.tier}`}
                      title={`${t(`ach.${award.id}` as UiKey)} — ${t('ach.unpin')}`}
                      aria-label={t('ach.unpin')}
                      onClick={() => togglePin(award.id)}
                    >
                      <AwardIcon family={award.family} award={award.id} />
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="awards-tiers">
              {TIERS.map((tier) => {
                const all = lifetime.filter((one) => one.steps[one.steps.length - 1].tier === tier)
                const done = all.filter((one) => !one.next).length
                if (!all.length) return null
                return (
                  <span key={tier} className={`awards-tier tier-${tier}`}>
                    <i />
                    <em>{t(`achTier.${tier}` as UiKey)}</em>
                    <b>
                      {done} / {all.length}
                    </b>
                  </span>
                )
              })}
            </div>
          </section>

          <div className="awards-sort">
            <div className="awards-filters" role="tablist" ref={tabs}>
              <span className={`seg-ink ${ink ? 'is-set' : ''}`} style={ink ? { transform: `translate(${ink.x}px, ${ink.y}px)`, width: ink.w, height: ink.h } : undefined} aria-hidden />
              {FILTERS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  data-filter={id}
                  aria-selected={filter === id}
                  className={filter === id ? 'active' : ''}
                  onClick={() => setFilter(id)}
                >
                  {t(label)} <b>{counts[id]}</b>
                </button>
              ))}
            </div>

            <Rail trackClass="rail-chips">
              <button type="button" className={group === 'all' ? 'active' : ''} onClick={() => setGroup('all')}>
                {t('ach.allCats')}
              </button>
              {CATEGORIES.map((category) => (
                <button
                  key={category}
                  type="button"
                  className={group === category ? 'active' : ''}
                  onClick={() => setGroup(category)}
                >
                  {t(`achCatShort.${category}` as UiKey)}
                </button>
              ))}
            </Rail>
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
                      busy={claiming === one.open.id}
                      onOpen={(open) => (!id && one.ready ? void claim(one.ready.id) : setOpened(open))}
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
          steps={rows.find((one) => one.steps.some((step) => step.id === active.id))?.steps ?? [active]}
          onStep={setOpened}
          full={pinned.length >= PINNED_MAX}
          pinnedIds={pinned}
          guest={!!id}
          busy={claiming === active.id}
          onPin={togglePin}
          onClaim={() => void claim(active.id)}
          onClose={() => setOpened(null)}
        />
      )}
    </div>
  )
}
