'use client'

import { useEffect, useState } from 'react'
import type { GameId } from '@nanda/game'
import { ShowcaseCard } from './Bestiary'
import { GAMES } from './games'
import { useI18n } from './i18n'
import { SwordsIcon } from './icons'
import { torn, tornPoints } from './torn'
import './styles/dex.css'

export type Bout = {
  game: string
  rival?: { id: string; nickname: string; avatar: string | null; frame: string | null }
  pick?: { id: number; name: { ru: string; uk: string; en: string }; image?: string }
  levels?: [number, number]
}

type Side = { id: string; nickname: string; avatar?: string | null; frame?: string | null }

export const BOUT_OPEN_MS = 10 * 60_000
export const BOUT_SKIP = new Set(['tunes', 'shots'])
const ROLL_MS = 1600
const TURN_MS = 420
const HOST_SEED = 11
const RIVAL_SEED = 29
const VS_CLIP = torn(71, 7, 5)
const JOIN_POINTS = tornPoints(53, 5, 7)
  .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
  .join(' ')

export const boutWorlds = () => GAMES.filter((game) => !BOUT_SKIP.has(game.id))

export default function ChatBout({
  id,
  bout,
  host,
  at,
  me,
  live,
  joining,
  onJoin,
}: {
  id: string
  bout: Bout
  host: Side
  at: number
  me: string | null
  live: boolean
  joining: boolean
  onJoin: (id: string) => void
}) {
  const { t, l } = useI18n()
  const [stage, setStage] = useState<'still' | 'shake' | 'turn'>(live && bout.pick ? 'shake' : 'still')
  const rolling = stage !== 'still'
  const [now, setNow] = useState(() => Date.now())
  const game = GAMES.find((one) => one.id === bout.game)
  const done = Boolean(bout.rival && bout.pick && bout.levels)
  const left = at + BOUT_OPEN_MS - now
  const expired = !done && left <= 0

  const pickId = bout.pick?.id

  useEffect(() => {
    if (!live || pickId === undefined) return
    setStage('shake')
    const timers = [window.setTimeout(() => setStage('turn'), ROLL_MS), window.setTimeout(() => setStage('still'), ROLL_MS + TURN_MS)]
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [live, pickId])

  useEffect(() => {
    if (done || expired) return
    const timer = window.setTimeout(() => setNow(Date.now()), Math.min(Math.max(left, 1000), 60_000))
    return () => window.clearTimeout(timer)
  }, [done, expired, left, now])

  const [hostLevel, rivalLevel] = bout.levels ?? [0, 0]
  const shown = done && !rolling
  const draw = shown && hostLevel === rivalLevel
  const winner = shown && !draw ? (hostLevel > rivalLevel ? 'host' : 'rival') : null
  const name = bout.pick ? l(bout.pick.name) : ''

  const blank = (seed: number) => (
    <span className="bout-card">
      <span className="dex-scrap bout-blank" aria-hidden>
        <i className="dex-paper" style={{ clipPath: torn(seed, 4) }} />
        <span className="dex-pic" style={{ clipPath: torn(seed * 3 + 1, 3, 7) }}>
          <b>?</b>
        </span>
        <i className="bout-bar" />
      </span>
    </span>
  )

  const card = (level: number, side: 'host' | 'rival') =>
    bout.pick && !rolling ? (
      <span className={`bout-card ${winner && winner !== side ? 'is-lost' : ''} ${winner === side ? 'is-won' : ''}`}>
        <ShowcaseCard game={bout.game as GameId} id={bout.pick.id} image={bout.pick.image} label={name} xp={level} level={level} />
        {winner && winner !== side && <b className="bout-stamp">{t('chat.boutLose')}</b>}
      </span>
    ) : (
      blank(side === 'host' ? HOST_SEED : RIVAL_SEED)
    )

  const sideClass = (which: 'host' | 'rival') => `bout-side is-${which} ${winner === which ? 'is-won' : ''} ${winner && winner !== which ? 'is-lost' : ''}`

  return (
    <div className={`bout ${live ? 'is-live' : ''} ${done ? 'is-done' : ''} ${expired ? 'is-expired' : ''} ${rolling ? 'is-rolling' : ''} ${stage === 'turn' ? 'is-turning' : ''}`} role="group" aria-label={t('chat.bout')}>
      <header className="bout-head">
        <span className="bout-title">{t('chat.bout')}</span>
        {game && (
          <span className="bout-world">{l(game.label)}</span>
        )}
      </header>
      <div className="bout-row">
        <div className={sideClass('host')}>
          {card(hostLevel, 'host')}
          <span className="bout-nick">{host.nickname}</span>
        </div>
        <span className={`bout-mid ${draw ? 'is-draw' : ''}`}>
          <b key={draw ? 'draw' : 'vs'} style={{ clipPath: VS_CLIP }}>
            {draw ? t('chat.boutDraw') : 'VS'}
          </b>
        </span>
        <div className={sideClass('rival')}>
          {card(rivalLevel, 'rival')}
          {bout.rival ? (
            <span className="bout-nick">{bout.rival.nickname}</span>
          ) : expired ? (
            <span className="bout-empty">{t('chat.boutExpired')}</span>
          ) : me && me !== host.id ? (
            <button type="button" className="bout-join" disabled={joining} onClick={() => onJoin(id)}>
              <svg className="bout-join-bg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
                <polygon points={JOIN_POINTS} vectorEffect="non-scaling-stroke" />
              </svg>
              <SwordsIcon />
              <span>{t('chat.boutJoin')}</span>
            </button>
          ) : (
            <span className="bout-empty is-waiting">{t('chat.boutWait')}</span>
          )}
        </div>
      </div>
    </div>
  )
}
