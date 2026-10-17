'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { BOARD_DEFAULT, BOARD_SIZES, DUEL_MODES, DUEL_ROUNDS, DUEL_SECONDS, DUEL_TEAM_SIZES, GRID_GAMES, TEAM_MODES } from '@nanda/game'
import Avatar from './Avatar'
import { UserIcon } from './icons'
import Picker from './Picker'
import WorldMark from './WorldMark'
import { api } from './api'
import { GAMES, gameById } from './games'
import type { Category, GameId } from './games/types'
import { useI18n, type UiKey } from './i18n'
import { MODES } from './modes'
import type { DuelView } from './useDuel'
import { CopyIcon, ExitIcon } from './icons'

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
  onSetup: (patch: { game?: string; mode?: string; best?: number; seconds?: number; size?: number; per?: number; strict?: boolean }) => void
  onTeam: () => void
  onInvite: (to: string) => void
  onReady: (want?: boolean) => void
  onLeave: () => void
}

const TEAM_LABEL: Record<number, 'duel.teamSolo'> = {
  1: 'duel.teamSolo',
  2: 'duel.teamDuo' as 'duel.teamSolo',
  3: 'duel.teamTrio' as 'duel.teamSolo',
}

const duelReady = (game: { modes: readonly string[] }) => game.modes.some((mode) => DUEL_MODES.includes(mode as never))

const duelMode = (game: { modes: readonly string[] }, current: string | null) => {
  const usable = DUEL_MODES.filter((mode) => mode === 'who' || game.modes.includes(mode))
  return current && usable.includes(current as never) ? current : usable[0]
}

export default function DuelSetup({ duel, busy, link, onSetup, onInvite, onReady, onTeam, onLeave }: Props) {
  const { t, l } = useI18n()
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
  const per = duel.per ?? 1
  const mineTeam = duel.youTeam ?? 0
  const ours = duel.squads?.[mineTeam] ?? []
  const theirs = duel.squads?.[mineTeam === 0 ? 1 : 0] ?? []
  const canSwitch = per > 1 && theirs.length < per
  const free = (duel.seats ?? 2) - (ours.length + theirs.length)

  const waiting = duel.invited
  const suggested = [...found, ...mates.filter((one) => !found.some((f) => f.id === one.id))]

  const side = (team: number) => {
    const line = duel.squads?.[team] ?? []
    const set = line.length > 0 && line.every((one) => one.ready)
    return (
      <div className={`duel-corner ${team === 0 ? 'is-you' : 'is-rival'} ${team === mineTeam ? 'is-mine' : ''}`}>
        <b className="duel-team-name">{t(team === 0 ? 'duel.teamA' : 'duel.teamB')}</b>
        <ul className="duel-team" style={{ '--seats': per } as CSSProperties}>
          {Array.from({ length: per }, (_, slot) => {
            const mate = line[slot]
            return (
              <li key={slot} className={mate ? (mate.you ? 'is-you-card' : '') : 'empty'}>
                {mate ? (
                  <>
                    <Avatar className="duel-face" id={mate.id} name={mate.nickname} avatar={mate.avatar} />
                    <b>{mate.nickname}</b>
                    <small className={mate.ready ? 'on' : ''}>
                      {mate.you ? `${t('duel.youSide')} · ` : ''}
                      {mate.ready ? t('duel.isReady') : t('duel.notReady')}
                    </small>
                  </>
                ) : (
                  <>
                    <i className="duel-hole" aria-hidden>
                      <UserIcon />
                    </i>
                    <span>{t('duel.teamWait')}</span>
                  </>
                )}
              </li>
            )
          })}
        </ul>
        <em className={set ? 'on' : ''}>{line.length ? (set ? t('duel.isReady') : t('duel.notReady')) : '\u00a0'}</em>
      </div>
    )
  }

  const callBox = (
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
  )


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

      {TEAM_MODES.includes((duel.mode ?? 'classic') as never) && (
        <Picker
          rich
          disabled={!host || busy}
          label={t(TEAM_LABEL[duel.per ?? 1])}
          value={String(duel.per ?? 1)}
          onChange={(next) => onSetup({ per: Number(next) })}
          options={DUEL_TEAM_SIZES.map((value) => ({
            value: String(value),
            label: t(TEAM_LABEL[value]),
            hint: t('duel.teamTitle').toUpperCase(),
          }))}
        />
      )}

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
        {side(0)}

        <span className="duel-vs" aria-hidden>
          VS
        </span>

        {side(1)}
      </section>

      {canSwitch && (
        <div className="duel-under">
          <button type="button" className="ghost small" disabled={busy} onClick={onTeam}>
            {t('duel.teamSwitch')}
          </button>
        </div>
      )}

      {free > 0 && <section className="duel-call-wide">{callBox}</section>}

      {picks}

      <footer className="duel-bar">
        <button type="button" className="primary big" disabled={busy || !rival} onClick={() => onReady(!duel.you?.ready)}>
          {duel.you?.ready ? t('duel.readyCancel') : t('duel.ready')}
        </button>
      </footer>
    </div>
  )
}
