'use client'

import { useEffect, useMemo, useState } from 'react'
import { BOARD_DEFAULT, BOARD_SIZES, DUEL_MODES, DUEL_ROUNDS, DUEL_SECONDS } from '@nanda/game'
import { api } from './api'
import { GAMES, gameById } from './games'
import type { Category, GameId } from './games/types'
import { useI18n, type UiKey } from './i18n'
import { MODES } from './modes'
import Share from './Share'
import WorldMark from './WorldMark'
import type { DuelView } from './useDuel'
import { CopyIcon, DiceIcon, ExitIcon, LinkIcon, SwordsIcon } from './icons'

const CATEGORIES: { id: Category; title: UiKey }[] = [
  { id: 'anime', title: 'dash.anime' },
  { id: 'manga', title: 'dash.mangaTitle' },
  { id: 'cartoon', title: 'dash.cartoon' },
  { id: 'screen', title: 'dash.screen' },
  { id: 'games', title: 'dash.games' },
  { id: 'sport', title: 'dash.sport' },
]

type Rival = { id: string; nickname: string; wins: number; losses: number }
type Found = { id: string; nickname: string }

type Props = {
  duel: DuelView
  busy: boolean
  link: string
  onSetup: (patch: { game?: string; mode?: string; best?: number; seconds?: number; size?: number }) => void
  onInvite: (to: string) => void
  onReady: () => void
  onLeave: () => void
}

const duelReady = (game: { modes: readonly string[] }) => game.modes.some((mode) => DUEL_MODES.includes(mode as never))

const duelMode = (game: { modes: readonly string[] }, current: string | null) => {
  const usable = DUEL_MODES.filter((mode) => mode === 'who' || game.modes.includes(mode))
  return current && usable.includes(current as never) ? current : usable[0]
}

export default function DuelSetup({ duel, busy, link, onSetup, onInvite, onReady, onLeave }: Props) {
  const { t, l } = useI18n()
  const host = duel.host
  const game = gameById((duel.game ?? 'naruto') as GameId)
  const [category, setCategory] = useState<Category>(game.category)
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<Found[]>([])
  const [rivals, setRivals] = useState<Rival[]>([])
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setCategory(gameById((duel.game ?? 'naruto') as GameId).category)
  }, [duel.game])

  useEffect(() => {
    let alive = true
    void api<{ rivals?: Rival[] }>('duel', { action: 'rivals' }).then(({ ok, data }) => alive && ok && setRivals(data.rivals ?? []))
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    const value = query.trim()
    if (value.length < 2) return setFound([])
    let alive = true
    const timer = setTimeout(() => {
      void api<{ players?: Found[] }>('duel', { action: 'players', q: value }).then(({ ok, data }) => alive && ok && setFound(data.players ?? []))
    }, 250)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [query])

  const worlds = useMemo(() => GAMES.filter((one) => one.category === category && duelReady(one)), [category])
  const modes = MODES.filter((mode) => DUEL_MODES.includes(mode.id) && (mode.id === 'who' || game.modes.includes(mode.id)))

  const copy = () => {
    navigator.clipboard?.writeText(link).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      },
      () => setCopied(false),
    )
  }

  const invite = (id: string) => {
    onInvite(id)
    setQuery('')
    setFound([])
  }

  const timeLabel = (value: number) =>
    value >= 120 && value % 60 === 0 ? t('duel.minutesShort', { count: value / 60 }) : t('duel.secondsShort', { count: value })

  const rival = duel.rival
  const waiting = duel.invited
  const hostSide = duel.host ? duel.you : duel.rival
  const guestSide = duel.host ? duel.rival : duel.you

  return (
    <div className="duel-setup">
      <header className="duel-setup-head">
        <div>
          <h1>{t('duel.newTitle')}</h1>
          <p className="muted">{t('duel.newLead')}</p>
        </div>
        <div className="duel-code">
          <span className="muted">{t('duel.codeLabel')}</span>
          <b>{duel.code}</b>
          <button type="button" className="ghost" onClick={copy}>
            <CopyIcon />
            {copied ? t('duel.copied') : t('duel.copyLink')}
          </button>
          <Share
            text={t('share.duel', { game: l(game.label), mode: t(MODES.find((one) => one.id === duel.mode)?.label ?? 'mode.classic') })}
            url={link}
          />
          <button type="button" className="duel-leave" onClick={onLeave} disabled={busy}>
            <ExitIcon />
            {t('duel.leave')}
          </button>
        </div>
      </header>

      <div className="duel-setup-grid">
        <div className="duel-setup-main">
          <section className="card duel-step">
            <div className="duel-step-head">
              <h2>
                <i>1</i>
                {t('duel.stepWorld')}
              </h2>
              <div className="duel-cats">
                {CATEGORIES.filter((one) => GAMES.some((g) => g.category === one.id && duelReady(g))).map((one) => (
                  <button
                    key={one.id}
                    type="button"
                    className={category === one.id ? 'active' : ''}
                    disabled={!host}
                    onClick={() => setCategory(one.id)}
                  >
                    {t(one.title)}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="ghost duel-random"
                disabled={!host || busy}
                onClick={() => {
                  const pick = worlds[Math.floor(Math.random() * worlds.length)]
                  onSetup({ game: pick.id, mode: duelMode(pick, duel.mode) })
                }}
              >
                <DiceIcon />
                {t('duel.random')}
              </button>
            </div>

            <div className="duel-worlds">
              {worlds.map((one) => (
                <button
                  key={one.id}
                  type="button"
                  className={`duel-world ${duel.game === one.id ? 'active' : ''}`}
                  style={{ '--game': one.accent } as React.CSSProperties}
                  disabled={!host || busy}
                  onClick={() => onSetup({ game: one.id, mode: duelMode(one, duel.mode) })}
                >
                  <WorldMark game={one.id} className="duel-world-mark" />
                  <span>{l(one.label)}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="card duel-step">
            <div className="duel-step-head">
              <h2>
                <i>2</i>
                {t('duel.stepMode')}
              </h2>
              <span className="muted small">{t('duel.modesFor', { game: l(game.label) })}</span>
            </div>
            <div className="duel-modes">
              {modes.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  className={`duel-mode ${duel.mode === mode.id ? 'active' : ''}`}
                  disabled={!host || busy}
                  onClick={() => onSetup({ mode: mode.id })}
                >
                  <span className="duel-mode-icon" aria-hidden>
                    {mode.icon}
                  </span>
                  <span>
                    <b>{t(mode.label)}</b>
                    <small>{t(mode.description)}</small>
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="card duel-step">
            <div className="duel-step-head">
              <h2>
                <i>3</i>
                {t('duel.stepRules')}
              </h2>
            </div>
            <div className={`duel-rules ${duel.mode === 'who' ? 'with-board' : ''}`}>
              <div>
                <span className="duel-rules-title">{t('duel.roundsTitle')}</span>
                <div className="duel-chips">
                  {DUEL_ROUNDS.map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={duel.best === value ? 'active' : ''}
                      disabled={!host || busy}
                      onClick={() => onSetup({ best: value })}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
              {duel.mode === 'who' && (
                <div>
                  <span className="duel-rules-title">{t('who.size')}</span>
                  <div className="duel-chips">
                    {BOARD_SIZES.map((value) => (
                      <button
                        key={value}
                        type="button"
                        className={(duel.size ?? BOARD_DEFAULT) === value ? 'active' : ''}
                        disabled={!host || busy || !(duel.sizes ?? BOARD_SIZES).includes(value)}
                        title={(duel.sizes ?? BOARD_SIZES).includes(value) ? undefined : t('who.sizeShort', { count: value * value })}
                        onClick={() => onSetup({ size: value })}
                      >
                        {value}×{value}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <span className="duel-rules-title">{t('duel.timeTitle')}</span>
                <div className="duel-chips">
                  {DUEL_SECONDS.map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={duel.seconds === value ? 'active' : ''}
                      disabled={!host || busy}
                      onClick={() => onSetup({ seconds: value })}
                    >
                      {timeLabel(value)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <p className="duel-note">
              {t(duel.mode === 'who' ? 'duel.rulesWho' : 'duel.rulesNote', {
                needed: duel.needed,
                best: duel.best,
                time: timeLabel(duel.seconds),
              })}
            </p>
          </section>
        </div>

        <aside className="duel-setup-side">
          <section className="card duel-seats">
            {hostSide ? (
              <div className="duel-seat">
                <span className="duel-seat-tag">{t('duel.host')}</span>
                <span className="avatar" aria-hidden>
                  {hostSide.nickname.charAt(0).toUpperCase()}
                </span>
                <b>{hostSide.nickname}</b>
                <em className={hostSide.ready ? 'on' : ''}>{hostSide.ready ? t('duel.isReady') : t('duel.notReady')}</em>
              </div>
            ) : (
              <div className="duel-seat empty">
                <i aria-hidden>+</i>
                <span>{t('duel.waitingRival')}</span>
              </div>
            )}
            <span className="duel-seats-vs">VS</span>
            {guestSide ? (
              <div className="duel-seat">
                <span className="avatar" aria-hidden>
                  {guestSide.nickname.charAt(0).toUpperCase()}
                </span>
                <b>{guestSide.nickname}</b>
                <em className={guestSide.ready ? 'on' : ''}>{guestSide.ready ? t('duel.isReady') : t('duel.notReady')}</em>
              </div>
            ) : (
              <div className="duel-seat empty">
                <i aria-hidden>+</i>
                <span>{waiting ? t('duel.waitingInvited', { name: waiting }) : t('duel.waitingRival')}</span>
                {duel.declined && <em className="off">{t('duel.inviteDeclined')}</em>}
                {duel.left && <em className="off">{t('duel.rivalLeft', { name: duel.left })}</em>}
              </div>
            )}
          </section>

          {host && !rival && (
            <section className="card duel-invite-box">
              <span className="duel-rules-title">{t('duel.inviteTitle')}</span>
              <input value={query} placeholder={t('duel.invitePlaceholder')} onChange={(e) => setQuery(e.target.value)} />
              {found.length > 0 && (
                <ul className="duel-found">
                  {found.map((one) => (
                    <li key={one.id}>
                      <span className="avatar small" aria-hidden>
                        {one.nickname.charAt(0).toUpperCase()}
                      </span>
                      <b>{one.nickname}</b>
                      <button type="button" className="ghost" disabled={busy} onClick={() => invite(one.id)}>
                        {t('duel.invite')}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {rivals.length > 0 && (
                <>
                  <span className="duel-rules-title">{t('duel.recent')}</span>
                  <ul className="duel-found">
                    {rivals.map((one) => (
                      <li key={one.id}>
                        <span className="avatar small" aria-hidden>
                          {one.nickname.charAt(0).toUpperCase()}
                        </span>
                        <span className="duel-found-name">
                          <b>{one.nickname}</b>
                          <small>{t('duel.recentScore', { wins: one.wins, losses: one.losses })}</small>
                        </span>
                        <button type="button" className="ghost" disabled={busy} onClick={() => invite(one.id)}>
                          {t('duel.invite')}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              <button type="button" className="duel-copy-line" onClick={copy}>
                <LinkIcon />
                {copied ? t('duel.copied') : t('duel.orCopy')}
              </button>
            </section>
          )}

          <section className="card duel-go">
            <div className="duel-summary">
              <em>{l(game.label)}</em>
              <em>{t(MODES.find((m) => m.id === duel.mode)?.label ?? 'mode.classic')}</em>
              <em>{t('duel.rounds', { count: duel.best })}</em>
              <em>{t('duel.timeShort', { time: timeLabel(duel.seconds) })}</em>
            </div>
            <button type="button" className="primary big" disabled={busy || !rival || duel.you?.ready} onClick={onReady}>
              <SwordsIcon />
              {duel.you?.ready ? t('duel.readyWait') : t('duel.ready')}
            </button>
            <p className="muted small">{rival ? t('duel.readyHint') : t('duel.readyLocked')}</p>
          </section>
        </aside>
      </div>
    </div>
  )
}
