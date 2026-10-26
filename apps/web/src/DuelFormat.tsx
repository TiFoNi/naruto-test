'use client'

import { Fragment, useState, type CSSProperties } from 'react'
import { DUEL_TEAM_COUNTS, TEAM_MODES } from '@nanda/game'
import BackButton from './BackButton'
import { api } from './api'
import { setActiveDuel } from './activeDuel'
import { UserIcon } from './icons'
import { useI18n } from './i18n'
import { useHref, useNavigate } from './router'

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
  const [per, setPer] = useState(0)
  const [teams, setTeams] = useState(0)
  const [busy, setBusy] = useState(false)
  const [slip, setSlip] = useState<string | null>(null)

  const go = async (size: number, count: number) => {
    if (busy) return
    setPer(size)
    setTeams(count)
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
    const mode = count > 2 && !TEAM_MODES.includes(was as never) ? 'classic' : was
    await api('duel', { code, action: 'setup', game, mode, per: size, teams: count }).catch(() => null)

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

      <div className="duel-matrix is-solo">
        {DUEL_TEAM_COUNTS.map((count) => (
          <button
            key={count}
            type="button"
            className={`duel-format-card ${per === 1 && teams === count ? 'on' : ''}`}
            style={{ '--cols': count, '--sides': count } as CSSProperties}
            disabled={busy}
            onClick={() => void go(1, count)}
          >
            <span className="duel-format-name">
              <b>{Array.from({ length: count }, () => 1).join(' × ')}</b>
              <em>{t('duel.sizeTotal', { count })}</em>
            </span>
            <span className="duel-pips" aria-hidden>
              {Array.from({ length: count }, (_, line) => (
                <Fragment key={line}>
                  {line > 0 && <em className="duel-pip-vs">vs</em>}
                  <span className="duel-pip-set is-1">{pips(1)}</span>
                </Fragment>
              ))}
            </span>
          </button>
        ))}
      </div>

      {slip && <p className="duel-format-slip">{errorText(slip)}</p>}
    </div>
  )
}
