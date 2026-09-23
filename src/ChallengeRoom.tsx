import { useEffect, useState, type CSSProperties } from 'react'
import AbilityMode from './AbilityMode'
import ClassicMode from './ClassicMode'
import ImageMode from './ImageMode'
import PageMode from './PageMode'
import Thumb from './Thumb'
import { api } from './api'
import { useAuth } from './auth'
import { gameById } from './games'
import type { GameId } from './games/types'
import { useI18n } from './i18n'
import { MODES, type ModeId } from './modes'
import { href } from './router'
import { emptyStats } from './stats'

type Challenge = {
  code: string
  game: GameId
  mode: ModeId
  author: string
  mine: boolean
  answerId?: number
  solves: { nickname: string; guesses: number; solved: boolean }[]
}

export default function ChallengeRoom({ code }: { code: string }) {
  const { t, l, name, error: errorText } = useI18n()
  const { user } = useAuth()
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    api<{ challenge?: Challenge; error?: string }>('challenge', { action: 'view', code })
      .then(({ ok, data }) => {
        if (cancelled) return
        if (ok && data.challenge) setChallenge(data.challenge)
        else setError(data.error ?? 'server')
      })
      .catch(() => !cancelled && setError('network'))
    return () => {
      cancelled = true
    }
  }, [code])

  if (error) {
    return (
      <div className="challenge">
        <a className="back" href={href.home}>
          {t('play.back')}
        </a>
        <div className="card round-status error">{errorText(error)}</div>
      </div>
    )
  }
  if (!challenge || !user) return <div className="card center muted">{t('loading')}</div>

  const game = gameById(challenge.game)
  const mode = challenge.mode
  const modeLabel = t(MODES.find((m) => m.id === mode)?.label ?? 'mode.classic')
  const props = { game, active: true, stats: emptyStats, challenge: code }
  const answer = challenge.answerId !== undefined ? game.entities.find((e) => e.id === challenge.answerId) : undefined
  const link = `${window.location.origin}/${href.challenge(code)}`

  const copy = () => {
    navigator.clipboard?.writeText(link).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      },
      () => setCopied(false),
    )
  }

  return (
    <div className="challenge" style={{ '--tab-accent': game.accent } as CSSProperties}>
      <a className="back" href={href.home}>
        {t('play.back')}
      </a>

      <header className="card challenge-head">
        <h1>{challenge.mine ? t('challenge.yours') : t('challenge.from', { name: challenge.author })}</h1>
        <p className="muted">
          {l(game.label)} · {modeLabel}
        </p>
        {challenge.solves.length > 0 ? (
          <ul className="challenge-solves">
            {challenge.solves.map((s, i) => (
              <li key={`${s.nickname}-${i}`}>
                <b>{s.nickname}</b>
                <span>{s.solved ? t('challenge.solvedIn', { guesses: s.guesses }) : t('challenge.gaveUp')}</span>
              </li>
            ))}
          </ul>
        ) : (
          challenge.mine && <p className="muted challenge-empty">{t('challenge.noSolves')}</p>
        )}
      </header>

      {challenge.mine ? (
        <section className="card challenge-mine">
          {answer && (
            <div className="challenge-answer">
              <Thumb game={game} entity={answer} size={64} />
              <div>
                <span className="muted">{t('challenge.hiddenIs')}</span>
                <b>{name(answer)}</b>
              </div>
            </div>
          )}
          <p className="muted">{t('challenge.mineHint')}</p>
          <div className="inline-field">
            <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
            <button className="primary" onClick={copy}>
              {copied ? t('duel.copied') : t('duel.copy')}
            </button>
          </div>
        </section>
      ) : mode === 'classic' ? (
        <ClassicMode {...props} />
      ) : mode === 'image' ? (
        <ImageMode {...props} />
      ) : mode === 'page' ? (
        <PageMode {...props} />
      ) : (
        <AbilityMode {...props} />
      )}
    </div>
  )
}
