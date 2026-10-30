'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { api } from './api'
import { useAuth } from './auth'
import BackButton from './BackButton'
import { BRAND } from './brand'
import { CATEGORIES, type GameId } from './games/types'
import { useI18n } from './i18n'
import { CloseIcon, SearchIcon } from './icons'
import Rail from './Rail'
import QuizBuilder, { freshDraft, QUIZ_WORLDS, type Draft, type SavedDraft } from './QuizBuilder'
import { CATEGORY_TITLES } from './QuizList'
import { useHref } from './router'

function WorldPicker({ onPick }: { onPick: (game: GameId) => void }) {
  const { t, l } = useI18n()
  const [query, setQuery] = useState('')
  const groups = CATEGORIES.map((category) => ({ category, worlds: QUIZ_WORLDS.filter((one) => one.category === category) })).filter((group) => group.worlds.length)
  const [tab, setTab] = useState(groups[0]?.category)
  const tabs = useRef<HTMLDivElement>(null)
  const [ink, setInk] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const needle = query.trim().toLowerCase()
  const shown = needle
    ? QUIZ_WORLDS.filter((one) => l(one.label).toLowerCase().includes(needle) || one.id.includes(needle))
    : (groups.find((group) => group.category === tab)?.worlds ?? [])

  const slide = useCallback(() => {
    const on = tabs.current?.querySelector<HTMLElement>('.cat-tab.active')
    setInk(on ? { x: on.offsetLeft, y: on.offsetTop, w: on.offsetWidth, h: on.offsetHeight } : null)
  }, [])

  useLayoutEffect(() => {
    slide()
  }, [slide, tab, needle])

  useEffect(() => {
    const row = tabs.current
    if (!row || typeof ResizeObserver === 'undefined') return
    const watcher = new ResizeObserver(slide)
    watcher.observe(row)
    return () => watcher.disconnect()
  }, [slide])

  return (
    <div className="qb-worlds">
      <header className="qb-worlds-head">
        <h1>{t('qb.pickWorld')}</h1>
        <p>{t('qb.pickWorldLead')}</p>
      </header>
      <section className="picker qb-worlds-bar">
        <Rail className="cat-rail" trackClass="rail-chips" innerRef={tabs}>
          <span
            className={`seg-ink ${ink ? 'is-set' : ''}`}
            style={ink ? { transform: `translate(${ink.x}px, ${ink.y}px)`, width: ink.w, height: ink.h } : undefined}
            aria-hidden
          />
          {groups.map((group) => (
            <button
              key={group.category}
              type="button"
              className={`cat-tab ${!needle && tab === group.category ? 'active' : ''}`}
              onClick={() => {
                setQuery('')
                setTab(group.category)
              }}
            >
              {t(CATEGORY_TITLES[group.category])}
            </button>
          ))}
        </Rail>
        <label className="cat-search">
          <SearchIcon />
          <input
            type="search"
            value={query}
            autoFocus
            autoComplete="off"
            placeholder={t('qb.worldSearch')}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => event.key === 'Escape' && setQuery('')}
          />
          {!!query && (
            <button type="button" className="cat-search-clear" aria-label={t('dash.searchClear')} onClick={() => setQuery('')}>
              <CloseIcon />
            </button>
          )}
        </label>
      </section>
      {shown.length ? (
        <div className="qb-worlds-grid">
          {shown.map((world) => (
            <button key={world.id} type="button" className="qb-world" style={{ '--world-accent': world.accent } as CSSProperties} onClick={() => onPick(world.id)}>
              <img src={`/worlds/${world.id}.webp`} alt="" />
              <span>{l(world.label)}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="qb-worlds-none">{t('oops.empty', { query: query.trim() })}</p>
      )}
    </div>
  )
}

export default function QuizMake({ id, game }: { id?: string; game?: string }) {
  const { t } = useI18n()
  const href = useHref()
  const router = useRouter()
  const { user, loading } = useAuth()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [missing, setMissing] = useState(false)
  const start = useMemo(() => QUIZ_WORLDS.find((one) => one.id === game)?.id, [game])

  useEffect(() => {
    if (!user) return
    if (!id) return setDraft(start ? freshDraft(start) : null)
    void api<{ quiz?: SavedDraft }>(`my/quizzes?id=${id}`).then(({ ok, data }) => (ok && data.quiz ? setDraft(data.quiz) : setMissing(true)))
  }, [user, id, start])

  const back = (
    <div className="play-nav">
      <BackButton href={href.myTests}>{t('qb.mine')}</BackButton>
    </div>
  )

  if (!loading && !user) {
    return (
      <div className="quiz-page qz-page">
        {back}
        <div className="qz-empty qb-login">
          <span className="qz-mark">{BRAND.mark}</span>
          <b>{t('qb.mine.login')}</b>
          <p>{t('qb.mine.lead')}</p>
          <Link className="quiz-btn" href={href.login}>
            {t('qb.mine.loginBtn')}
          </Link>
        </div>
      </div>
    )
  }

  if (missing) return <div className="card center muted">{t('err.not_found')}</div>

  if (!id && !draft && user) {
    return (
      <div className="quiz-page qz-page">
        {back}
        <WorldPicker
          onPick={(picked) => {
            window.history.replaceState(null, '', href.makeTest({ game: picked }))
            setDraft(freshDraft(picked))
          }}
        />
      </div>
    )
  }

  return (
    <div className="quiz-page qz-page qb-page">
      {back}
      {draft ? (
        <QuizBuilder
          key={id ?? `new:${draft.game}`}
          mode="user"
          draft={draft}
          onSaved={(saved) => {
            if (!draft.id) window.history.replaceState(null, '', href.makeTest({ id: saved.id }))
            setDraft(saved)
          }}
          onDropped={() => router.push(href.myTests)}
        />
      ) : (
        <div className="qb-card qb-loading" />
      )}
    </div>
  )
}
