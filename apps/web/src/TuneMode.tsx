'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as Pointer } from 'react'
import { TUNE_LEVELS, type TuneLevel } from '@nanda/game'
import CharacterSearch from './CharacterSearch'
import { SoundIcon } from './icons'
import GiveUp from './GiveUp'
import PlayBoard from './PlayBoard'
import { BRAND } from './brand'
import { api } from './api'
import { useAuth } from './auth'
import { useI18n } from './i18n'
import type { UiKey } from './i18n/ui'
import type { Entity, Game } from './games/types'

type Run = {
  grade: TuneLevel
  step: number
  steps: number[]
  open: number
  full: number
  points: number
  status: 'playing' | 'over'
  streak: number
  best: number
  score: number
  peaks: number[]
  clip?: string
  lastId?: number
  right?: boolean
  answerId?: number
  total?: number
  guest?: boolean
}

const EMPTY = new Set<number>()

const meta = (one: Entity) => {
  const row = one as Entity & { op?: number | null; song?: string; artist?: string; year?: number | null }
  return [row.op ? `OP ${row.op}` : '', row.song ? `«${row.song}»` : '', row.artist, row.year].filter(Boolean).join(' · ')
}
const FADE = 2.5
const LOUD_KEY = 'tune-volume'

const GRADE_LABEL: Record<TuneLevel, UiKey> = {
  easy: 'tune.gradeEasy',
  normal: 'tune.gradeNormal',
  hard: 'tune.gradeHard',
}

const CURVE = 0.35

const MIN_SCRUB = 1

const MIN_GRAB = 44

const spanOf = (full: number) => Math.log1p(full / CURVE)

const spotOf = (seconds: number, full: number, flat = false) =>
  flat ? Math.max(0, seconds) / full : Math.log1p(Math.max(0, seconds) / CURVE) / spanOf(full)

const timeOf = (share: number, full: number, flat = false) => (flat ? share * full : CURVE * Math.expm1(share * spanOf(full)))

const tick = (seconds: number) => (seconds >= 10 ? `${Math.round(seconds)} с` : `${seconds.toFixed(1).replace('.', ',')} с`)

export default function TuneMode({ game, active }: { game: Game; active: boolean }) {
  const { t, name } = useI18n()
  const { user } = useAuth()
  const sound = useRef<HTMLAudioElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const fanfare = useRef(false)
  const [run, setRun] = useState<Run | null>(null)
  const [grade, setGrade] = useState<TuneLevel>('easy')
  const [at, setAt] = useState(0)
  const [going, setGoing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [held, setHeld] = useState(false)
  const [bumped, setBumped] = useState(false)
  const [touched, setTouched] = useState(false)
  const [loud, setLoud] = useState(() => {
    const kept = typeof window === 'undefined' ? null : window.localStorage.getItem(LOUD_KEY)
    const value = kept === null ? 0.8 : Number(kept)
    return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.8
  })
  const volume = useRef(0.8)
  const [tight, setTight] = useState(false)
  const [wide, setWide] = useState(0)
  const [openLoud, setOpenLoud] = useState(false)
  const loudBox = useRef<HTMLDivElement>(null)
  const holding = useRef(false)
  const grabbed = useRef<number | null>(null)

  const start = useCallback((node: HTMLAudioElement) => {
    node.play().catch(() => {
      const retry = () => {
        node.play().catch(() => setGoing(false))
      }
      node.addEventListener('canplay', retry, { once: true })
    })
  }, [])

  const send = useCallback(async (body: Record<string, unknown>) => {
    setBusy(true)
    const { ok, data } = await api<Run>('tune', body)
    setBusy(false)
    if (ok) setRun(data)
    return ok ? data : null
  }, [])

  useEffect(() => {
    if (!active || run) return
    void send({ grade })
  }, [active, run, grade, send])

  useEffect(() => {
    const node = sound.current
    if (!node) return
    const move = () => {
      if (!holding.current) setAt(node.currentTime)
    }
    const stop = () => setGoing(false)
    const rewind = () => {
      setGoing(false)
      if (holding.current) return
      setAt(0)
      node.currentTime = 0
    }
    node.addEventListener('timeupdate', move)
    node.addEventListener('ended', rewind)
    node.addEventListener('pause', stop)
    node.addEventListener('play', () => {
      setGoing(true)
      setTouched(true)
    })
    return () => {
      node.removeEventListener('timeupdate', move)
      node.removeEventListener('ended', rewind)
      node.removeEventListener('pause', stop)
    }
  }, [run?.clip])

  useEffect(() => {
    setAt(0)
  }, [run?.clip])

  useEffect(() => {
    setTouched(false)
  }, [run?.answerId, run?.lastId])

  useEffect(() => {
    if (!going) return
    const node = sound.current
    if (!node) return

    let frame = 0
    const follow = () => {
      if (!holding.current) setAt(node.currentTime)
      frame = requestAnimationFrame(follow)
    }

    frame = requestAnimationFrame(follow)
    return () => cancelAnimationFrame(frame)
  }, [going])

  useEffect(() => {
    const node = sound.current
    if (!node || !fanfare.current) return
    fanfare.current = false

    const go = () => {
      node.currentTime = 0
      start(node)
    }

    if (node.readyState >= 2) go()
    else node.addEventListener('canplay', go, { once: true })
    return () => node.removeEventListener('canplay', go)
  }, [run?.clip, start])

  const answer = async (entity: Entity) => {
    sound.current?.pause()
    const next = await send({ action: 'answer', pick: entity.id })
    if (next?.status === 'over') fanfare.current = true
  }

  const quit = async () => {
    sound.current?.pause()
    const next = await send({ action: 'giveup' })
    if (next?.status === 'over') fanfare.current = true
  }

  const skip = async () => {
    sound.current?.pause()
    const next = await send({ action: 'skip' })
    if (next?.status === 'over') fanfare.current = true
  }

  const again = useCallback(async () => {
    sound.current?.pause()
    await send({ action: 'restart', grade })
  }, [send, grade])

  useEffect(() => {
    volume.current = loud
    if (sound.current) sound.current.volume = loud
    try {
      window.localStorage.setItem(LOUD_KEY, String(loud))
    } catch {
      /* сховище може бути недоступне */
    }
  }, [loud, run?.clip])

  useEffect(() => {
    const node = sound.current
    if (!node || run?.status !== 'over') return

    const dim = () => {
      const left = node.duration - node.currentTime
      const ramp = Number.isFinite(left) ? Math.min(1, Math.max(0, left / FADE)) : 1
      node.volume = volume.current * ramp
    }

    const done = () => {
      node.volume = volume.current
    }

    node.addEventListener('timeupdate', dim)
    node.addEventListener('ended', done)
    return () => {
      node.removeEventListener('timeupdate', dim)
      node.removeEventListener('ended', done)
      node.volume = volume.current
    }
  }, [run?.status, run?.clip])


  useEffect(() => {
    if (!openLoud) return

    const away = (event: MouseEvent | TouchEvent) => {
      if (!loudBox.current?.contains(event.target as Node)) setOpenLoud(false)
    }
    const esc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenLoud(false)
    }

    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [openLoud])

  const pickGrade = async (next: TuneLevel) => {
    if (next === grade) return
    sound.current?.pause()
    setGrade(next)
    await send({ action: 'restart', grade: next })
  }

  const swapGrade = async (next: TuneLevel) => {
    if (next === grade) return
    sound.current?.pause()
    setGrade(next)
    const done = await send({ action: 'giveup' })
    if (done?.status === 'over') fanfare.current = true
  }

  useEffect(() => {
    const node = track.current
    if (!node) return

    const fit = () => {
      const room = node.clientWidth
      setTight(room < 520)
      setWide(room)
    }

    fit()
    const watch = new ResizeObserver(fit)
    watch.observe(node)
    return () => watch.disconnect()
  }, [run?.clip])

  const release = useCallback(() => {
    const node = track.current
    const id = grabbed.current
    try {
      if (node && id !== null && node.hasPointerCapture(id)) node.releasePointerCapture(id)
    } catch {
      /* вказівник уже відпущено */
    }
    grabbed.current = null
    holding.current = false
    setHeld(false)
  }, [])

  const toggle = useCallback(() => {
    release()
    const node = sound.current
    if (!node) return
    if (!node.paused) {
      node.pause()
      setGoing(false)
      return
    }

    const end = Number.isFinite(node.duration) ? node.duration : 0
    const spot = end && at >= end - 0.05 ? 0 : at
    if (Number.isFinite(node.duration)) node.currentTime = Math.min(spot, node.duration)
    start(node)
  }, [release, at, start])

  useEffect(() => {
    if (!active) return

    const tap = (event: KeyboardEvent) => {
      if (event.code !== 'Space' && event.key !== ' ') return
      const spot = event.target as HTMLElement | null
      if (spot?.closest('input, textarea, [contenteditable="true"]')) return
      if (spot?.closest('button, a')) return
      event.preventDefault()
      toggle()
    }

    document.addEventListener('keydown', tap)
    return () => document.removeEventListener('keydown', tap)
  }, [active, toggle])


  const seek = (event: Pointer<HTMLDivElement>) => {
    const node = track.current
    if (!node || !run) return
    const box = node.getBoundingClientRect()
    if (run.status === 'over') return
    const share = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width))
    const asked = timeOf(share, run.full)
    const spot = Math.min(run.open, asked)
    setBumped(asked > run.open + 0.05)
    setAt(spot)
    const audio = sound.current
    if (audio) audio.currentTime = Number.isFinite(audio.duration) ? Math.min(spot, audio.duration - 0.01) : spot
  }

  const roomy =
    !!run && run.status !== 'over' && run.open >= MIN_SCRUB && spotOf(run.open, run.full) * wide >= MIN_GRAB

  const grab = (event: Pointer<HTMLDivElement>) => {
    if (!roomy) return
    sound.current?.pause()
    holding.current = true
    setHeld(true)
    setTouched(true)
    seek(event)

    try {
      track.current?.setPointerCapture(event.pointerId)
      grabbed.current = event.pointerId
    } catch {
      grabbed.current = null
    }
  }

  const drag = (event: Pointer<HTMLDivElement>) => {
    if (holding.current) seek(event)
  }

  const drop = () => {
    release()
    setBumped(false)
  }

  if (!run) return <div className="tune-wrap is-wait" />

  const over = run.status === 'over'
  const started = run.status === 'playing' && (run.step > 0 || touched)
  const answered = over && run.lastId !== undefined ? game.entities.find((one) => one.id === run.lastId) : null
  const edge = spotOf(run.open, run.full, over)
  const played = spotOf(at, run.full, over)
  const tries = run.steps.length

  const side = (
    <aside className="play-side">
      <div className="play-card play-stats">
        <div className="hot">
          <span>{t('shot.score')}</span>
          <b>{run.score}</b>
        </div>
        <div>
          <span>{t('shot.streak')}</span>
          <b>{run.streak}</b>
        </div>
        <div>
          <span>{t('tune.solved')}</span>
          <b>{run.total ?? 0}</b>
        </div>
      </div>

      <div className="play-card play-howto">
        <span className="play-card-title">{t('howto.title')}</span>
        {[1, 2, 3, 4].map((step) => (
          <span key={step}>
            <i>{step}</i>
            {t(`howtoTune.step${step}` as 'howtoTune.step1')}
          </span>
        ))}
      </div>

      {!over && (
        <div className="play-actions">
          <GiveUp disabled={busy} onConfirm={() => void quit()}>
            {t('play.giveUp')}
          </GiveUp>
        </div>
      )}
    </aside>
  )

  return (
    <PlayBoard side={side}>
      <div className="tune-wrap">
        <div className="tune-grades" role="radiogroup" aria-label={t('tune.grade')}>
          {TUNE_LEVELS.map((one) => {
            const here = run.grade === one
            const style = `tune-grade is-${one} ${here ? 'on' : ''}`
            return started && !here ? (
              <GiveUp key={one} className={style} disabled={busy} hint="tune.swapAsk" onConfirm={() => void swapGrade(one)}>
                {t(GRADE_LABEL[one])}
              </GiveUp>
            ) : (
              <button
                key={one}
                type="button"
                role="radio"
                aria-checked={here}
                className={style}
                disabled={busy}
                onClick={() => void pickGrade(one)}
              >
                {t(GRADE_LABEL[one])}
              </button>
            )
          })}
        </div>

        <div className={`play-card tune-board ${over ? 'is-done' : ''}`}>
          <header className="tune-head">
            <button
              type="button"
              className={`tune-player ${going ? 'is-live' : ''}`}
              onClick={toggle}
              disabled={!run.clip}
              aria-label={going ? t('tune.pause') : t('tune.listen', { seconds: tick(run.open) })}
              title={going ? t('tune.pause') : t('tune.listen', { seconds: tick(run.open) })}
            >
              <span className={`tune-disc ${going ? 'is-spin' : ''}`} aria-hidden>
                <span className="tune-disc-label">
                  <b>{BRAND.mark}</b>
                </span>
              </span>
              <i className="tune-pivot" aria-hidden />
              <i className={`tune-arm ${going ? 'is-down' : ''}`} aria-hidden />
            </button>

            <div className="tune-copy">
              <span className="play-card-title">
                {!over || !answered
                  ? t('tune.try', { number: run.step + 1, total: tries })
                  : run.right
                    ? t('tune.guessed', { seconds: tick(run.steps[run.step]) })
                    : t('tune.missed')}
              </span>
              <h2>{over && answered ? name(answered) : t('tune.title')}</h2>
              {over && answered && <p className="tune-meta">{meta(answered)}</p>}

              {!over && (
                <div className="tune-acts">
                  <button type="button" className="primary tune-swap" disabled={!run.clip} onClick={toggle}>
                    <span className={going ? 'is-off' : ''}>{t('tune.play')}</span>
                    <span className={going ? '' : 'is-off'}>{t('tune.pause')}</span>
                  </button>
                  <button type="button" className="ghost" disabled={busy || run.step + 1 >= tries} onClick={() => void skip()}>
                    {t('tune.skip')}
                  </button>
                </div>
              )}
            </div>

            <div className="tune-aside">
              <div className={`tune-loud ${openLoud ? 'is-open' : ''}`} ref={loudBox}>
                <button
                  type="button"
                  className="tune-loud-knob"
                  onClick={() => setOpenLoud((shown) => !shown)}
                  aria-label={t('tune.volume')}
                  aria-expanded={openLoud}
                  title={t('tune.volume')}
                >
                  <SoundIcon className={loud === 0 ? 'is-off' : ''} />
                </button>
                <span className="tune-loud-slot">
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={loud}
                    style={{ '--fill': `${Math.round(loud * 100)}%` } as CSSProperties}
                    tabIndex={openLoud ? 0 : -1}
                    aria-label={t('tune.volume')}
                    onChange={(event) => setLoud(Number(event.target.value))}
                  />
                </span>
              </div>
            </div>
          </header>

                    <div
            className={`tune-rail ${held ? 'is-held' : ''} ${over ? 'is-locked' : ''} ${!over && !roomy ? 'is-flat' : ''}`}
            ref={track}
            onPointerDown={grab}
            onPointerMove={drag}
            onPointerUp={drop}
            onPointerCancel={drop}
            role="presentation"
          >
            <i className="tune-lane">
              <i className={`tune-open ${bumped ? 'is-bumped' : ''}`} style={{ width: `${edge * 100}%` }} />
              <i className="tune-played" style={{ width: `${Math.min(100, played * 100)}%` }} />
              {run.steps
                .slice(0, -1)
                .filter((seconds) => seconds !== run.open)
                .map((seconds) => (
                  <i key={seconds} className="tune-notch" style={{ left: `${spotOf(seconds, run.full, over) * 100}%` }} />
                ))}
            </i>
            <span className="tune-mark" style={{ '--at': `${Math.min(100, played * 100)}%` } as CSSProperties}>
              <b>{tick(at)}</b>
            </span>
          </div>

          <div className="tune-scale" aria-hidden>
            {(over ? (tight ? [0, 4, 8, 16] : [0, 2, 4, 8, 12, 16]) : tight ? [0, 1, 4, 16] : [0, 0.5, 1, 2, 4, 8, 16]).map((mark) => (
              <span key={mark} className={mark <= run.open ? 'on' : ''} style={{ left: `${spotOf(mark, run.full, over) * 100}%` }}>
                {mark === 0 ? '0' : tick(mark)}
              </span>
            ))}
          </div>

          <div className="tune-foot">
            {over ? (
              <button type="button" className="primary tune-next" onClick={() => void again()} disabled={busy}>
                {t('shot.next')}
              </button>
            ) : (
              <CharacterSearch game={game} exclude={EMPTY} busy={busy} noThumbs placeholder={t('tune.search')} onPick={(entity) => void answer(entity)} />
            )}
          </div>
        </div>

        {run.clip && <audio ref={sound} src={run.clip} preload="auto" />}
        {!user && <p className="notice tune-guest">{t('guest.note')}</p>}
      </div>
    </PlayBoard>
  )
}
