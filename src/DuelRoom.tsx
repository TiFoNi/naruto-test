import { useEffect, useMemo, useState } from 'react'
import AbilityIcon from './AbilityIcon'
import CharacterSearch from './CharacterSearch'
import GuessGrid, { Legend } from './GuessGrid'
import Thumb from './Thumb'
import ZoomImage from './ZoomImage'
import { gameById } from './games'
import type { GameId } from './games/types'
import { useI18n } from './i18n'
import { href } from './router'
import { useDuel } from './useDuel'
import type { Guess } from './useRound'

const ZOOM_LEVELS = [7, 5.6, 4.5, 3.6, 2.9, 2.35, 1.9, 1.55, 1.25, 1]

const clock = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

export default function DuelRoom({ code }: { code: string }) {
  const { t, l, name, lang, error: errorText } = useI18n()
  const { duel, error, busy, pending, serverNow, ready, giveUp, guess, refresh } = useDuel(code)
  const [copied, setCopied] = useState(false)
  const [, tick] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => tick((n) => n + 1), 500)
    return () => clearInterval(timer)
  }, [])

  const game = duel ? gameById(duel.game as GameId) : null
  const byId = useMemo(() => new Map((game?.entities ?? []).map((e) => [e.id, e])), [game])

  const guesses: Guess[] = useMemo(() => {
    const done = (duel?.you?.guesses ?? [])
      .map((g) => ({ entity: byId.get(g.id)!, judgement: g.judgement }))
      .filter((g) => g.entity)
      .reverse()
    return pending && !done.some((g) => g.entity.id === pending.id) ? [{ entity: pending, pending: true }, ...done] : done
  }, [duel, byId, pending])

  if (error && !duel) {
    return (
      <div className="duel">
        <a className="back" href={href.duels}>
          {t('duel.back')}
        </a>
        <div className="card round-status error">
          <span>{errorText(error)}</span>
          <button className="ghost" onClick={refresh}>
            {t('play.retry')}
          </button>
        </div>
      </div>
    )
  }

  if (!duel || !game) return <div className="card center muted">{t('loading')}</div>

  const link = `${window.location.origin}/${href.duel(duel.code)}`
  const you = duel.you
  const rival = duel.rival
  const over = duel.status === 'finished'
  const answer = duel.answerId !== undefined ? byId.get(duel.answerId) : undefined
  const wrong = guesses.filter((g) => !g.pending).length - (you?.solved ? 1 : 0)
  const zoom = over || you?.solved ? 1 : ZOOM_LEVELS[Math.min(wrong, ZOOM_LEVELS.length - 1)]
  const left = duel.endsAt ? duel.endsAt - serverNow() : 0
  const youDone = Boolean(you?.solved || you?.gaveUp)

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
    <div className="duel">
      <a className="back" href={href.duels}>
        {t('duel.back')}
      </a>

      <header className="duel-head card" style={{ '--tab-accent': game.accent } as React.CSSProperties}>
        <div>
          <h1>
            ⚔️ {l(game.label)} · {t(`mode.${duel.mode}` as 'mode.classic')}
          </h1>
          <p className="muted">{t('duel.code', { code: duel.code })}</p>
        </div>
        {duel.status === 'playing' && <div className={`duel-timer ${left < 60000 ? 'hot' : ''}`}>{clock(left)}</div>}
      </header>

      <section className="duel-players card">
        <div className={`duel-player ${you?.solved ? 'solved' : ''}`}>
          <b>{you?.nickname}</b>
          <span className="muted">
            {t('duel.guesses', { count: guesses.filter((g) => !g.pending).length })}
            {you?.solved ? ` · ${t('duel.solved')}` : you?.gaveUp ? ` · ${t('duel.gaveUp')}` : ''}
          </span>
        </div>
        <span className="duel-vs">VS</span>
        {rival ? (
          <div className={`duel-player ${rival.solved ? 'solved' : ''}`}>
            <b>{rival.nickname}</b>
            <span className="muted">
              {t('duel.guesses', { count: rival.guessCount })}
              {rival.solved ? ` · ${t('duel.solved')}` : rival.gaveUp ? ` · ${t('duel.gaveUp')}` : duel.status === 'waiting' && rival.ready ? ` · ${t('duel.isReady')}` : ''}
            </span>
          </div>
        ) : (
          <div className="duel-player empty">{t('duel.waitingRival')}</div>
        )}
      </section>

      {duel.status === 'waiting' && (
        <section className="card duel-invite">
          <h2>{t('duel.inviteTitle')}</h2>
          <p className="muted">{t('duel.inviteHint')}</p>
          <div className="inline-field">
            <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
            <button className="primary" onClick={copy}>
              {copied ? t('duel.copied') : t('duel.copy')}
            </button>
          </div>
          <button className="primary big" onClick={ready} disabled={busy || you?.ready}>
            {you?.ready ? t('duel.readyWait') : t('duel.ready')}
          </button>
        </section>
      )}

      {duel.status !== 'waiting' && (
        <section className="mode">
          <div className="card intro">
            <h2>{t(duel.mode === 'ability' ? 'play.abilityTitle' : duel.mode === 'image' ? 'play.imageTitle' : 'play.classicTitle')}</h2>
            {duel.mode === 'image' && <ZoomImage game={game} src={duel.image} zoom={zoom} resetKey={duel.code} />}
            {duel.mode === 'ability' && <AbilityIcon src={duel.image ? `${duel.image}&v=${over ? 'done' : wrong}` : undefined} resetKey={duel.code} />}
            {duel.ability && (
              <p className="ability-hint">
                {t(over ? 'ability.was' : 'ability.hint')} <b>{duel.ability[lang]}</b>
              </p>
            )}
            {duel.status === 'playing' && !youDone && <p className="round">{t('duel.hurry')}</p>}
          </div>

          {over && answer ? (
            <div className={`card result ${duel.youWon ? 'won' : duel.winner === null ? 'skipped' : 'lost'}`}>
              <h2>{duel.youWon ? t('duel.youWon') : duel.winner ? t('duel.youLost', { name: duel.winner }) : t('duel.draw')}</h2>
              <img className="result-image" src={game.fullUrl(answer)} alt={name(answer)} />
              <div className="result-name">{name(answer)}</div>
              <p className="round">
                {you?.nickname}: {t('duel.guesses', { count: you?.guesses.length ?? 0 })}
                {rival ? ` · ${rival.nickname}: ${t('duel.guesses', { count: rival.guessCount })}` : ''}
              </p>
              <a className="primary" href={href.duels}>
                {t('duel.newDuel')}
              </a>
            </div>
          ) : youDone ? (
            <div className="card round-status muted">{you?.solved ? t('duel.waitRival') : t('duel.gaveUpWait')}</div>
          ) : (
            <>
              <CharacterSearch
                game={game}
                exclude={new Set(guesses.map((g) => g.entity.id))}
                active
                busy={busy}
                onPick={guess}
              />
              <button className="link-button" onClick={giveUp} disabled={busy}>
                {t('play.giveUp')}
              </button>
            </>
          )}

          {duel.mode === 'classic' ? (
            <>
              <GuessGrid game={game} guesses={guesses} />
              <Legend game={game} />
            </>
          ) : (
            <div className="guess-list">
              {guesses.map(({ entity: g, pending: p }) => (
                <div key={g.id} className={`guess-chip ${p ? 'pending' : you?.solved && g.id === answer?.id ? 'correct' : 'wrong'}`}>
                  <Thumb game={game} entity={g} size={44} />
                  <span>{name(g)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
