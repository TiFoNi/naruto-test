'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { BOARD_DEFAULT, BOARD_SIZES, DUEL_MODES, DUEL_ROUNDS, DUEL_SECONDS, GRID_GAMES } from '@nanda/game'
import Avatar from './Avatar'
import Picker from './Picker'
import WorldMark from './WorldMark'
import { api } from './api'
import { useAuth } from './auth'
import { GAMES, gameById } from './games'
import type { Category, GameId } from './games/types'
import { useI18n, type UiKey } from './i18n'
import { MODES } from './modes'
import type { DuelView } from './useDuel'
import { CopyIcon, ExitIcon, SwordsIcon } from './icons'

const CATEGORIES: { id: Category; title: UiKey }[] = [
  { id: 'anime', title: 'dash.anime' },
  { id: 'manga', title: 'dash.mangaTitle' },
  { id: 'cartoon', title: 'dash.cartoon' },
  { id: 'screen', title: 'dash.screen' },
  { id: 'games', title: 'dash.games' },
  { id: 'sport', title: 'dash.sport' },
]

type Found = { id: string; nickname: string; tag?: string | null; avatar?: string | null }
type Mate = { id: string; nickname: string; tag: string | null; avatar?: string | null }

type Props = {
  duel: DuelView
  busy: boolean
  link: string
  onSetup: (patch: { game?: string; mode?: string; best?: number; seconds?: number; size?: number; strict?: boolean }) => void
  onInvite: (to: string) => void
  onReady: (want?: boolean) => void
  onLeave: () => void
}

const duelReady = (game: { modes: readonly string[] }) => game.modes.some((mode) => DUEL_MODES.includes(mode as never))

const duelMode = (game: { modes: readonly string[] }, current: string | null) => {
  const usable = DUEL_MODES.filter((mode) => mode === 'who' || game.modes.includes(mode))
  return current && usable.includes(current as never) ? current : usable[0]
}

export default function DuelSetup({ duel, busy, link, onSetup, onInvite, onReady, onLeave }: Props) {
  const { t, l } = useI18n()
  const { duels } = useAuth()
  const host = duel.host
  const game = gameById((duel.game ?? 'naruto') as GameId)
  const [category, setCategory] = useState<Category>(game.category)
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<Found[]>([])
  const [mates, setMates] = useState<Mate[]>([])
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setCategory(gameById((duel.game ?? 'naruto') as GameId).category)
  }, [duel.game])

  useEffect(() => {
    let alive = true
    void api<{ friends?: Mate[] }>('duel', { action: 'rivals' }).then(({ ok, data }) => {
      if (!alive || !ok) return
      setMates(data.friends ?? [])
    })
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
  const modes = useMemo(
    () => MODES.filter((one) => DUEL_MODES.includes(one.id as never) && (one.id === 'who' || game.modes.includes(one.id) || (one.id === 'grid' && GRID_GAMES.includes(game.id)))),
    [game],
  )

  const copy = () => {
    const invitation = `${t('share.duel', {
      game: l(game.label),
      mode: t(MODES.find((one) => one.id === duel.mode)?.label ?? 'mode.classic'),
    }).replace(/([?!])\./g, '$1')}\n${link}`
    navigator.clipboard?.writeText(invitation).then(
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
  const you = duel.you
  const waiting = duel.invited
  const played = duels.played
  const share = played ? Math.round((duels.wins / played) * 100) : 0
  const suggested = [...found, ...mates.filter((one) => !found.some((f) => f.id === one.id))].slice(0, 6)

  const picks = (
    <div className="duel-picks">
      <Picker
        rich
        disabled={!host || busy}
        label={t(CATEGORIES.find((one) => one.id === category)?.title ?? 'dash.anime')}
        value={category}
        onChange={(next) => {
          setCategory(next as Category)
          const first = GAMES.find((one) => one.category === next && duelReady(one))
          if (first && host) onSetup({ game: first.id, mode: duelMode(first, duel.mode) })
        }}
        options={CATEGORIES.filter((one) => GAMES.some((g) => g.category === one.id && duelReady(g))).map((one) => ({
          value: one.id,
          label: t(one.title),
          hint: t('duel.category').toUpperCase(),
        }))}
      />

      <Picker
        rich
        disabled={!host || busy}
        label={l(game.label)}
        value={game.id}
        onChange={(next) => onSetup({ game: next, mode: duelMode(gameById(next as GameId), duel.mode) })}
        options={worlds.map((one) => ({
          value: one.id,
          label: l(one.label),
          accent: one.accent,
          hint: t('lb.world').toUpperCase(),
          media: <WorldMark game={one.id} className="picker-mark" style={{ '--tab-accent': one.accent } as CSSProperties} />,
        }))}
      />

      <Picker
        rich
        disabled={!host || busy}
        label={t(modes.find((one) => one.id === duel.mode)?.label ?? 'mode.classic')}
        value={duel.mode ?? modes[0]?.id ?? 'classic'}
        onChange={(next) => onSetup({ mode: next })}
        options={modes.map((one) => ({
          value: one.id,
          label: t(one.label),
          hint: t('duel.mode').toUpperCase(),
          media: (
            <span className="picker-mark" aria-hidden>
              {one.icon}
            </span>
          ),
        }))}
      />

      <Picker
        rich
        disabled={!host || busy}
        label={t('duel.rounds', { count: duel.best })}
        value={String(duel.best)}
        onChange={(next) => onSetup({ best: Number(next) })}
        options={DUEL_ROUNDS.map((value) => ({
          value: String(value),
          label: t('duel.rounds', { count: value }),
          hint: t('duel.roundsTitle').toUpperCase(),
        }))}
      />

      <Picker
        rich
        disabled={!host || busy}
        label={timeLabel(duel.seconds)}
        value={String(duel.seconds)}
        onChange={(next) => onSetup({ seconds: Number(next) })}
        options={DUEL_SECONDS.map((value) => ({
          value: String(value),
          label: timeLabel(value),
          hint: t('duel.timeTitle').toUpperCase(),
        }))}
      />

      {duel.mode === 'who' && (
        <Picker
          rich
          disabled={!host || busy}
          label={`${duel.size ?? BOARD_DEFAULT}×${duel.size ?? BOARD_DEFAULT}`}
          value={String(duel.size ?? BOARD_DEFAULT)}
          onChange={(next) => onSetup({ size: Number(next) })}
          options={BOARD_SIZES.filter((value) => (duel.sizes ?? BOARD_SIZES).includes(value)).map((value) => ({
            value: String(value),
            label: `${value}×${value}`,
            hint: t('who.size').toUpperCase(),
          }))}
        />
      )}

      {duel.mode === 'grid' && (
        <Picker
          rich
          disabled={!host || busy}
          label={t(duel.strict ? 'grid.strictOn' : 'grid.strictOff')}
          value={duel.strict ? 'on' : 'off'}
          onChange={(next) => onSetup({ strict: next === 'on' })}
          options={[
            { value: 'off', label: t('grid.strictOff'), hint: t('grid.strictTitle').toUpperCase() },
            { value: 'on', label: t('grid.strictOn'), hint: t('grid.strictTitle').toUpperCase() },
          ]}
        />
      )}
    </div>
  )

  return (
    <div className={`duel-setup ${host ? '' : 'is-guest'}`}>
      <header className="duel-top">
        <div className="duel-top-name">
          <h1>{t('duel.newTitle')}</h1>
          <p className="muted">{t('duel.newLead')}</p>
        </div>
        <div className="duel-room">
          <span className="muted">{t('duel.codeLabel')}</span>
          <b>{duel.code}</b>
          <button type="button" className="ghost" onClick={copy}>
            <CopyIcon />
            {copied ? t('duel.copied') : t('duel.copyLink')}
          </button>
          <button type="button" className="duel-leave" onClick={onLeave} disabled={busy} aria-label={t('duel.leave')}>
            <ExitIcon />
          </button>
        </div>
      </header>

      <section className="duel-arena">
        <div className="duel-corner is-you">
          {you && <Avatar className="duel-face" id={you.id} name={you.nickname} avatar={you.avatar} />}
          <b>{you?.nickname ?? t('duel.youSide')}</b>
          <small>
            {t('duel.youSide')} · {t(host ? 'duel.hostSide' : 'duel.guestSide')}
          </small>
          {played > 0 && (
            <div className="duel-chips-row">
              <span>{t('duel.wins', { count: share })}</span>
              <span>{t('duel.played', { count: played })}</span>
            </div>
          )}
          <em className={you?.ready ? 'on' : ''}>{you?.ready ? t('duel.isReady') : t('duel.notReady')}</em>
        </div>

        <span className="duel-vs" aria-hidden>
          VS
        </span>

        <div className="duel-corner is-rival">
          {rival ? (
            <>
              <Avatar className="duel-face" id={rival.id} name={rival.nickname} avatar={rival.avatar} />
              <b>{rival.nickname}</b>
              <small>{t('duel.rivalSide')}</small>
              <em className={rival.ready ? 'on' : ''}>{rival.ready ? t('duel.isReady') : t('duel.notReady')}</em>
            </>
          ) : (
            <div className="duel-call">
              <b>{t('duel.callTitle')}</b>
              <p className="muted small">{waiting ? t('duel.waitingInvited', { name: waiting }) : t('duel.callLead')}</p>

              <div className="duel-call-row">
                <input value={query} placeholder={t('duel.invitePlaceholder')} onChange={(event) => setQuery(event.target.value)} />
                <button
                  type="button"
                  className="ghost"
                  disabled={busy || !suggested.length}
                  onClick={() => suggested[0] && invite(suggested[0].id)}
                >
                  {t('duel.callAction')}
                </button>
              </div>

              {suggested.length > 0 && (
                <ul className="duel-call-list">
                  {suggested.map((one) => (
                    <li key={one.id}>
                      <button type="button" disabled={busy} onClick={() => invite(one.id)}>
                        <Avatar className="small" id={one.id} name={one.nickname} avatar={one.avatar} />
                        <b>{one.nickname}</b>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {duel.declined && <em className="off">{t('duel.inviteDeclined')}</em>}
              {duel.left && <em className="off">{t('duel.rivalLeft', { name: duel.left })}</em>}
            </div>
          )}
        </div>
      </section>

      {picks}

      <footer className="duel-bar">
        <div className="duel-bar-text">
          <b>{rival ? t('duel.readyHint') : t('duel.callTitle')}</b>
          <p className="muted small">{!rival ? t('duel.readyLocked') : duel.you?.ready ? t('duel.readyWait') : t('duel.newLead')}</p>
        </div>
        <button type="button" className="primary big" disabled={busy || !rival} onClick={() => onReady(!duel.you?.ready)}>
          <SwordsIcon />
          {duel.you?.ready ? t('duel.readyCancel') : t('duel.ready')}
        </button>
      </footer>
    </div>
  )
}
