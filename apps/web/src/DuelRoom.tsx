'use client'

import BackButton from './BackButton'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import AbilityIcon from './AbilityIcon'
import { ABILITY_STAGES, GRID_MISSES, PHRASE_VOICE_AT } from '@nanda/game'
import { ZOOM_LEVELS, levelAt } from './zoom'
import CharacterSearch from './CharacterSearch'
import GiveUp from './GiveUp'
import GuessGrid from './GuessGrid'
import MangaStage, { MangaOptions } from './MangaStage'
import PhraseColumn from './PhraseColumn'
import RivalBoard from './RivalBoard'
import PlayBoard, { AskCard } from './PlayBoard'
import PlayPanel from './PlayPanel'
import TriesList from './TriesList'
import ZoomScale from './ZoomScale'
import ZoomImage from './ZoomImage'
import WhoBoard from './WhoBoard'
import { gameById } from './games'
import type { GameId } from './games/types'
import { useI18n } from './i18n'
import { MODES } from './modes'
import { setActiveDuel } from './activeDuel'
import { useHref, useNavigate } from './router'
import { useDuel } from './useDuel'
import DuelSetup from './DuelSetup'
import DuelSkeleton from './DuelSkeleton'
import GridBoard from './GridBoard'
import type { Guess } from './useRound'
import { ExitIcon, SwordsIcon, TrophyIcon } from './icons'
import { fullUrl } from './pics'
import { api, apiSrc } from './api'
import { useEntities } from './entities'


const clarity = (step: number) => Math.round((step / ABILITY_STAGES) * 100)

const clock = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

export default function DuelRoom({ code, onRestart }: { code: string; onRestart?: () => void }) {
  const { t, l, name, lang, error: errorText } = useI18n()
  const href = useHref()
  const navigate = useNavigate()
  const { duel, error, busy, pending, serverNow, ready, setup, invite, next, toLobby, giveUp, guess, pick, pass, mark, strike, answer: markAnswer, refresh } = useDuel(code)
  const [, redraw] = useState(0)
  const [pageReady, setPageReady] = useState(false)
  const [showResult, setShowResult] = useState(true)

  useEffect(() => {
    const timer = setInterval(() => redraw((n) => n + 1), 500)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (duel?.matchDone) setShowResult(true)
  }, [duel?.matchDone, duel?.round])

  useEffect(() => {
    if (!duel?.you) return
    if (duel.bot) setActiveDuel(null)
    else setActiveDuel(code)
  }, [code, duel?.bot, duel?.you])

  useEffect(() => {
    if (!duel) return
    const shape = duel.status === 'lobby' ? 'lobby' : 'play'
    document.documentElement.dataset.duel = shape
    try {
      sessionStorage.setItem(`nanda.duel.${code}`, shape)
    } catch {
      /* приватний режим — обійдемося без підказки при перезавантаженні */
    }
  }, [code, duel?.status])

  useEffect(
    () => () => {
      delete document.documentElement.dataset.duel
    },
    [],
  )

  const leave = async () => {
    setActiveDuel(null)
    await api('duel', { code, action: 'leave' }).catch(() => null)
    navigate(href.home)
  }

  const solo = Boolean(duel?.bot)

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

  if (!duel) return <DuelSkeleton />

  const you = duel.you
  const rival = duel.rival
  const inLobby = duel.status === 'lobby'
  const over = duel.status === 'finished'
  const link = `${window.location.origin}${href.duel(duel.code)}`
  const answer = duel.answerId !== undefined ? byId.get(duel.answerId) : undefined
  const youDone = Boolean(you?.solved || you?.gaveUp)
  const wrong = guesses.filter((g) => !g.pending).length - (you?.solved ? 1 : 0)
  const zoomStep = Math.min(wrong, ZOOM_LEVELS.length - 1)
  const revealed = over || youDone
  const shownStep = revealed ? ZOOM_LEVELS.length - 1 : zoomStep
  const nextZoom = shownStep < ZOOM_LEVELS.length - 1 ? ZOOM_LEVELS[shownStep + 1] : null
  const zoomText = (value: number) => (lang === 'en' ? value.toFixed(1) : value.toFixed(1).replace('.', ','))
  const clarityStep = revealed ? ABILITY_STAGES : Math.min(wrong, ABILITY_STAGES)
  const left = duel.endsAt ? duel.endsAt - serverNow() : 0
  const modeLabel = duel.mode ? t(MODES.find((m) => m.id === duel.mode)?.label ?? 'mode.classic') : null

  return (
    <div className="duel">
      {!solo && <BackButton href={href.home}>{t('play.back')}</BackButton>}

      {!inLobby && (
        <>
      <header className="duel-head card" style={{ '--tab-accent': game?.accent ?? 'var(--accent)' } as CSSProperties}>
        <div>
          <h1>
            <SwordsIcon /> {game ? `${l(game.label)} · ${modeLabel}` : t('duel.room')}
          </h1>
          <p className="muted">
            {solo ? t('grid.vsBot') : t('duel.code', { code: duel.code })}
            {!solo && duel.round > 0 ? ` · ${t('duel.roundNo', { round: duel.round })}` : ''}
          </p>
        </div>
        <div className="duel-head-side">
          {duel.status === 'playing' && duel.seconds > 0 && duel.endsAt && <div className={`duel-timer ${left < 60000 ? 'hot' : ''}`}>{clock(left)}</div>}
          {solo ? (
            duel.status === 'playing' && (
              <GiveUp className="duel-leave duel-solo-leave" hint="grid.giveUpHint" disabled={busy} onConfirm={giveUp}>
                <ExitIcon />
                {t('grid.giveUp')}
              </GiveUp>
            )
          ) : (
            <button type="button" className="duel-leave" onClick={() => void leave()} disabled={busy}>
              <ExitIcon />
              {t('duel.leave')}
            </button>
          )}
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
              : duel.mode === 'who'
                ? t('who.cardsLeft', { count: (duel.cards?.length ?? 0) - (duel.struck?.length ?? 0) })
                : duel.mode === 'grid'
                  ? t('grid.misses', { count: duel.you?.guesses.length ?? 0, max: GRID_MISSES })
                  : t('duel.guesses', { count: guesses.filter((g) => !g.pending).length })}
            {!inLobby && you?.solved
              ? ` · ${t('duel.solved')}`
              : !inLobby && you?.gaveUp
                ? ` · ${t(duel.mode === 'who' ? 'who.missed' : 'duel.gaveUp')}`
                : ''}
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
                : duel.mode === 'who'
                  ? t('who.cardsLeft', { count: duel.rivalLeft ?? 0 })
                  : duel.mode === 'grid'
                    ? t('grid.misses', { count: rival.guessCount, max: GRID_MISSES })
                    : t('duel.guesses', { count: rival.guessCount })}
              {!inLobby && rival.solved
                ? ` · ${t('duel.solved')}`
                : !inLobby && rival.gaveUp
                  ? ` · ${t(duel.mode === 'who' ? 'who.missed' : 'duel.gaveUp')}`
                  : ''}
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

      {duel.matchDone && over && showResult && (
        <div className="modal-backdrop" onClick={() => setShowResult(false)} role="presentation">
          <section
            className={`card modal duel-final ${duel.winner ? (duel.youWon ? 'won' : 'lost') : 'drawn'}`}
            role="dialog"
            aria-modal="true"
            aria-label={t('duel.matchOver')}
            onClick={(event) => event.stopPropagation()}
          >
            <span className="duel-final-mark" aria-hidden>
              {duel.youWon ? <TrophyIcon /> : <SwordsIcon />}
            </span>
            <h2>{duel.winner ? (duel.youWon ? t('duel.matchWon') : t('duel.matchLost', { name: duel.winner })) : t('duel.matchDraw')}</h2>
            <p className="duel-final-score">
              <b>{you?.wins ?? 0}</b>
              <span>:</span>
              <b>{rival?.wins ?? 0}</b>
            </p>
            <p className="muted">
              {duel.mode === 'who' && duel.rivalSecret !== undefined
                ? t('who.was', { name: name(byId.get(duel.rivalSecret) ?? { name: '?' }) })
                : `${you?.nickname} · ${rival?.nickname ?? '?'}`}
            </p>
            <div className="duel-final-actions">
              <button
                className="primary"
                onClick={() => {
                  setShowResult(false)
                  if (solo) onRestart?.()
                  else toLobby()
                }}
                disabled={busy}
              >
                {solo ? t('grid.again') : t('duel.toLobby')}
              </button>
              <button className="ghost" onClick={() => void leave()} disabled={busy}>
                {solo ? t('grid.quit') : t('duel.leave')}
              </button>
            </div>
          </section>
        </div>
      )}

      {duel.matchDone && over && !showResult && (
        <div className="card duel-final-again">
          <button className="primary" onClick={() => setShowResult(true)} disabled={busy}>
            {t('duel.showResult')}
          </button>
        </div>
      )}

      {!inLobby && game && duel.mode === 'who' && <WhoBoard
          game={game}
          byId={byId}
          duel={duel}
          busy={busy}
          onPick={pick}
          onPass={pass}
          onStrike={strike}
          onAnswer={markAnswer}
          onNext={next}
        />}

      {!inLobby && game && duel.mode === 'grid' && (
        <GridBoard game={game} byId={byId} duel={duel} busy={busy} error={error} onMark={mark} onNext={next} />
      )}

      {!inLobby && game && duel.mode !== 'who' && duel.mode !== 'grid' && (
        <PlayBoard
          variant={duel.mode === 'image' ? 'shot' : duel.mode === 'ability' ? 'ability' : 'classic'}
          side={
            <aside className="play-side duel-side">
              {duel.mode === 'classic' && duel.rival && <RivalBoard game={game} rows={duel.rival.board ?? []} total={duel.rival.guessCount} />}
            </aside>
          }
          media={
            duel.mode === 'image' ? (
              <div className="shot-column">
                <div className="shot">
                  <ZoomImage game={game} shot={duel.shot} zoom={duel.zoom ?? ZOOM_LEVELS[0]} focus={duel.focus} />
                </div>

                <ZoomScale
                  title={t('play.zoomTitle')}
                  note={nextZoom ? t('play.zoomNext', { zoom: zoomText(nextZoom) }) : t('play.zoomFull')}
                  labels={ZOOM_LEVELS.map((level) => `×${zoomText(level)}`)}
                  current={shownStep}
                />
              </div>
            ) : duel.mode === 'page' ? (
              <MangaStage
                src={apiSrc(duel.image)}
                resetKey={`${duel.code}-${duel.round}`}
                state={over ? (duel.youWon ? 'won' : 'lost') : ''}
                banner={
                  revealed && answer ? (
                    <span className="manga-banner">
                      <small>{t(you?.solved ? 'page.bannerWon' : 'page.bannerLost')}</small>
                      <b>{name(answer)}</b>
                    </span>
                  ) : null
                }
                onReady={setPageReady}
              />
            ) : duel.mode === 'phrase' ? (
              <PhraseColumn
                lines={duel.lines ?? []}
                left={duel.linesLeft ?? 0}
                voiceLeft={Math.max(PHRASE_VOICE_AT - (duel.lines?.length ?? 0), 0)}
                voice={duel.voice}
                resetKey={`${duel.code}-${duel.round}`}
                over={revealed}
              />
            ) : duel.mode === 'ability' ? (
              <div className="shot-column ability-column">
                <div className={`ability-stage ${over ? (duel.youWon ? 'won' : 'lost') : ''}`}>
                  <span className="ability-glow" aria-hidden />
                  <AbilityIcon
                    className="ability-art"
                    src={duel.image ? `${apiSrc(duel.image)}&v=${revealed ? 'done' : wrong}` : undefined}
                    resetKey={`${duel.code}-${duel.round}`}
                  />
                </div>

                <ZoomScale
                  clarity
                  title={t('ability.scaleTitle')}
                  note={clarityStep < ABILITY_STAGES ? t('ability.nextClarity', { clarity: clarity(clarityStep + 1) }) : t('ability.fullClarity')}
                  labels={Array.from({ length: ABILITY_STAGES + 1 }, (_, i) => `${clarity(i)}%`)}
                  current={clarityStep}
                />
              </div>
            ) : null
          }
        >
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
            ) : duel.mode === 'page' ? (
              <>
                <AskCard title={t('play.pageTitle')} hint={t('duel.hurry')} />
                <MangaOptions
                  game={game}
                  options={(duel.options ?? []).map((id) => byId.get(id)).filter((one) => one !== undefined)}
                  missed={new Set(guesses.filter((g) => !g.pending).map((g) => g.entity.id))}
                  waiting={guesses.find((g) => g.pending)?.entity.id}
                  answerId={revealed ? duel.answerId : undefined}
                  over={revealed}
                  disabled={busy || !pageReady}
                  onPick={guess}
                />
              </>
            ) : (
              <>
                <AskCard
                  title={t(duel.mode === 'ability' ? 'play.abilityTitle' : duel.mode === 'phrase' ? 'play.phraseTitle' : 'play.imageTitle')}
                  hint={t('duel.hurry')}
                />
                <CharacterSearch game={game} exclude={new Set(guesses.map((g) => g.entity.id))} busy={busy} onPick={guess} compact />
              </>
            ))}

          {duel.ability && (
            <p className="ability-hint">
              {t(revealed ? 'ability.was' : 'ability.hint')} <b>{duel.ability[lang]}</b>
            </p>
          )}

          {!over && !youDone && (
            <GiveUp className="link-button" disabled={busy} onConfirm={giveUp}>
              {t('play.giveUp')}
            </GiveUp>
          )}

          {(over || youDone) && answer && (
            <div
              className={`card result ${
                !over ? (you?.solved ? 'won' : 'skipped') : duel.youWon ? 'won' : duel.winner === null ? 'skipped' : 'lost'
              }`}
            >
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
              {over && !duel.matchDone && (
                <div className="result-actions">
                  <button className="primary" onClick={next} disabled={busy || you?.wantsNext}>
                    {you?.wantsNext ? t('duel.nextWait') : t('duel.next')}
                  </button>
                </div>
              )}
              {rival?.wantsNext && !you?.wantsNext && <p className="muted small">{t('duel.rivalWantsNext', { name: rival.nickname })}</p>}
            </div>
          )}

          {duel.mode === 'classic' ? (
            <GuessGrid game={game} guesses={guesses} answerId={duel.answerId} />
          ) : (
            <TriesList
              game={game}
              guesses={guesses}
              answerId={duel.answerId}
              over={over}
              meta={(i, list) =>
                duel.mode === 'ability'
                  ? `${clarity(Math.min(list.slice(i + 1).filter((x) => !x.pending && x.entity.id !== duel.answerId).length, ABILITY_STAGES))}%`
                  : duel.mode === 'image'
                    ? `×${zoomText(levelAt(list.length - 1 - i))}`
                    : ''
              }
            />
          )}
        </PlayBoard>
      )}
    </div>
  )
}
