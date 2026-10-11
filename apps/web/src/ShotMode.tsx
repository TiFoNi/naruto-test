'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import CharacterSearch from './CharacterSearch'
import GiveUp from './GiveUp'
import PlayBoard from './PlayBoard'
import PlayPanel from './PlayPanel'
import RoundStatus from './RoundStatus'
import { api, apiSrc } from './api'
import type { Entity, Game } from './games/types'
import { useI18n } from './i18n'
import { CheckIcon, CloseIcon, TrophyIcon } from './icons'

type Run = {
  score: number
  streak: number
  best: number
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
  level?: number
  points?: number
  shots?: string[]
  fresh?: boolean
}

type Over = { score: number; streak: number; best: number; answerId?: number; fresh: boolean }

const STEPS = [1, 2, 3, 4] as const
const FLASH = 1100

export default function ShotMode({ game, active }: { game: Game; active: boolean }) {
  const { t, name } = useI18n()
  const [run, setRun] = useState<Run | null>(null)
  const [over, setOver] = useState<Over | null>(null)
  const [flash, setFlash] = useState<{ kind: 'got' | 'miss'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [soon, setSoon] = useState(false)
  const [big, setBig] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

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
    setFlash(null)
    if (data.status === 'over') {
      setRun(null)
      setOver({ score: data.score, streak: data.streak, best: data.best, answerId: data.lastId, fresh: data.score > 0 && data.score >= data.best })
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

  useEffect(() => {
    if (!big) return
    const escape = (event: KeyboardEvent) => event.key === 'Escape' && setBig(null)
    document.addEventListener('keydown', escape)
    return () => document.removeEventListener('keydown', escape)
  }, [big])

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  const show = (kind: 'got' | 'miss', text: string) => {
    setFlash({ kind, text })
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setFlash(null), FLASH)
  }

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
      setOver({ score: data.score, streak: data.streak, best: data.best, answerId: data.answerId, fresh: !!data.fresh })
      return data
    }
    setRun((current) =>
      current
        ? {
            ...current,
            score: data.score,
            streak: data.streak ?? current.streak,
            best: data.best ?? current.best,
            level: data.level ?? current.level,
            points: data.points ?? current.points,
            shots: data.shots ?? current.shots,
          }
        : current,
    )
    return data
  }

  const pick = async (entity: Entity) => {
    const data = await send({ action: 'answer', pick: entity.id })
    if (!data || data.over) return
    if (data.right) show('got', t('shot.got', { count: data.gained ?? 0 }))
    else show('miss', t('shot.miss'))
  }

  const revealed = over?.answerId !== undefined ? byId.get(over.answerId) : undefined

  return (
    <PlayBoard
      side={
        <aside className="play-side">
          <div className="play-card play-stats shot-score">
            <div className="hot">
              <span>{t('shot.score')}</span>
              <b>{over ? over.score : (run?.score ?? 0)}</b>
            </div>
            <div>
              <span>{t('shot.streak')}</span>
              <b>{over ? over.streak : (run?.streak ?? 0)}</b>
            </div>
            <div>
              <span>{t('shot.best')}</span>
              <b>{over ? over.best : (run?.best ?? 0)}</b>
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
        hint={over ? t('shot.overLook') : t('shot.hint')}
        media={
          <span className="play-mystery" aria-hidden>
            {over ? <TrophyIcon /> : '?'}
          </span>
        }
        aside={run && !over ? <span className="play-round">{t('shot.frame', { number: run.level + 1, total: run.levels })}</span> : undefined}
      >
        <RoundStatus error={error} onRetry={() => void start()} />

        {soon && <p className="notice shot-soon">{t('shot.soon')}</p>}

        {run && !over && (
          <>
            <div className="shot-grid">
              {Array.from({ length: run.levels }, (_, step) => {
                const src = apiSrc(run.shots?.[step])
                return src ? (
                  <button
                    key={step}
                    type="button"
                    className="shot-cell"
                    title={t('shot.open')}
                    aria-label={t('shot.open')}
                    onClick={() => setBig(src)}
                  >
                    <img key={src} src={src} alt="" draggable={false} />
                  </button>
                ) : (
                  <span key={step} className="shot-cell locked" aria-hidden>
                    {step + 1}
                  </span>
                )
              })}
              {flash && (
                <span className={`shot-flash ${flash.kind}`}>
                  {flash.kind === 'got' ? <CheckIcon /> : <CloseIcon />}
                  {flash.text}
                </span>
              )}
            </div>

            <CharacterSearch game={game} exclude={new Set()} busy={busy} plain placeholder={t('shot.search')} onPick={(entity) => void pick(entity)} />

            <div className="shot-keys">
              <button type="button" className="ghost" disabled={busy} onClick={() => void send({ action: 'skip' })}>
                {t('shot.skip')}
              </button>
            </div>
          </>
        )}

        {over && (
          <div className="shot-done">
            <span className="shot-count">{over.score}</span>
            <small>{t('shot.overHint', { count: over.score })}</small>
            {revealed && <b className="shot-was">{t('shot.was', { name: name(revealed) })}</b>}
            {over.fresh && over.score > 0 ? (
              <i className="shot-fresh">{t('shot.record')}</i>
            ) : (
              over.best > 0 && <small>{t('shot.bestWas', { count: over.best })}</small>
            )}
            <button className="primary" disabled={busy} onClick={() => void start(true)}>
              {t('shot.again')}
            </button>
          </div>
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
