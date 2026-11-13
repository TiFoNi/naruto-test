'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Entity, Game } from './games/types'
import { useI18n, type UiKey } from './i18n'
import { CrownIcon, RefreshIcon } from './icons'
import { fullUrl } from './pics'
import { optionImage, type QuizOption, type QuizView } from './quiz'
import { useOptionLabel } from './QuizTile'

type Props = {
  game: Game
  byId: Map<number, Entity>
  quiz: QuizView
  busy: boolean
  error: string
  top?: ReactNode
  after?: ReactNode
  like?: ReactNode
  likeNote: string
  onSend: (body: Record<string, unknown>) => void
}

type Run = { round: number[]; next: number[]; at: number; matches: [number, number][]; playIn: boolean }

const PICK_MS = 480

const shuffled = (list: number[]) => {
  const order = [...list]
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[order[i], order[j]] = [order[j]!, order[i]!]
  }
  return order
}

const begin = (size: number): Run => {
  const order = shuffled(Array.from({ length: size }, (_, at) => at))
  const full = 2 ** Math.floor(Math.log2(size))
  const extra = size - full
  return extra > 0
    ? { round: order.slice(0, extra * 2), next: order.slice(extra * 2), at: 0, matches: [], playIn: true }
    : { round: order, next: [], at: 0, matches: [], playIn: false }
}

const advance = (run: Run, winner: number, loser: number): Run => {
  const matches: [number, number][] = [...run.matches, [winner, loser]]
  const next = [...run.next, winner]
  const at = run.at + 2
  if (at < run.round.length) return { ...run, next, at, matches }
  if (next.length === 1) return { round: next, next: [], at: 0, matches, playIn: false }
  return { round: shuffled(next), next: [], at: 0, matches, playIn: false }
}

const stageOf = (run: Run): { key: UiKey; values?: Record<string, number> } => {
  if (run.playIn) return { key: 'quiz.bracket.playin' }
  const left = run.round.length
  if (left === 2) return { key: 'quiz.bracket.final' }
  if (left === 4) return { key: 'quiz.bracket.semi' }
  if (left === 8) return { key: 'quiz.bracket.quarter' }
  return { key: 'quiz.bracket.round', values: { n: left / 2 } }
}

export const entryArt = (game: Game, byId: Map<number, Entity>, entry: QuizOption) => {
  if (entry.kind === 'image') return optionImage(entry)
  if (entry.kind === 'entity') {
    const entity = byId.get(entry.id)
    return entity ? fullUrl(game.id, entity.id, entity.image) : null
  }
  return null
}

function Fighter({ game, byId, entry, state, onPick }: { game: Game; byId: Map<number, Entity>; entry: QuizOption; state: '' | 'won' | 'lost'; onPick: () => void }) {
  const label = useOptionLabel(byId)(entry)
  const art = entryArt(game, byId, entry)
  return (
    <button type="button" className={`bk-fighter ${state ? `is-${state}` : ''}`} onClick={onPick} disabled={!!state}>
      <span className="bk-fighter-art">{art ? <img src={art} alt="" draggable={false} /> : null}</span>
      {label && <b>{label}</b>}
    </button>
  )
}

function Results({ game, byId, quiz, busy, like, likeNote, onSend }: Pick<Props, 'game' | 'byId' | 'quiz' | 'busy' | 'like' | 'likeNote' | 'onSend'>) {
  const { t } = useI18n()
  const label = useOptionLabel(byId)
  const entries = quiz.entries ?? []
  const attempt = quiz.attempt!
  const mine = attempt.champion ?? -1
  const voters = Math.max(1, attempt.voters ?? 1)
  const champ = entries[mine]
  const art = champ ? entryArt(game, byId, champ) : null
  const rows = (attempt.standings ?? entries.map(() => ({ champion: 0, wins: 0, games: 0 })))
    .map((row, at) => ({ ...row, at, share: Math.round((row.champion / voters) * 100), rate: row.games ? Math.round((row.wins / row.games) * 100) : 0 }))
    .sort((a, b) => b.champion - a.champion || b.rate - a.rate)

  return (
    <>
      {champ && (
        <section className="bk-champ">
          <span className="bk-champ-art">{art && <img src={art} alt="" />}</span>
          <div className="bk-champ-copy">
            <small>
              <CrownIcon />
              {t('quiz.bracket.winner')}
            </small>
            <b>{label(champ) || '—'}</b>
          </div>
          {!!attempt.xp && <em className="bk-xp">+{attempt.xp} XP</em>}
          <div className="bk-champ-acts">
            <button type="button" className="quiz-btn is-ghost" disabled={busy} onClick={() => onSend({ action: 'restart' })}>
              <RefreshIcon />
              {t('quiz.bracket.again')}
            </button>
            {like}
          </div>
          <p className="bk-champ-share">{t('quiz.bracket.champShare', { share: rows.find((row) => row.at === mine)?.share ?? 0 })}</p>
        </section>
      )}
      {likeNote && <p className="quiz-recap-note">{likeNote}</p>}

      <section className="bk-table">
        <header>
          <div className="bk-table-title">
            <h2>{t('quiz.bracket.everyone')}</h2>
            <small>{t('quiz.bracket.voters', { count: attempt.voters ?? 1 })}</small>
          </div>
        </header>
        <ol>
          {rows.map((row, place) => {
            const entry = entries[row.at]!
            const pic = entryArt(game, byId, entry)
            return (
              <li key={row.at} className={row.at === mine ? 'is-mine' : ''}>
                <span className="bk-place">{place + 1}</span>
                <span className="bk-thumb">{pic && <img src={pic} alt="" loading="lazy" />}</span>
                <span className="bk-row-main">
                  <b>
                    {label(entry) || `#${row.at + 1}`}
                    {row.at === mine && (
                      <em>
                        <CrownIcon />
                        {t('quiz.bracket.winner')}
                      </em>
                    )}
                  </b>
                  <span className="bk-bar" aria-hidden>
                    <i style={{ width: `${row.share}%` }} />
                  </span>
                  <small>
                    {t('quiz.bracket.chosen', { share: row.share })} · {t('quiz.bracket.winrate', { rate: row.rate })}
                  </small>
                </span>
              </li>
            )
          })}
        </ol>
      </section>
    </>
  )
}

export default function BracketRun({ game, byId, quiz, busy, error, top, after, like, likeNote, onSend }: Props) {
  const { t } = useI18n()
  const entries = useMemo(() => quiz.entries ?? [], [quiz.entries])
  const [run, setRun] = useState<Run | null>(null)
  const [picked, setPicked] = useState<number | null>(null)
  const timer = useRef(0)
  const finished = !!quiz.attempt?.finished

  useEffect(() => {
    if (finished) {
      setRun(null)
      setPicked(null)
    } else if (!run && entries.length > 1) setRun(begin(entries.length))
  }, [finished, run, entries.length])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const pair = run && run.round.length > 1 ? ([run.round[run.at]!, run.round[run.at + 1]!] as const) : null

  const choose = useCallback(
    (side: 0 | 1) => {
      if (!run || !pair || picked !== null) return
      const winner = pair[side]
      const loser = pair[side === 0 ? 1 : 0]
      setPicked(winner)
      timer.current = window.setTimeout(() => {
        const next = advance(run, winner, loser)
        setPicked(null)
        if (next.round.length === 1) {
          setRun(next)
          onSend({ action: 'bracket', champion: next.round[0], matches: next.matches })
        } else setRun(next)
      }, PICK_MS)
    },
    [run, pair, picked, onSend],
  )

  useEffect(() => {
    if (!pair) return
    const keys = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') choose(0)
      if (event.key === 'ArrowRight') choose(1)
    }
    window.addEventListener('keydown', keys)
    return () => window.removeEventListener('keydown', keys)
  }, [pair, choose])

  const hero = (
    <header className="quiz-hero bk-hero">
      <h1>{quiz.title}</h1>
      <p className="bk-meta">
        <CrownIcon />
        {t('quiz.bracket.kind')} · {t('quiz.bracket.count', { count: entries.length })}
      </p>
    </header>
  )

  if (finished) {
    return (
      <div className="quiz-page bk-page">
        {top}
        {hero}
        <Results game={game} byId={byId} quiz={quiz} busy={busy} like={like} likeNote={likeNote} onSend={onSend} />
        {after}
      </div>
    )
  }

  if (!run || !pair) {
    return (
      <div className="quiz-page bk-page">
        {top}
        {hero}
        <section className="bk-intro">
          <button
            type="button"
            className="quiz-btn"
            disabled={busy || !run || !error}
            onClick={() => run && onSend({ action: 'bracket', champion: run.round[0], matches: run.matches })}
          >
            {error ? t('quiz.bracket.retry') : t('quiz.bracket.saving')}
          </button>
          {error && <p className="quiz-error">{error}</p>}
        </section>
        {after}
      </div>
    )
  }

  const stage = stageOf(run)
  const total = entries.length - 1
  const done = run.matches.length
  const fights = run.round.length / 2
  const now = run.at / 2

  return (
    <div className="quiz-page bk-page">
      {top}
      <section className="bk-arena" aria-label={t('quiz.bracket.match', { at: done + 1, total })}>
        <header className="bk-arena-head">
          <b>{t(stage.key, stage.values)}</b>
          <span className="bk-dots" aria-hidden>
            {Array.from({ length: fights }, (_, at) => (
              <i key={at} className={at < now ? 'is-done' : at === now ? 'is-now' : ''} />
            ))}
          </span>
          <h2>{t('quiz.bracket.ask')}</h2>
        </header>
        <div className="bk-pair" key={done}>
          <Fighter game={game} byId={byId} entry={entries[pair[0]]!} state={picked === null ? '' : picked === pair[0] ? 'won' : 'lost'} onPick={() => choose(0)} />
          <span className="bk-vs" aria-hidden>
            vs
          </span>
          <Fighter game={game} byId={byId} entry={entries[pair[1]]!} state={picked === null ? '' : picked === pair[1] ? 'won' : 'lost'} onPick={() => choose(1)} />
        </div>
        {error && <p className="quiz-error">{error}</p>}
      </section>
    </div>
  )
}
