'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import PlayBoard from './PlayBoard'
import PlayPanel from './PlayPanel'
import RoundStatus from './RoundStatus'
import { api } from './api'
import { fullUrl } from './pics'
import type { Game } from './games/types'
import { useI18n, type UiKey } from './i18n'
import { CheckIcon, CloseIcon, TrophyIcon } from './icons'

type Side = 'left' | 'right' | 'both' | 'none'
type Part = { key: string; value: string }
type Ask = { parts: Part[]; join: 'single' | 'and' | 'or' }
type Question = { left: number; right: number; ask: Ask }
type Run = { streak: number; best: number; question?: Question }

const SIDES: { id: Side; label: UiKey }[] = [
  { id: 'both', label: 'pair.both' },
  { id: 'none', label: 'pair.none' },
]

const WAIT = 900

const preload = (urls: string[]) =>
  Promise.all(
    urls.map(
      (src) =>
        new Promise<void>((done) => {
          const pic = new Image()
          pic.onload = () => done()
          pic.onerror = () => done()
          pic.src = src
        }),
    ),
  )

export default function PairMode({ game, active }: { game: Game; active: boolean }) {
  const { t, l, tv, name } = useI18n()
  const [run, setRun] = useState<Run | null>(null)
  const [shot, setShot] = useState<{ pick: Side; answer: Side } | null>(null)
  const [over, setOver] = useState<{ streak: number; best: number; fresh: boolean; question?: Question; answer: Side } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const start = useCallback(
    async (fresh = false) => {
      setBusy(true)
      setError(null)
      const { ok, data } = await api<Run & { error?: string }>('pair', { game: game.id, ...(fresh ? { action: 'restart' } : {}) })
      setBusy(false)
      if (!ok) return setError(data.error ?? 'server')
      setShot(null)
      setOver(null)
      setRun({ streak: data.streak, best: data.best, question: data.question })
    },
    [game.id],
  )

  useEffect(() => {
    if (!active || run || busy) return
    void start()
  }, [active, run, busy, start])

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  const pick = async (side: Side) => {
    if (!run?.question || busy || shot) return
    setBusy(true)
    const { ok, data } = await api<{ right: boolean; answer: Side; streak: number; best: number; question?: Question; error?: string }>(
      'pair',
      { game: game.id, action: 'answer', pick: side },
    )
    setBusy(false)
    if (!ok) return setError(data.error ?? 'server')

    setShot({ pick: side, answer: data.answer })
    const next = data.question
    if (next) void preload([next.left, next.right].map((id) => fullUrl(game.id, id, byId.get(id)?.image)))
    timer.current = setTimeout(() => {
      setShot(null)
      if (data.question) setRun({ streak: data.streak, best: data.best, question: data.question })
      else
        setOver({
          streak: data.streak,
          best: data.best,
          fresh: data.streak > 0 && data.streak >= data.best,
          question: run.question,
          answer: data.answer,
        })
    }, WAIT)
  }

  const byId = new Map(game.entities.map((one) => [one.id, one]))
  const question = over ? over.question : run?.question
  const shown: Side | undefined = over ? over.answer : shot?.answer
  const left = question && byId.get(question.left)
  const right = question && byId.get(question.right)

  const parts = question?.ask.parts ?? []
  const titleOf = (key: string) => {
    const column = game.columns.find((one) => one.key === key)
    return column ? l(column.title) : key
  }
  const alone = parts.length > 0 && parts.every((part) => part.key === parts[0].key)
  const glue = question?.ask.join === 'and' ? t('pair.and') : t('pair.or')

  const lit = (side: Side) => shown && (shown === side || (shown === 'both' && (side === 'left' || side === 'right')))
  const card = (side: 'left' | 'right') => {
    const one = side === 'left' ? left : right
    if (!one) return null
    return (
      <button
        key={one.id}
        type="button"
        className={`pair-card ${lit(side) ? 'right' : ''} ${shot && shot.pick === side && !lit(side) ? 'wrong' : ''}`}
        disabled={busy || !!shot || !!over}
        onClick={() => void pick(side)}
      >
        <img className="pair-face" src={fullUrl(game.id, one.id, one.image)} alt="" loading="lazy" decoding="async" draggable={false} />
        <b>{name(one)}</b>
      </button>
    )
  }

  return (
    <PlayBoard
      side={
        <aside className="play-side">
          <div className="play-card play-stats pair-score">
            <div className="hot">
              <span>{t('pair.streak')}</span>
              <b>{over ? over.streak : (run?.streak ?? 0)}</b>
            </div>
            <div>
              <span>{t('pair.best')}</span>
              <b>{over ? over.best : (run?.best ?? 0)}</b>
            </div>
          </div>
          <div className="play-card play-howto">
            <span className="play-card-title">{t('howto.title')}</span>
            <span>
              <i>1</i>
              {t('howtoPair.step1')}
            </span>
            <span>
              <i>2</i>
              {t('howtoPair.step2')}
            </span>
            <span>
              <i>3</i>
              {t('howtoPair.step3')}
            </span>
            <span>
              <i>4</i>
              {t('howtoPair.step4')}
            </span>
          </div>
        </aside>
      }
    >
      <PlayPanel
        title={over ? t('pair.over') : t('pair.title')}
        hint={over ? t('pair.overLook') : t('pair.hint')}
        media={
          <span className="play-mystery" aria-hidden>
            {over ? <TrophyIcon /> : '?'}
          </span>
        }
        aside={run && !over ? <span className="play-round">{t('pair.roundNo', { number: run.streak + 1 })}</span> : undefined}
      >
        <RoundStatus error={error} onRetry={() => void start()} />

        {question && (
          <>
              <p className="ask-line">
                {alone ? (
                  <>
                    <span className="ask-tag">{titleOf(parts[0].key)}</span>
                    <b>{parts.map((part) => tv(part.value)).join(glue)}</b>
                  </>
                ) : (
                  <b className="ask-mix">
                    {parts.map((part, index) => (
                      <span key={part.key + part.value}>
                        {index > 0 && <i>{glue}</i>}
                        <small>{titleOf(part.key)}</small>
                        {tv(part.value)}
                      </span>
                    ))}
                  </b>
                )}
              </p>

              <div className="pair-cards">
                {card('left')}
                {card('right')}
              </div>

              {over ? (
                <div className="pair-done">
                  <span className="pair-count">{over.streak}</span>
                  <small>{t('pair.overHint', { count: over.streak })}</small>
                  {over.fresh && over.streak > 0 ? (
                    <i className="pair-fresh">{t('pair.record')}</i>
                  ) : (
                    over.best > 0 && <small>{t('pair.bestWas', { count: over.best })}</small>
                  )}
                  <button className="primary" onClick={() => void start(true)} disabled={busy}>
                    {t('pair.again')}
                  </button>
                </div>
              ) : (
                <div className="pair-keys">
                  {SIDES.map((one) => (
                    <button
                      key={one.id}
                      type="button"
                      className={`pair-key ${shot?.answer === one.id ? 'right' : ''} ${shot && shot.pick === one.id && shot.answer !== one.id ? 'wrong' : ''}`}
                      disabled={busy || !!shot}
                      onClick={() => void pick(one.id)}
                    >
                      {shot?.answer === one.id && <CheckIcon />}
                      {shot && shot.pick === one.id && shot.answer !== one.id && <CloseIcon />}
                      {t(one.label)}
                    </button>
                  ))}
                </div>
              )}
          </>
        )}
      </PlayPanel>
    </PlayBoard>
  )
}
