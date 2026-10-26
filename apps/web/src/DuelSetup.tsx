'use client'

import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { BOARD_DEFAULT, BOARD_SIZES, CLUE_DEFAULT, CLUE_SIZES, DUEL_MODES, DUEL_ROUNDS, DUEL_SECONDS, GRID_GAMES, TEAM_MODES } from '@nanda/game'
import Avatar from './Avatar'
import { bannerPic, bannerSpot } from './banners'
import { ChevronIcon, UserIcon } from './icons'
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

type Found = { id: string; nickname: string; tag?: string | null; avatar?: string | null; frame?: string | null; banner?: string | null }
type Mate = { id: string; nickname: string; tag: string | null; avatar?: string | null; frame?: string | null; banner?: string | null }

type Props = {
  duel: DuelView
  busy: boolean
  link: string
  onSetup: (patch: { game?: string; mode?: string; best?: number; seconds?: number; size?: number; per?: number; teams?: number; strict?: boolean }) => void
  onSeat: (team: number, lead?: boolean) => void
  onInvite: (to: string) => void
  onReady: (want?: boolean) => void
  onLeave: () => void
}


const duelReady = (game: { modes: readonly string[] }) => game.modes.some((mode) => DUEL_MODES.includes(mode as never))

const duelMode = (game: { modes: readonly string[] }, current: string | null) => {
  const usable = DUEL_MODES.filter((mode) => mode === 'who' || mode === 'clue' || game.modes.includes(mode))
  return current && usable.includes(current as never) ? current : usable[0]
}

export default function DuelSetup({ duel, busy, link, onSetup, onInvite, onReady, onSeat, onLeave }: Props) {
  const { t, l } = useI18n()
  const host = duel.host
  const game = gameById((duel.game ?? 'naruto') as GameId)
  const [category, setCategory] = useState<Category>(game.category)
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<Found[]>([])
  const [mates, setMates] = useState<Mate[]>([])
  const [copied, setCopied] = useState(false)
  const [picking, setPicking] = useState(false)
  const matesRef = useRef<HTMLDivElement>(null)

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
    () =>
      MODES.filter(
        (one) =>
          DUEL_MODES.includes(one.id as never) &&
          (one.id === 'who' || one.id === 'clue' || game.modes.includes(one.id) || (one.id === 'grid' && GRID_GAMES.includes(game.id))) &&
          (((duel.per ?? 1) < 2 && (duel.teams ?? 2) < 3) || TEAM_MODES.includes(one.id as never)),
      ),
    [game, duel.per, duel.teams],
  )

  useEffect(() => {
    if (!picking) return
    const away = (event: MouseEvent) => {
      if (!matesRef.current?.contains(event.target as Node)) setPicking(false)
    }
    const escape = (event: KeyboardEvent) => event.key === 'Escape' && setPicking(false)
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', escape)
    }
  }, [picking])

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
  const teams = duel.teams ?? 2
  const mineTeam = duel.youTeam ?? 0
  const taken = (duel.squads ?? []).reduce((sum, line) => sum + line.length, 0)
  const free = (duel.seats ?? 2) - taken

  const waiting = duel.invited
  const asked = query.trim().toLowerCase()
  const hits: Found[] = asked
    ? [
        ...found,
        ...mates.filter(
          (one) =>
            !found.some((other) => other.id === one.id) &&
            (one.nickname.toLowerCase().includes(asked) || (one.tag ?? '').toLowerCase().includes(asked.replace('#', ''))),
        ),
      ]
    : mates
  const open = hits.length > 0 && (asked ? asked.length >= 2 : picking)

  const chief = duel.mode === 'clue'

  const side = (team: number) => {
    const line = duel.squads?.[team] ?? []
    const boss = chief ? line.find((one) => one.lead) : undefined
    const crew = chief ? line.filter((one) => !one.lead) : line
    const seats = chief
      ? [{ lead: true, mate: boss }, ...Array.from({ length: Math.max(1, per - 1) }, (_, slot) => ({ lead: false, mate: crew[slot] }))]
      : Array.from({ length: per }, (_, slot) => ({ lead: false, mate: line[slot] }))

    return (
      <div className={`duel-corner ${team === 0 ? 'is-you' : 'is-rival'} ${team === mineTeam ? 'is-mine' : ''}`}>
        <b className="duel-team-name">{t('duel.teamNth', { number: team + 1 })}</b>
        <ul className="duel-team" style={{ '--seats': seats.length } as CSSProperties}>
          {seats.map((spot, slot) => {
            const mate = spot.mate
            return (
              <li key={slot} className={`${mate ? (mate.you ? 'is-you-card' : '') : 'empty'} ${spot.lead ? 'is-lead' : ''}`}>
                {mate ? (
                  <>
                    {mate.banner && (
                      <span className="duel-seat-art" aria-hidden>
                        <img src={bannerPic(mate.banner)} alt="" style={{ objectPosition: bannerSpot(mate.banner) }} />
                      </span>
                    )}
                    {spot.lead && <em className="duel-seat-tag">{t('clue.lead')}</em>}
                    <Avatar className="duel-face" id={mate.id} name={mate.nickname} avatar={mate.avatar} frame={mate.frame} />
                    <span className="duel-seat-text">
                      <b>{mate.nickname}</b>
                      {mate.title && <i className={`player-title is-slim is-${mate.title}`}>{t(`title.${mate.title}` as UiKey)}</i>}
                      <small className={mate.ready ? 'on' : ''}>
                        {mate.you ? `${t('duel.youSide')} · ` : ''}
                        {mate.ready ? t('duel.isReady') : t('duel.notReady')}
                      </small>
                    </span>
                  </>
                ) : (
                  <button type="button" className="duel-seat" disabled={busy} onClick={() => onSeat(team, spot.lead)}>
                    {spot.lead && <em className="duel-seat-tag">{t('clue.lead')}</em>}
                    <i className="duel-hole" aria-hidden>
                      <UserIcon />
                    </i>
                    <span>{t('duel.takeSeat')}</span>
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    )
  }

  const callBox = (
          <div className="duel-call">
            <b>{t('duel.callTitle')}</b>
            <p className="muted small">{waiting ? t('duel.waitingInvited', { name: waiting }) : t('duel.callLead')}</p>

            <div className={`duel-call-row duel-mates ${open ? 'is-open' : ''}`} ref={matesRef}>
              <input
                value={query}
                placeholder={t('duel.invitePlaceholder')}
                onChange={(event) => setQuery(event.target.value)}
              />

              {query ? (
                <button type="button" className="ghost" disabled={busy || !hits.length} onClick={() => hits[0] && invite(hits[0].id)}>
                  {t('duel.callAction')}
                </button>
              ) : (
                <button type="button" className="ghost" disabled={busy || !mates.length} onClick={() => setPicking(!picking)}>
                  {t('duel.mates')}
                  <ChevronIcon />
                </button>
              )}

              {open && (
                <ul className="duel-mates-pop">
                  {hits.map((one) => (
                    <li key={one.id}>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setPicking(false)
                          void invite(one.id)
                        }}
                      >
                        {one.banner && (
                          <span className="duel-mate-art" aria-hidden>
                            <img src={bannerPic(one.banner)} alt="" style={{ objectPosition: bannerSpot(one.banner) }} />
                          </span>
                        )}
                        <Avatar className="duel-mate-face" id={one.id} name={one.nickname} avatar={one.avatar} frame={one.frame} small />
                        <span className="duel-mate-text">
                          <b>{one.nickname}</b>
                          {one.tag && <em>#{one.tag}</em>}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

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

      {duel.mode === 'clue' && (
        <Picker
          rich
          disabled={!host || busy}
          label={`${duel.size ?? CLUE_DEFAULT}×${duel.size ?? CLUE_DEFAULT}`}
          value={String(duel.size ?? CLUE_DEFAULT)}
          onChange={(next) => onSetup({ size: Number(next) })}
          options={CLUE_SIZES.filter((value) => (duel.sizes ?? CLUE_SIZES).includes(value)).map((value) => ({
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

      <section className={`duel-arena ${teams > 3 ? 'is-quad' : teams > 2 ? 'is-trio' : ''}`} style={{ '--sides': teams } as CSSProperties}>
        {Array.from({ length: teams }, (_, team) => (
          <Fragment key={team}>
            {team > 0 && (
              <span className="duel-vs" aria-hidden>
                VS
              </span>
            )}
            {side(team)}
          </Fragment>
        ))}
      </section>

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
