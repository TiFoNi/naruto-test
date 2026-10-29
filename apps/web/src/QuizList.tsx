'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { api } from './api'
import AdminSelect from './AdminSelect'
import BackButton from './BackButton'
import { BRAND } from './brand'
import { GAMES } from './games'
import { CATEGORIES, type Category, type GameId } from './games/types'
import { useI18n, type UiKey } from './i18n'
import { CheckIcon, GridIcon, HeartIcon, LinkIcon, SearchIcon, SortIcon, UsersIcon } from './icons'
import { coverUrl, type QuizCard, type QuizKind, type QuizLayout } from './quiz'
import { useHref } from './router'

type Status = 'all' | 'new' | 'going' | 'done'
type Sort = 'new' | 'popular' | 'liked' | 'short' | 'long'

const KINDS: QuizKind[] = ['choice', 'name', 'bool', 'order', 'pairs']

const KIND_ICON: Record<QuizKind, ReactNode> = {
  choice: <GridIcon />,
  name: <SearchIcon />,
  bool: <CheckIcon />,
  order: <SortIcon />,
  pairs: <LinkIcon />,
}

const statusOf = (quiz: QuizCard): Exclude<Status, 'all'> =>
  quiz.mine?.finished ? 'done' : quiz.mine && quiz.mine.answered > 0 ? 'going' : 'new'

function Card({ quiz, href }: { quiz: QuizCard; href: string }) {
  const { t, l } = useI18n()
  const world = GAMES.find((one) => one.id === quiz.game)
  const art = coverUrl(quiz.game, quiz.cover)
  const status = statusOf(quiz)
  const share = quiz.mine?.finished && quiz.count ? quiz.mine.score / quiz.count : 0
  const grade = share === 1 ? 'is-top' : share >= 0.6 ? 'is-good' : 'is-low'

  return (
    <Link className={`qz-card is-${status}`} href={href} prefetch={false}>
      <span className="qz-art">
        {art ? <img src={art} alt="" loading="lazy" /> : <span className="qz-mark">{BRAND.mark}</span>}
        <span className="qz-corner is-left">
          {status === 'done' ? (
            <em className={`qz-badge is-score ${grade}`}>
              <CheckIcon />
              {quiz.mine!.score}/{quiz.count}
            </em>
          ) : (
            <em className={`qz-badge is-${status}`}>{t(status === 'going' ? 'quiz.going' : 'quiz.badge.new')}</em>
          )}
        </span>
        {(!!quiz.plays || !!quiz.likes) && (
          <span className="qz-corner is-right">
            {!!quiz.likes && (
              <em className="qz-badge is-likes" title={t('quiz.likes', { count: quiz.likes })}>
                <HeartIcon />
                {quiz.likes}
              </em>
            )}
            {!!quiz.plays && (
              <em className="qz-badge is-plays" title={t('quiz.plays', { count: quiz.plays })}>
                <UsersIcon />
                {quiz.plays}
              </em>
            )}
          </span>
        )}
      </span>
      <span className="qz-info">
        {world && (
          <em className="qz-world" style={{ '--world-accent': world.accent } as CSSProperties}>
            <img src={`/worlds/${world.id}.webp`} alt="" loading="lazy" />
            {l(world.label)}
          </em>
        )}
        <b>{quiz.title}</b>
        <small>
          {t('quiz.questions', { count: quiz.count })} · {t(quiz.layout === 'steps' ? 'quiz.layout.steps' : 'quiz.layout.list')}
        </small>
        <span className="qz-kinds">
          {quiz.kinds.map((kind) => (
            <i key={kind} title={t(`quiz.kind.${kind}` as UiKey)}>
              {KIND_ICON[kind]}
            </i>
          ))}
        </span>
      </span>
    </Link>
  )
}

const TITLES: Record<Category, UiKey> = {
  anime: 'dash.anime',
  manga: 'dash.mangaTitle',
  cartoon: 'dash.cartoon',
  screen: 'dash.screen',
  games: 'dash.games',
  sport: 'dash.sport',
}

export default function QuizList({ category }: { category: string }) {
  const { t, l } = useI18n()
  const href = useHref()
  const known = (CATEGORIES as readonly string[]).includes(category)
  const worlds = useMemo(() => GAMES.filter((one) => one.category === category), [category])
  const [list, setList] = useState<QuizCard[] | null>(null)
  const [world, setWorld] = useState<GameId | 'all'>('all')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<Status>('all')
  const [layout, setLayout] = useState<QuizLayout | null>(null)
  const [kinds, setKinds] = useState<Set<QuizKind>>(new Set())
  const [sort, setSort] = useState<Sort>('new')
  const [panel, setPanel] = useState(false)

  useEffect(() => {
    if (!worlds.length) return setList([])
    void api<{ quizzes?: QuizCard[] }>(`quizzes?games=${worlds.map((one) => one.id).join(',')}`).then(({ ok, data }) => setList(ok ? (data.quizzes ?? []) : []))
  }, [worlds])

  const present = useMemo(() => worlds.filter((one) => (list ?? []).some((quiz) => quiz.game === one.id)), [worlds, list])

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const rows = (list ?? []).filter(
      (quiz) =>
        (world === 'all' || quiz.game === world) &&
        (status === 'all' || statusOf(quiz) === status) &&
        (!layout || quiz.layout === layout) &&
        [...kinds].every((kind) => quiz.kinds.includes(kind)) &&
        (!needle || quiz.title.toLowerCase().includes(needle)),
    )
    if (sort === 'popular') return [...rows].sort((a, b) => (b.plays ?? 0) - (a.plays ?? 0))
    if (sort === 'liked') return [...rows].sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0))
    if (sort === 'short') return [...rows].sort((a, b) => a.count - b.count)
    if (sort === 'long') return [...rows].sort((a, b) => b.count - a.count)
    return rows
  }, [list, query, world, status, layout, kinds, sort])

  if (!known) return <div className="card center muted">{t('err.not_found')}</div>

  const active = (world !== 'all' ? 1 : 0) + (status !== 'all' ? 1 : 0) + (layout ? 1 : 0) + kinds.size + (sort !== 'new' ? 1 : 0)
  const filtered = !!query.trim() || active > 0
  const reset = () => {
    setQuery('')
    setWorld('all')
    setStatus('all')
    setLayout(null)
    setKinds(new Set())
    setSort('new')
  }
  const toggleKind = (kind: QuizKind) =>
    setKinds((current) => {
      const next = new Set(current)
      if (next.has(kind)) next.delete(kind)
      else next.add(kind)
      return next
    })

  return (
    <div className="quiz-page qz-page">
      <div className="play-nav">
        <BackButton href={href.home}>{t('play.back')}</BackButton>
      </div>

      <div className="qz-main-top">
        <div>
          <small className="qz-kicker">{t(TITLES[category as Category])}</small>
          <h1>{t('quiz.title')}</h1>
        </div>
        <div className="qz-main-tools">
          <button type="button" className={`qz-panel-toggle ${active ? 'has-active' : ''}`} onClick={() => setPanel(!panel)}>
            <SortIcon />
            {t('quiz.side.open')}
            {!!active && <b>{active}</b>}
          </button>
        </div>
      </div>

      <div className={`qz-body ${panel ? 'is-open' : ''}`}>
        <aside className="qz-side">
          <label className="qz-search">
            <SearchIcon />
            <input value={query} placeholder={t('quiz.search')} onChange={(event) => setQuery(event.target.value)} />
          </label>

          {present.length > 1 && (
            <div className="qz-group">
              <h4>{t('quiz.side.world')}</h4>
              <AdminSelect<GameId | 'all'>
                className="qz-select"
                value={world}
                choices={[{ value: 'all' as const, label: t('quiz.side.allWorlds') }, ...present.map((one) => ({ value: one.id, label: l(one.label) }))]}
                onPick={setWorld}
              />
            </div>
          )}

          <div className="qz-group">
            <h4>{t('quiz.side.status')}</h4>
            <AdminSelect<Status>
              className="qz-select"
              value={status}
              choices={(['all', 'new', 'going', 'done'] as const).map((one) => ({ value: one, label: t(`quiz.filter.${one}` as UiKey) }))}
              onPick={setStatus}
            />
          </div>

          <div className="qz-group">
            <h4>{t('quiz.side.sort')}</h4>
            <AdminSelect<Sort>
              className="qz-select"
              value={sort}
              choices={(['new', 'popular', 'liked', 'short', 'long'] as const).map((one) => ({ value: one, label: t(`quiz.sort.${one}` as UiKey) }))}
              onPick={setSort}
            />
          </div>

          <div className="qz-group">
            <h4>{t('quiz.side.format')}</h4>
            {(['steps', 'list'] as const).map((one) => (
              <button key={one} type="button" className={`qz-opt ${layout === one ? 'on' : ''}`} onClick={() => setLayout(layout === one ? null : one)}>
                <span className="qz-box">{layout === one && <CheckIcon />}</span>
                {t(one === 'steps' ? 'quiz.layout.steps' : 'quiz.layout.list')}
              </button>
            ))}
          </div>

          <div className="qz-group">
            <h4>{t('quiz.side.kinds')}</h4>
            {KINDS.map((kind) => (
              <button key={kind} type="button" className={`qz-opt ${kinds.has(kind) ? 'on' : ''}`} onClick={() => toggleKind(kind)}>
                <span className="qz-box">{kinds.has(kind) && <CheckIcon />}</span>
                {t(`quiz.kind.${kind}` as UiKey)}
                <i className="qz-opt-icon">{KIND_ICON[kind]}</i>
              </button>
            ))}
          </div>

          {filtered && (
            <button type="button" className="qz-reset" onClick={reset}>
              {t('quiz.reset')}
            </button>
          )}
        </aside>

        <div className="qz-main">
          {list === null ? (
            <div className="qz-grid">
              {[0, 1, 2, 3].map((one) => (
                <div key={one} className="qz-card is-ghost" />
              ))}
            </div>
          ) : shown.length === 0 ? (
            <div className="qz-empty">
              <span className="qz-mark">{BRAND.mark}</span>
              <b>{t(list.length ? 'quiz.nothing' : 'quiz.empty')}</b>
              {filtered && (
                <button type="button" className="quiz-btn is-ghost" onClick={reset}>
                  {t('quiz.reset')}
                </button>
              )}
            </div>
          ) : (
            <div className="qz-grid">
              {shown.map((quiz) => (
                <Card key={quiz.id} quiz={quiz} href={href.test(quiz.game, quiz.id)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
