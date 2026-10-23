'use client'

import { Fragment, useState, type CSSProperties } from 'react'
import { DUEL_TEAM_COUNTS, DUEL_TEAM_SIZES, TEAM_MODES } from '@nanda/game'
import BackButton from './BackButton'
import { api } from './api'
import { setActiveDuel } from './activeDuel'
import { UserIcon } from './icons'
import { useI18n } from './i18n'
import { useHref, useNavigate } from './router'

const COLUMNS = { 1: 'duel.colSolo', 2: 'duel.colPairs', 3: 'duel.colTrios' } as const

const pips = (count: number) =>
  Array.from({ length: count }, (_, spot) => (
    <i key={spot}>
      <UserIcon />
    </i>
  ))

export default function DuelFormat() {
  const { t, error: errorText } = useI18n()
  const href = useHref()
  const navigate = useNavigate()
  const [per, setPer] = useState(1)
  const [teams, setTeams] = useState(2)
  const [busy, setBusy] = useState(false)
  const [slip, setSlip] = useState<string | null>(null)

  const go = async () => {
    if (busy) return
    setBusy(true)
    setSlip(null)
    const { ok, data } = await api<{ duel?: { code: string }; error?: string }>('duel', { action: 'create' })
    if (!ok || !data.duel) {
      setBusy(false)
      setSlip(data.error ?? 'server')
      return
    }
    const code = data.duel.code
    setActiveDuel(code)

    const state = await api<{ duel?: { game?: string | null; mode?: string | null } }>('duel', { code, action: 'state' }).catch(() => null)
    const game = state?.data.duel?.game ?? 'naruto'
    const was = state?.data.duel?.mode ?? 'classic'
    const mode = per > 1 && !TEAM_MODES.includes(was as never) ? 'who' : was
    await api('duel', { code, action: 'setup', game, mode, per, teams }).catch(() => null)

    navigate.replace(href.duel(code))
  }

  return (
    <div className="duel-format">
      <header className="duel-top">
        <div className="duel-top-name">
          <BackButton href={href.home} fixed>
              {t('play.back')}
            </BackButton>
          <h1>{t('duel.sizeTitle')}</h1>
          <p className="duel-format-hint">{t('duel.sizeHint')}</p>
        </div>
      </header>

      <div className="duel-matrix">
        <span className="duel-matrix-corner" aria-hidden />
        {DUEL_TEAM_SIZES.map((size) => (
          <span key={`head-${size}`} className="duel-matrix-col">
            {t(COLUMNS[size as 1 | 2 | 3])}
          </span>
        ))}

        {DUEL_TEAM_COUNTS.map((count) => (
          <Fragment key={count}>
            <span className="duel-matrix-side">
              <b>{t(count === 2 ? 'duel.sides2' : 'duel.sides3')}</b>
              <em>{t(count === 2 ? 'duel.sides2Hint' : 'duel.sides3Hint')}</em>
            </span>
            {DUEL_TEAM_SIZES.map((size) => (
              <button
                key={`${size}-${count}`}
                type="button"
                className={`duel-format-card ${per === size && teams === count ? 'on' : ''}`}
                style={{ '--cols': count * (size === 3 ? 2 : size), '--sides': count } as CSSProperties}
                disabled={busy}
                onClick={() => {
                  setPer(size)
                  setTeams(count)
                }}
              >
                <span className="duel-format-name">
                  <b>{Array.from({ length: count }, () => size).join(' × ')}</b>
                  <em>{t('duel.sizeTotal', { count: size * count })}</em>
                </span>
                <span className="duel-pips" aria-hidden>
                  {Array.from({ length: count }, (_, line) => (
                    <Fragment key={line}>
                      {line > 0 && <em className="duel-pip-vs">vs</em>}
                      <span className={`duel-pip-set is-${size}`}>{pips(size)}</span>
                    </Fragment>
                  ))}
                </span>
              </button>
            ))}
          </Fragment>
        ))}
      </div>

      {slip && <p className="duel-format-slip">{errorText(slip)}</p>}

      <footer className="duel-bar duel-format-bar">
        <span className="duel-format-pick">
          <b>{Array.from({ length: teams }, () => per).join(' × ')}</b>
          <span>
            <strong>{t('duel.sizeTotal', { count: per * teams })}</strong>
            <em>{t('duel.sizeSum', { sides: teams, per })}</em>
          </span>
          <button type="button" className="primary big" disabled={busy} onClick={() => void go()}>
            {t('duel.sizeGo')}
          </button>
        </span>
      </footer>
    </div>
  )
}
