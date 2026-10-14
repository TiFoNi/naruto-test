'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import CharacterSearch from './CharacterSearch'
import GiveUp from './GiveUp'
import PlayBoard from './PlayBoard'
import PlayPanel from './PlayPanel'
import RoundStatus from './RoundStatus'
import { api, apiSrc } from './api'
import { BRAND } from './brand'
import type { Entity, Game } from './games/types'
import { useI18n } from './i18n'
import { useHref } from './router'
import { CheckIcon, TrophyIcon } from './icons'

type Run = {
  score: number
  streak: number
  best: number
  total?: number
  level: number
  points: number
  levels: number
  status: 'playing' | 'over'
  lastId?: number
  shots?: string[]
}

type Answer = {
  right?: boolean
  over?: boolean
  answerId?: number
  gained?: number
  score: number
  streak: number
  best: number
  total?: number
  level?: number
  points?: number
  shots?: string[]
  fresh?: boolean
}

type Over = { score: number; streak: number; best: number; total?: number; answerId?: number; fresh: boolean; shots?: string[] }

const STEPS = [1, 2, 3, 4] as const
const LEVELS = [
  { label: 'shot.extreme', tone: 'extreme' },
  { label: 'shot.hard', tone: 'hard' },
  { label: 'shot.medium', tone: 'medium' },
  { label: 'shot.easy', tone: 'easy' },
] as const
const CHEER = 3000

export default function ShotMode({ game, active }: { game: Game; active: boolean }) {
  const { t, name } = useI18n()
  const href = useHref()
  const [run, setRun] = useState<Run | null>(null)
  const [over, setOver] = useState<Over | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [soon, setSoon] = useState(false)
  const [won, setWon] = useState<{ name: string; gained: number; shots: string[] } | null>(null)
  const [big, setBig] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const cheer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const byId = new Map(game.entities.map((one) => [one.id, one]))

  const start = useCallback(async (again = false) => {
    setBusy(true)
    setError(null)
    const { ok, data } = await api<Run & { error?: string }>('shot', again ? { action: 'restart' } : {})
    setBusy(false)
    if (!ok) {
      if (data.error === 'not_ready') return setSoon(true)
      return setError(data.error ?? 'server')
    }
    setWon(null)
    if (data.status === 'over') {
      setRun(null)
      setOver({
        score: data.score,
        streak: data.streak,
        best: data.best,
        total: data.total,
        answerId: data.lastId,
        fresh: data.score > 0 && data.score >= data.best,
        shots: data.shots,
      })
      return
    }
    setOver(null)
    setRun(data)
  }, [])

  useEffect(() => {
    if (!active || run || over || busy || soon) return
    void start()
  }, [active, run, over, busy, soon, start])

  useEffect(() => setMounted(true), [])

  const ahead = apiSrc(run?.shots?.[run.level])

  useEffect(() => {
    if (!ahead) return
    const picture = new Image()
    picture.src = ahead
  }, [ahead])

  useEffect(() => {
    if (!big) return
    const escape = (event: KeyboardEvent) => event.key === 'Escape' && setBig(null)
    document.addEventListener('keydown', escape)
    return () => document.removeEventListener('keydown', escape)
  }, [big])

  useEffect(
    () => () => {
      if (cheer.current) clearTimeout(cheer.current)
    },
    [],
  )

  const goOn = useCallback(() => {
    if (cheer.current) clearTimeout(cheer.current)
    setWon(null)
  }, [])

  const send = async (body: Record<string, unknown>) => {
    if (!run || busy) return null
    setBusy(true)
    const { ok, data } = await api<Answer & { error?: string }>('shot', body)
    setBusy(false)
    if (!ok) {
      setError(data.error ?? 'server')
      return null
    }
    if (data.over) {
      setRun(null)
      setOver({ score: data.score, streak: data.streak, best: data.best, total: data.total, answerId: data.answerId, fresh: !!data.fresh, shots: data.shots })
      return data
    }
    setRun((current) =>
      current
        ? {
            ...current,
            score: data.score,
            streak: data.streak ?? current.streak,
            best: data.best ?? current.best,
            total: data.total ?? current.total,
            level: data.level ?? current.level,
            points: data.points ?? current.points,
            shots: data.shots ?? current.shots,
          }
        : current,
    )
    return data
  }

  const pick = async (entity: Entity) => {
    const seen = run?.shots ?? []
    const data = await send({ action: 'answer', pick: entity.id })
    if (!data || data.over) return
    if (!data.right) return

    const title = data.answerId !== undefined ? byId.get(data.answerId) : undefined
    setWon({ name: title ? name(title) : '', gained: data.gained ?? 0, shots: seen })
    if (cheer.current) clearTimeout(cheer.current)
    cheer.current = setTimeout(() => setWon(null), CHEER)
  }

  const revealed = over?.answerId !== undefined ? byId.get(over.answerId) : undefined

  return (
    <PlayBoard
      side={
        <aside className="play-side">
          <div className="play-card play-stats shot-score">
            <div className="hot">
              <span>{t('shot.score')}</span>
              <b>{(over ? over.total : run?.total) ?? (over ? over.score : (run?.score ?? 0))}</b>
            </div>
            <div>
              <span>{t('shot.streak')}</span>
              <b>{over ? over.streak : (run?.streak ?? 0)}</b>
            </div>
          </div>
          <div className="play-card play-howto">
            <span className="play-card-title">{t('howto.title')}</span>
            {STEPS.map((step) => (
              <span key={step}>
                <i>{step}</i>
                {t(`howtoShot.step${step}` as 'howtoShot.step1')}
              </span>
            ))}
          </div>
          {run && !over && (
            <div className="play-actions">
              <button
                type="button"
                className="ghost shot-skip"
                disabled={busy || run.level >= run.levels - 1}
                onClick={() => void send({ action: 'skip' })}
              >
                {t('shot.skip')}
              </button>
              <GiveUp disabled={busy} onConfirm={() => void send({ action: 'giveup' })}>
                {t('play.giveUp')}
              </GiveUp>
            </div>
          )}
        </aside>
      }
    >
      <PlayPanel
        title={over ? t('shot.over') : t('shot.title')}
        hint={t('shot.hint')}
        media={
          <span className="play-mystery" aria-hidden>
            {over ? <TrophyIcon /> : '?'}
          </span>
        }
        aside={
          run || over ? (
            <span className="play-round">
              {t('shot.frame', { number: over ? STEPS.length : (run?.level ?? 0) + 1, total: STEPS.length })}
            </span>
          ) : undefined
        }
      >
        <RoundStatus error={error} onRetry={() => void start()} />

        {soon && <p className="notice shot-soon">{t('shot.soon')}</p>}

        {(run || over) && (
          <>
            <div className={`shot-grid ${over || won ? 'is-over' : ''}`}>
              {Array.from({ length: STEPS.length }, (_, step) => (
                <Cell
                  key={step}
                  src={apiSrc((over?.shots ?? won?.shots ?? run?.shots)?.[step])}
                  step={step}
                  onOpen={setBig}
                  onReveal={run && !over && !won && !busy && run.level < run.levels - 1 ? () => void send({ action: 'skip' }) : undefined}
                />
              ))}
            </div>

            <div className={`shot-under ${over || won ? 'is-answer' : ''}`}>
              <div className="shot-form">
                <CharacterSearch
                  game={game}
                  exclude={new Set()}
                  busy={busy || !!won || !!over}
                  plain
                  placeholder={t('shot.search')}
                  onPick={(entity) => void pick(entity)}
                />
              </div>

              {(over || won) && (
                <div className="shot-strip">
                  <b className="shot-was">
                    {won && (
                      <span className="shot-gain">
                        <CheckIcon />+{won.gained}
                      </span>
                    )}
                    {won ? t('shot.was', { name: won.name }) : revealed ? t('shot.was', { name: name(revealed) }) : t('shot.over')}
                  </b>
                  <div className="shot-keys">
                    {won ? (
                      <button type="button" className="primary" onClick={goOn}>
                        {t('shot.next')}
                      </button>
                    ) : (
                      <>
                        <button className="primary" disabled={busy} onClick={() => void start(true)}>
                          {t('shot.again')}
                        </button>
                        <Link className="ghost" href={href.leaderboard(game.id, 'shot')} prefetch={false}>
                          {t('shot.board')}
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </PlayPanel>

      {big &&
        mounted &&
        createPortal(
          <div className="shot-big" role="presentation" onClick={() => setBig(null)}>
            <img src={big} alt="" draggable={false} />
          </div>,
          document.body,
        )}
    </PlayBoard>
  )
}

function Cell({ src, step, onOpen, onReveal }: { src?: string; step: number; onOpen: (src: string) => void; onReveal?: () => void }) {
  const { t } = useI18n()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setReady(false)
    if (!src) return
    let alive = true
    const picture = new Image()
    const done = () => alive && setReady(true)
    picture.onload = done
    picture.onerror = done
    picture.src = src
    if (picture.complete) done()
    return () => {
      alive = false
    }
  }, [src])

  const level = LEVELS[step]

  if (!src || !ready) {
    const inside = (
      <>
        <span className="shot-logo" aria-hidden>
          {BRAND.mark}
        </span>
        <b>{t(level.label)}</b>
      </>
    )
    const tone = `is-${level.tone}`

    if (!onReveal)
      return (
        <span className={`shot-cell locked ${tone} ${src ? 'is-coming' : ''}`} title={t(level.label)}>
          {inside}
        </span>
      )

    return (
      <button type="button" className={`shot-cell locked is-next ${tone} ${src ? 'is-coming' : ''}`} title={t(level.label)} aria-label={t('shot.skip')} onClick={onReveal}>
        {inside}
      </button>
    )
  }

  return (
    <button
      key={src}
      type="button"
      className={`shot-cell is-open is-${level.tone}`}
      style={{ '--step': step } as CSSProperties}
      title={t(level.label)}
      aria-label={t('shot.open')}
      onClick={() => onOpen(src)}
    >
      <img src={src} alt="" draggable={false} />
      <em>{t(level.label)}</em>
    </button>
  )
}
