import BackButton from './BackButton'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import AbilityIcon from './AbilityIcon'
import { ZOOM_LEVELS } from './zoom'
import CharacterSearch from './CharacterSearch'
import GuessGrid from './GuessGrid'
import PlayPanel from './PlayPanel'
import Thumb from './Thumb'
import ZoomImage from './ZoomImage'
import { gameById } from './games'
import type { GameId } from './games/types'
import { useI18n } from './i18n'
import { MODES } from './modes'
import { useHref } from './router'
import { useDuel } from './useDuel'
import DuelSetup from './DuelSetup'
import type { Guess } from './useRound'
import { SwordsIcon } from './icons'
import { fullUrl } from './pics'
import { apiSrc } from './api'
import { useEntities } from './entities'


const clock = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

export default function DuelRoom({ code }: { code: string }) {
  const { t, l, name, lang, error: errorText } = useI18n()
  const href = useHref()
  const { duel, error, busy, pending, serverNow, ready, setup, invite, next, toLobby, giveUp, guess, refresh } = useDuel(code)
  const [, redraw] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => redraw((n) => n + 1), 500)
    return () => clearInterval(timer)
  }, [])

  const game = duel?.game ? gameById(duel.game as GameId) : null
  const loaded = useEntities(game)
  const byId = useMemo(() => new Map((game?.entities ?? []).map((e) => [e.id, e])), [game, game?.entities, loaded])

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
        <BackButton href={href.home}>{t('play.back')}</BackButton>
        <div className="card round-status error">
          <span>{errorText(error)}</span>
          <button className="ghost" onClick={refresh}>
            {t('play.retry')}
          </button>
        </div>
      </div>
    )
  }

  if (!duel) return <div className="card center muted">{t('loading')}</div>

  const you = duel.you
  const rival = duel.rival
  const inLobby = duel.status === 'lobby'
  const over = duel.status === 'finished'
  const link = `${window.location.origin}/${href.duel(duel.code)}`
  const answer = duel.answerId !== undefined ? byId.get(duel.answerId) : undefined
  const wrong = guesses.filter((g) => !g.pending).length - (you?.solved ? 1 : 0)
  const zoom = over || you?.solved ? 1 : ZOOM_LEVELS[Math.min(wrong, ZOOM_LEVELS.length - 1)]
  const left = duel.endsAt ? duel.endsAt - serverNow() : 0
  const youDone = Boolean(you?.solved || you?.gaveUp)
  const modeLabel = duel.mode ? t(MODES.find((m) => m.id === duel.mode)?.label ?? 'mode.classic') : null

  return (
    <div className="duel">
      <BackButton href={href.home}>{t('play.back')}</BackButton>

      {!inLobby && (
        <>
      <header className="duel-head card" style={{ '--tab-accent': game?.accent ?? 'var(--accent)' } as CSSProperties}>
        <div>
          <h1>
            <SwordsIcon /> {game ? `${l(game.label)} · ${modeLabel}` : t('duel.room')}
          </h1>
          <p className="muted">
            {t('duel.code', { code: duel.code })}
            {duel.round > 0 ? ` · ${t('duel.roundNo', { round: duel.round })}` : ''}
          </p>
        </div>
        {duel.status === 'playing' && duel.seconds > 0 && <div className={`duel-timer ${left < 60000 ? 'hot' : ''}`}>{clock(left)}</div>}
      </header>

      <section className="duel-players card">
        <div className={`duel-player ${you?.solved ? 'solved' : ''}`}>
          <b>{you?.nickname}</b>
          <span className="muted">
            {inLobby
              ? you?.ready
                ? t('duel.isReady')
                : t('duel.notReady')
              : t('duel.guesses', { count: guesses.filter((g) => !g.pending).length })}
            {!inLobby && you?.solved ? ` · ${t('duel.solved')}` : !inLobby && you?.gaveUp ? ` · ${t('duel.gaveUp')}` : ''}
          </span>
        </div>
        <span className="duel-vs">{duel.round > 0 ? `${you?.wins ?? 0} : ${rival?.wins ?? 0}` : 'VS'}</span>
        {rival ? (
          <div className={`duel-player ${rival.solved ? 'solved' : ''}`}>
            <b>{rival.nickname}</b>
            <span className="muted">
              {inLobby
                ? rival.ready
                  ? t('duel.isReady')
                  : t('duel.notReady')
                : t('duel.guesses', { count: rival.guessCount })}
              {!inLobby && rival.solved ? ` · ${t('duel.solved')}` : !inLobby && rival.gaveUp ? ` · ${t('duel.gaveUp')}` : ''}
            </span>
          </div>
        ) : (
          <div className="duel-player empty">{t('duel.waitingRival')}</div>
        )}
      </section>
        </>
      )}

      {inLobby && (
        <DuelSetup duel={duel} busy={busy} link={link} onSetup={setup} onInvite={invite} onReady={ready} />
      )}

      {!inLobby && game && (
        <section className={`play-layout ${duel.mode === 'image' ? 'shot-layout' : duel.mode === 'ability' ? 'ability-layout' : ''}`}>
          {duel.mode === 'image' && (
            <div className="shot-column">
              <div className="shot">
                <ZoomImage game={game} src={apiSrc(duel.image)} zoom={zoom} resetKey={`${duel.code}-${duel.round}`} />
              </div>
            </div>
          )}

          {duel.mode === 'ability' && (
            <div className="shot-column ability-column">
              <div className={`ability-stage ${over ? (duel.youWon ? 'won' : 'lost') : ''}`}>
                <span className="ability-glow" aria-hidden />
                <AbilityIcon
                  className="ability-art"
                  src={duel.image ? `${apiSrc(duel.image)}&v=${over ? 'done' : wrong}` : undefined}
                  resetKey={`${duel.code}-${duel.round}`}
                />
              </div>
            </div>
          )}

          <div className="play-main">
            {!over &&
              !youDone &&
              (duel.mode === 'classic' ? (
                <PlayPanel
                  media={
                    <span className="play-mystery" aria-hidden>
                      ?
                    </span>
                  }
                  title={t('play.classicTitle')}
                  hint={t('duel.hurry')}
                >
                  <CharacterSearch game={game} exclude={new Set(guesses.map((g) => g.entity.id))} busy={busy} onPick={guess} />
                </PlayPanel>
              ) : (
                <>
                  <div className="play-card shot-copy">
                    <h2>{t(duel.mode === 'ability' ? 'play.abilityTitle' : 'play.imageTitle')}</h2>
                    <p>{t('duel.hurry')}</p>
                  </div>
                  <CharacterSearch game={game} exclude={new Set(guesses.map((g) => g.entity.id))} busy={busy} onPick={guess} compact />
                </>
              ))}

            {duel.ability && (
              <p className="ability-hint">
                {t(over ? 'ability.was' : 'ability.hint')} <b>{duel.ability[lang]}</b>
              </p>
            )}

            {!over && !youDone && (
              <button className="link-button" onClick={giveUp} disabled={busy}>
                {t('play.giveUp')}
              </button>
            )}

            {!over && youDone && <div className="card round-status muted">{you?.solved ? t('duel.waitRival') : t('duel.gaveUpWait')}</div>}

            {over && answer && (
              <div className={`card result ${duel.youWon ? 'won' : duel.winner === null ? 'skipped' : 'lost'}`}>
                <h2>
                  {duel.matchDone
                    ? duel.youWon
                      ? t('duel.matchWon')
                      : t('duel.matchLost', { name: duel.winner ?? '' })
                    : duel.youWon
                      ? t('duel.youWon')
                      : duel.winner
                        ? t('duel.youLost', { name: duel.winner })
                        : t('duel.draw')}
                </h2>
                <p className="duel-score">{t('duel.score', { you: you?.wins ?? 0, rival: rival?.wins ?? 0 })}</p>
                <img className="result-image" src={fullUrl(game.id, answer.id, answer.image)} alt={name(answer)} />
                <div className="result-name">{name(answer)}</div>
                <p className="round">
                  {you?.nickname}: {t('duel.guesses', { count: you?.guesses.length ?? 0 })}
                  {rival ? ` · ${rival.nickname}: ${t('duel.guesses', { count: rival.guessCount })}` : ''}
                </p>
                <div className="result-actions">
                  {duel.matchDone ? (
                    <button className="primary" onClick={toLobby} disabled={busy}>
                      {t('duel.rematch')}
                    </button>
                  ) : (
                    <>
                      <button className="primary" onClick={next} disabled={busy || you?.wantsNext}>
                        {you?.wantsNext ? t('duel.nextWait') : t('duel.next')}
                      </button>
                      <button className="ghost" onClick={toLobby} disabled={busy}>
                        {t('duel.toLobby')}
                      </button>
                    </>
                  )}
                </div>
                {rival?.wantsNext && !you?.wantsNext && <p className="muted small">{t('duel.rivalWantsNext', { name: rival.nickname })}</p>}
              </div>
            )}

            {duel.mode === 'classic' ? (
              <GuessGrid game={game} guesses={guesses} answerId={duel.answerId} />
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
          </div>

          <aside className="play-side duel-side" />
        </section>
      )}
    </div>
  )
}
