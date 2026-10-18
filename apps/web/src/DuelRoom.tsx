'use client'

import Avatar from './Avatar'
import BackButton from './BackButton'
import { Fragment, useEffect, useMemo, useState, type CSSProperties } from 'react'
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
import ClueBoard from './ClueBoard'
import type { Guess } from './useRound'
import { SwordsIcon, TrophyIcon } from './icons'
import { fullUrl } from './pics'
import { api, apiSrc } from './api'
import { useEntities } from './entities'


const clarity = (step: number) => Math.round((step / ABILITY_STAGES) * 100)

const RING = 2 * Math.PI * 44

const clock = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

export default function DuelRoom({ code, onRestart }: { code: string; onRestart?: () => void }) {
  const { t, l, name, lang, error: errorText } = useI18n()
  const href = useHref()
  const navigate = useNavigate()
  const { duel, error, busy, pending, serverNow, ready, setup, seat, clue, open, skip, invite, next, toLobby, giveUp, guess, pick, pass, mark, strike, answer: markAnswer, refresh } = useDuel(code)
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
  const squads = duel.squads ?? []
  const myTeam = duel.youTeam ?? 0
  const teamly = squads.length > 2 || (duel.per ?? 1) > 1
  const squadWins = (team: number) => Math.max(0, ...(squads[team] ?? []).map((mate) => mate.wins))
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
  const ticking = duel.status === 'playing' && duel.seconds > 0 && !!duel.endsAt
  const share = ticking ? Math.max(0, Math.min(1, left / (duel.seconds * 1000))) : 0
  const heat = ticking ? Math.round(Math.max(0, 1 - share / 0.2) * 100) : 0

  const sideNote = (side: { ready?: boolean; solved?: boolean; gaveUp?: boolean } | undefined, count: number, cardsLeft: number) =>
    inLobby
      ? side?.ready
        ? t('duel.isReady')
        : t('duel.notReady')
      : [
          duel.mode === 'who'
            ? t('who.cardsLeft', { count: cardsLeft })
            : duel.mode === 'grid'
              ? t('grid.misses', { count, max: GRID_MISSES })
              : t('duel.guesses', { count }),
          side?.solved ? t('duel.solved') : side?.gaveUp ? t(duel.mode === 'who' ? 'who.missed' : 'duel.gaveUp') : '',
        ]
          .filter(Boolean)
          .join(' · ')

  const youNote = sideNote(you, duel.mode === 'grid' ? (duel.you?.guesses.length ?? 0) : guesses.filter((g) => !g.pending).length, (duel.cards?.length ?? 0) - (duel.struck?.length ?? 0))
  const rivalNote = rival ? sideNote(rival, rival.guessCount, duel.rivalLeft ?? 0) : ''

  const quit =
    duel.status === 'playing' &&
    (solo ? (
      <GiveUp hint="grid.giveUpHint" disabled={busy} onConfirm={giveUp}>
        {t('grid.giveUp')}
      </GiveUp>
    ) : (
      <button type="button" className="give-up" onClick={() => void leave()} disabled={busy}>
        {t('duel.leave')}
      </button>
    ))

  const myWins = teamly ? squadWins(myTeam) : you?.wins ?? 0
  const foeWins = teamly
    ? squads.reduce((sum, _line, team) => (team === myTeam ? sum : sum + squadWins(team)), 0)
    : rival?.wins ?? 0
  const settled = myWins + foeWins + (duel.draws ?? 0)
  const roundMark = (index: number) => {
    if (index < myWins) return 'won'
    if (index < myWins + foeWins) return 'lost'
    if (index < settled) return 'drawn'
    return index === settled && !over ? 'now' : ''
  }

  const mateNote = (mate: { solved: boolean; gaveUp: boolean; guessCount: number }) =>
    [
      duel.mode === 'grid' ? t('grid.misses', { count: mate.guessCount, max: GRID_MISSES }) : t('duel.guesses', { count: mate.guessCount }),
      mate.solved ? t('duel.solved') : mate.gaveUp ? t('duel.gaveUp') : '',
    ]
      .filter(Boolean)
      .join(' · ')

  return (
    <div className="duel">
      {!solo && <BackButton href={href.home}>{t('play.back')}</BackButton>}

      {!inLobby && (
        <>
      <header
        className={`duel-hud card ${teamly ? 'is-teams' : ''}`}
        style={{ '--tab-accent': game?.accent ?? 'var(--accent)' } as CSSProperties}
      >
        <span className="duel-hud-meta">
          {[duel.round > 0 ? t('duel.roundOf', { round: duel.round, best: duel.best }) : null, game ? l(game.label) : null, modeLabel]
            .filter(Boolean)
            .join(' · ')}
        </span>

        {teamly && (
          <>
            <div className="duel-hud-clock" style={{ '--heat': heat } as CSSProperties}>
              {ticking && (
                <svg className="duel-hud-ring" viewBox="0 0 100 100" aria-hidden>
                  <circle className="duel-hud-ring-bed" cx="50" cy="50" r="44" />
                  <circle className="duel-hud-ring-line" cx="50" cy="50" r="44" style={{ strokeDashoffset: RING * (1 - share) }} />
                </svg>
              )}
              <span>{ticking ? clock(left) : '—'}</span>
            </div>

            <ul className="duel-hud-squads" style={{ '--sides': squads.length } as CSSProperties}>
              {squads.map((mates, team) => (
                <li key={team} className={`duel-hud-squad ${team === myTeam ? 'is-you' : 'is-rival'}`}>
                  <div className="duel-hud-squad-top">
                    <b className="duel-hud-squad-name">{t('duel.teamNth', { number: team + 1 })}</b>
                    <b className="duel-hud-score">{squadWins(team)}</b>
                  </div>
                  <ul className="duel-hud-mates">
                    {mates.length === 0 && (
                      <li className="duel-hud-mate is-empty">
                        <span>{t('duel.teamWait')}</span>
                      </li>
                    )}
                    {mates.map((mate) => (
                      <li key={mate.id} className={`duel-hud-mate ${mate.solved ? 'is-solved' : ''} ${mate.gaveUp ? 'is-out' : ''}`}>
                        <Avatar className="duel-hud-face" id={mate.id} name={mate.nickname} avatar={mate.avatar} />
                        <span className="duel-hud-name">
                          <b>{mate.nickname}</b>
                          <small>{mate.you ? youNote : mateNote(mate)}</small>
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </>
        )}

        {!teamly && (
        <div className="duel-hud-row">
          <div className="duel-hud-side is-you">
            {you && <Avatar className="duel-hud-face" id={you.id} name={you.nickname} avatar={you.avatar} />}
            <span className="duel-hud-name">
              <b>{you?.nickname}</b>
              <small>{youNote}</small>
            </span>
          </div>

          <b className="duel-hud-score is-you">{you?.wins ?? 0}</b>

          <div className="duel-hud-clock" style={{ '--heat': heat } as CSSProperties}>
            {ticking && (
              <svg className="duel-hud-ring" viewBox="0 0 100 100" aria-hidden>
                <circle className="duel-hud-ring-bed" cx="50" cy="50" r="44" />
                <circle className="duel-hud-ring-line" cx="50" cy="50" r="44" style={{ strokeDashoffset: RING * (1 - share) }} />
              </svg>
            )}
            <span>{ticking ? clock(left) : '—'}</span>
          </div>

          <b className="duel-hud-score is-rival">{rival?.wins ?? 0}</b>

          <div className="duel-hud-side is-rival">
            <span className="duel-hud-name">
              <b>{rival?.nickname ?? t('duel.waitingRival')}</b>
              <small>{rivalNote}</small>
            </span>
            {rival && <Avatar className="duel-hud-face" id={rival.id} name={rival.nickname} avatar={rival.avatar} />}
          </div>

        </div>
        )}

        {duel.best > 1 && (
          <ul className="duel-hud-dots" aria-hidden>
            {Array.from({ length: duel.best }, (_, index) => (
              <li key={index} className={roundMark(index)} />
            ))}
          </ul>
        )}
      </header>

        </>
      )}

      {inLobby && (
        <DuelSetup duel={duel} busy={busy} link={link} onSetup={setup} onInvite={invite} onReady={ready} onSeat={seat} onLeave={() => void leave()} />
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
            <h2>
              {duel.winner
                ? duel.youWon
                  ? t('duel.matchWon')
                  : t('duel.matchLost', {
                      name: teamly ? t('duel.teamNth', { number: (duel.winnerTeam ?? 0) + 1 }) : duel.winner,
                    })
                : t('duel.matchDraw')}
            </h2>
            <p className="duel-final-score">
              {teamly ? (
                squads.map((_mates, team) => (
                  <Fragment key={team}>
                    {team > 0 && <span>:</span>}
                    <b className={team === myTeam ? 'is-you' : ''}>{squadWins(team)}</b>
                  </Fragment>
                ))
              ) : (
                <>
                  <b>{you?.wins ?? 0}</b>
                  <span>:</span>
                  <b>{rival?.wins ?? 0}</b>
                </>
              )}
            </p>
            <p className="muted">
              {duel.mode === 'who' && duel.rivalSecret !== undefined
                ? t('who.was', { name: name(byId.get(duel.rivalSecret) ?? { name: '?' }) })
                : teamly
                  ? squads.map((mates) => mates.map((mate) => mate.nickname).join(', ') || '—').join(' · ')
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

      {!inLobby && game && duel.mode === 'clue' && (
        <>
          <ClueBoard game={game} byId={byId} duel={duel} busy={busy} onClue={clue} onOpen={open} onSkip={skip} onNext={next} />
          {quit && <div className="duel-quit is-wide">{quit}</div>}
        </>
      )}

      {!inLobby && game && duel.mode === 'grid' && (
        <>
        <GridBoard game={game} byId={byId} duel={duel} busy={busy} error={error} onMark={mark} onNext={next} />
        {quit && <div className="duel-quit is-wide">{quit}</div>}
        </>
      )}

      {!inLobby && game && duel.mode !== 'who' && duel.mode !== 'grid' && duel.mode !== 'clue' && (
        <PlayBoard
          variant={duel.mode === 'image' ? 'shot' : duel.mode === 'ability' ? 'ability' : 'classic'}
          side={
            <aside className="play-side duel-side">
              {duel.mode === 'classic' && duel.rival && <RivalBoard game={game} rows={duel.rival.board ?? []} total={duel.rival.guessCount} />}
              {quit && <div className="duel-quit">{quit}</div>}
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
              <span className="result-hero">
                <img className="result-face" src={fullUrl(game.id, answer.id, answer.image)} alt={name(answer)} />
                <em className="result-badge">{you?.solved ? t('result.badgeWon') : t('result.badgeLost')}</em>
              </span>

              <div className="result-body">
                <span className="result-eyebrow">
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
                </span>
                <div className="result-name">{name(answer)}</div>

                <div className="result-chips">
                  <span className="result-chip">{t('duel.score', { you: you?.wins ?? 0, rival: rival?.wins ?? 0 })}</span>
                  {!duel.matchDone && <span className="result-chip">{t('duel.roundOf', { round: duel.round, best: duel.best })}</span>}
                  <span className="result-chip">
                    {you?.nickname}: <b>{you?.guesses.length ?? 0}</b>
                    {rival ? ` · ${rival.nickname}: ${rival.guessCount}` : ''}
                  </span>
                </div>

                {over && !duel.matchDone && (
                  <div className="result-actions">
                    <button className="primary" onClick={next} disabled={busy || you?.wantsNext}>
                      {you?.wantsNext ? t('duel.nextWait') : t('duel.next')}
                    </button>
                  </div>
                )}
                {rival?.wantsNext && !you?.wantsNext && <p className="round">{t('duel.rivalWantsNext', { name: rival.nickname })}</p>}
              </div>
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

      {!inLobby && quit && duel.mode !== 'grid' && duel.mode !== 'clue' && <div className="duel-quit is-narrow">{quit}</div>}
    </div>
  )
}
