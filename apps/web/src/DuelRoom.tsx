import BackButton from './BackButton'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import AbilityIcon from './AbilityIcon'
import { ABILITY_STAGES } from '@nanda/game'
import { ZOOM_LEVELS, levelAt } from './zoom'
import CharacterSearch from './CharacterSearch'
import GuessGrid from './GuessGrid'
import PlayPanel from './PlayPanel'
import Thumb from './Thumb'
import ZoomImage from './ZoomImage'
import { gameById } from './games'
import type { GameId } from './games/types'
import { useI18n } from './i18n'
import { MODES } from './modes'
import { useHref, useNavigate } from './router'
import { useDuel } from './useDuel'
import DuelSetup from './DuelSetup'
import type { Guess } from './useRound'
import { ExitIcon, SwordsIcon } from './icons'
import { fullUrl } from './pics'
import { api, apiSrc } from './api'
import { useEntities } from './entities'


const clarity = (step: number) => Math.round((step / ABILITY_STAGES) * 100)

const clock = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

export default function DuelRoom({ code }: { code: string }) {
  const { t, l, name, lang, error: errorText } = useI18n()
  const href = useHref()
  const navigate = useNavigate()
  const { duel, error, busy, pending, serverNow, ready, setup, invite, next, toLobby, giveUp, guess, refresh } = useDuel(code)
  const [, redraw] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => redraw((n) => n + 1), 500)
    return () => clearInterval(timer)
  }, [])

  const leave = async () => {
    await api('duel', { code, action: 'leave' }).catch(() => null)
    navigate(href.home)
  }

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
  const youDone = Boolean(you?.solved || you?.gaveUp)
  const wrong = guesses.filter((g) => !g.pending).length - (you?.solved ? 1 : 0)
  const zoomStep = Math.min(wrong, ZOOM_LEVELS.length - 1)
  const revealed = over || youDone
  const zoom = revealed ? 1 : ZOOM_LEVELS[zoomStep]
  const shownStep = revealed ? ZOOM_LEVELS.length - 1 : zoomStep
  const nextZoom = shownStep < ZOOM_LEVELS.length - 1 ? ZOOM_LEVELS[shownStep + 1] : null
  const zoomText = (value: number) => (lang === 'en' ? value.toFixed(1) : value.toFixed(1).replace('.', ','))
  const clarityStep = revealed ? ABILITY_STAGES : Math.min(wrong, ABILITY_STAGES)
  const left = duel.endsAt ? duel.endsAt - serverNow() : 0
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
        <div className="duel-head-side">
          {duel.status === 'playing' && duel.seconds > 0 && <div className={`duel-timer ${left < 60000 ? 'hot' : ''}`}>{clock(left)}</div>}
          <button type="button" className="duel-leave" onClick={() => void leave()} disabled={busy}>
            <ExitIcon />
            {t('duel.leave')}
          </button>
        </div>
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
        <DuelSetup duel={duel} busy={busy} link={link} onSetup={setup} onInvite={invite} onReady={ready} onLeave={() => void leave()} />
      )}

      {!inLobby && game && (
        <section className={`play-layout ${duel.mode === 'image' ? 'shot-layout' : duel.mode === 'ability' ? 'ability-layout' : ''}`}>
          {duel.mode === 'image' && (
            <div className="shot-column">
              <div className="shot">
                <ZoomImage game={game} src={apiSrc(duel.image)} zoom={zoom} resetKey={`${duel.code}-${duel.round}`} />
              </div>

              <div className="play-card zoom-scale">
                <div className="zoom-scale-head">
                  <span className="play-card-title">{t('play.zoomTitle')}</span>
                  <span>{nextZoom ? t('play.zoomNext', { zoom: zoomText(nextZoom) }) : t('play.zoomFull')}</span>
                </div>
                <div className="zoom-steps">
                  {ZOOM_LEVELS.map((level, i) => (
                    <span key={level} className={i === shownStep ? 'now' : i < shownStep ? 'past' : ''}>
                      <i />
                      <b>×{zoomText(level)}</b>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {duel.mode === 'ability' && (
            <div className="shot-column ability-column">
              <div className={`ability-stage ${over ? (duel.youWon ? 'won' : 'lost') : ''}`}>
                <span className="ability-glow" aria-hidden />
                <AbilityIcon
                  className="ability-art"
                  src={duel.image ? `${apiSrc(duel.image)}&v=${revealed ? 'done' : wrong}` : undefined}
                  resetKey={`${duel.code}-${duel.round}`}
                />
              </div>

              <div className="play-card zoom-scale">
                <div className="zoom-scale-head">
                  <span className="play-card-title">{t('ability.scaleTitle')}</span>
                  <span>
                    {clarityStep < ABILITY_STAGES
                      ? t('ability.nextClarity', { clarity: clarity(clarityStep + 1) })
                      : t('ability.fullClarity')}
                  </span>
                </div>
                <div className="zoom-steps clarity-steps" style={{ ['--steps' as string]: ABILITY_STAGES + 1 }}>
                  {Array.from({ length: ABILITY_STAGES + 1 }, (_, i) => (
                    <span key={i} className={i === clarityStep ? 'now' : i < clarityStep ? 'past' : ''}>
                      <i />
                      <b>{clarity(i)}%</b>
                    </span>
                  ))}
                </div>
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
                {t(revealed ? 'ability.was' : 'ability.hint')} <b>{duel.ability[lang]}</b>
              </p>
            )}

            {!over && !youDone && (
              <button className="link-button" onClick={giveUp} disabled={busy}>
                {t('play.giveUp')}
              </button>
            )}

            {(over || youDone) && answer && (
              <div className={`card result ${!over ? 'skipped' : duel.youWon ? 'won' : duel.winner === null ? 'skipped' : 'lost'}`}>
                <h2>
                  {!over
                    ? you?.solved
                      ? t('duel.waitRival')
                      : t('duel.gaveUpWait')
                    : duel.matchDone
                      ? duel.youWon
                        ? t('duel.matchWon')
                        : t('duel.matchLost', { name: duel.winner ?? '' })
                      : duel.youWon
                        ? t('duel.youWon')
                        : duel.winner
                          ? t('duel.youLost', { name: duel.winner })
                          : t('duel.draw')}
                </h2>
                <p className="duel-score">
                  {t('duel.score', { you: you?.wins ?? 0, rival: rival?.wins ?? 0 })}
                  {!duel.matchDone && <span> · {t('duel.roundOf', { round: duel.round, best: duel.best })}</span>}
                </p>
                <img className="result-image" src={fullUrl(game.id, answer.id, answer.image)} alt={name(answer)} />
                <div className="result-name">{name(answer)}</div>
                <p className="round">
                  {you?.nickname}: {t('duel.guesses', { count: you?.guesses.length ?? 0 })}
                  {rival ? ` · ${rival.nickname}: ${t('duel.guesses', { count: rival.guessCount })}` : ''}
                </p>
                {over && <div className="result-actions">
                  {duel.matchDone ? (
                    <button className="primary" onClick={toLobby} disabled={busy}>
                      {t('duel.toLobby')}
                    </button>
                  ) : (
                    <button className="primary" onClick={next} disabled={busy || you?.wantsNext}>
                      {you?.wantsNext ? t('duel.nextWait') : t('duel.next')}
                    </button>
                  )}
                </div>}
                {rival?.wantsNext && !you?.wantsNext && <p className="muted small">{t('duel.rivalWantsNext', { name: rival.nickname })}</p>}
              </div>
            )}

            {duel.mode === 'classic' ? (
              <GuessGrid game={game} guesses={guesses} answerId={duel.answerId} />
            ) : (
              <div className="tries">
                <span className="play-card-title">{t('play.tries')}</span>
                {guesses.length === 0 ? (
                  <p className="tries-empty">{t(over ? 'play.noTriesOver' : 'play.noTries')}</p>
                ) : (
                  <div className="tries-list">
                    {guesses.map(({ entity: g, pending: p }, i) => {
                      const hit = g.id === duel.answerId
                      const before = guesses.slice(i + 1).filter((x) => !x.pending && x.entity.id !== duel.answerId).length
                      return (
                        <div key={g.id} className={`try ${p ? 'pending' : hit ? 'hit' : 'miss'}`}>
                          <Thumb game={game} entity={g} size={36} />
                          <span className="try-name">{name(g)}</span>
                          <span className="try-zoom">
                            {duel.mode === 'ability'
                              ? `${clarity(Math.min(before, ABILITY_STAGES))}%`
                              : `×${zoomText(levelAt(guesses.length - 1 - i))}`}
                          </span>
                          {!p && <span className="try-verdict">{t(hit ? 'play.hit' : 'play.miss')}</span>}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <aside className="play-side duel-side" />
        </section>
      )}
    </div>
  )
}
