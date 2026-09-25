import { useEffect, useRef, useState } from 'react'
import PlaySide from './PlaySide'
import RoundResult from './RoundResult'
import RoundStatus from './RoundStatus'
import Yesterday from './Yesterday'
import type { Entity, Game } from './games/types'
import { useI18n, type UiKey } from './i18n'
import type { Stats } from './stats'
import { useRound } from './useRound'
import { apiSrc } from './api'
import { miniUrl } from './pics'
import { CheckIcon, CloseIcon, NextIcon, ZoomInIcon, ZoomOutIcon } from './icons'

type Props = { game: Game; active: boolean; stats: Stats; daily?: boolean; challenge?: string }

type Titled = Entity & { demographic?: string; year?: number }

export default function PageMode({ game, active, stats, daily = false, challenge }: Props) {
  const { t, name, tv } = useI18n()
  const { round, guesses, over, won, skipped, answer, yesterday, busy, error, guess, giveUp, next, retry } = useRound(game, 'page', active, daily, challenge)

  const byId = new Map(game.entities.map((e) => [e.id, e]))
  const missed = new Set(guesses.filter((g) => !g.pending).map((g) => g.entity.id))
  const waiting = guesses.find((g) => g.pending)?.entity.id
  const options = (round?.options ?? []).map((id) => byId.get(id)).filter((e) => e !== undefined)
  const src = apiSrc(round?.image)

  const [loaded, setLoaded] = useState<string | null>(null)
  const [zoom, setZoom] = useState(false)
  const [number, setNumber] = useState(1)
  const ready = Boolean(src) && loaded === src
  const playing = !!round && !over
  const scored = daily || !!challenge

  const played = stats.solved + stats.skipped
  const playedRef = useRef(played)
  playedRef.current = played

  useEffect(() => setLoaded(null), [src])

  useEffect(() => {
    if (!round?.id) return
    setZoom(false)
    setNumber(playedRef.current + 1)
  }, [round?.id])

  const shortcut = useRef<(key: string) => void>(() => {})
  shortcut.current = (key) => {
    if (!active) return
    if (key === 'Enter' && over && !scored) {
      next()
      return
    }
    if (!playing || busy || !ready) return
    const option = options[Number(key) - 1]
    if (!option || missed.has(option.id) || waiting === option.id) return
    guess(option)
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return
      shortcut.current(event.key)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const mood = !over ? (guesses.length ? 'wrong' : 'ask') : won ? 'won' : 'lost'
  const headline: UiKey =
    mood === 'ask'
      ? 'play.pageTitle'
      : mood === 'wrong'
        ? 'page.again'
        : mood === 'won'
          ? guesses.length === 1
            ? 'page.first'
            : 'page.got'
          : skipped
            ? 'result.skipped'
            : 'result.lost'
  const subline: UiKey =
    mood === 'won' ? (guesses.length === 1 ? 'page.firstHint' : 'page.gotHint') : mood === 'lost' ? 'page.lostHint' : 'play.pagePrompt'

  const meta = (option: Entity) => {
    const row = option as Titled
    return [row.demographic ? tv(row.demographic) : '', row.year ? String(row.year) : ''].filter(Boolean).join(' · ')
  }

  return (
    <section className="play-layout page-layout">
      <div className="manga-stage">
        <div className={`manga-frame ${over ? (won ? 'won' : 'lost') : ''}`}>
          {!ready && <div className="zoom-loading">{t('image.loading')}</div>}
          <div className="manga-sheet" style={{ transform: zoom ? 'scale(1.8)' : 'scale(1)' }}>
            {src && (
              <img
                key={src}
                className="manga-page"
                src={src}
                alt={t('play.pageTitle')}
                ref={(el) => {
                  if (el?.complete && el.naturalWidth) setLoaded(src)
                }}
                onLoad={() => setLoaded(src)}
                style={{ opacity: ready ? 1 : 0 }}
              />
            )}
          </div>
          {!daily && !challenge && round && <span className="manga-round">{t('play.roundNo', { number })}</span>}
          {over && answer && (
            <span className="manga-banner">
              <small>{t(won ? 'page.bannerWon' : 'page.bannerLost')}</small>
              <b>{name(answer)}</b>
            </span>
          )}
        </div>
        <button type="button" className={`manga-zoom ${zoom ? 'on' : ''}`} aria-pressed={zoom} disabled={!ready} onClick={() => setZoom(!zoom)}>
          {zoom ? <ZoomOutIcon /> : <ZoomInIcon />}
          {t(zoom ? 'page.zoomOut' : 'page.zoomIn')}
        </button>
      </div>

      <div className="play-main">
        <div className={`play-card mode-ask state-${mood}`}>
          <h2>{t(headline)}</h2>
          <p>{t(subline)}</p>
          <div className="mode-pills">
            <span>{t('play.pillAttempts', { count: guesses.length })}</span>
            <span className="hot">{t('play.pillStreak', { count: stats.streak })}</span>
          </div>
        </div>

        <div className="manga-options" role="radiogroup" aria-label={t('play.pageTitle')}>
          {options.map((option, index) => {
            const wrong = missed.has(option.id)
            const right = over && answer?.id === option.id
            const pending = waiting === option.id
            const dim = over && !right && !wrong
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={right || wrong}
                className={`manga-option ${right ? 'right' : wrong ? 'wrong' : dim ? 'dim' : ''} ${pending ? 'waiting' : ''}`}
                disabled={!playing || busy || !ready || wrong || pending}
                onClick={() => guess(option)}
              >
                <span className="manga-key">{index + 1}</span>
                <img className="manga-cover" src={miniUrl(game.id, option.id, option.image)} alt="" loading="lazy" decoding="async" />
                <span className="manga-option-body">
                  <b>{name(option)}</b>
                  <small>{meta(option)}</small>
                </span>
                <span className="manga-mark">{right ? <CheckIcon /> : wrong ? <CloseIcon /> : <NextIcon />}</span>
              </button>
            )
          })}
        </div>

        {over && !scored && (
          <button type="button" className="primary mode-next" onClick={next}>
            {t('page.next')}
          </button>
        )}

        <RoundStatus loading={!round && !error} error={error} onRetry={retry} />

        {round && over && answer && scored && (
          <RoundResult
            game={game}
            answer={answer}
            guesses={guesses.length}
            won={won}
            skipped={skipped}
            stats={stats}
            onNext={next}
            challenge={challenge}
            mode="page"
            nextAt={round.nextAt}
            compact
          />
        )}

        {round?.daily && yesterday && <Yesterday game={game} entity={yesterday} />}
      </div>

      <PlaySide game={game} mode="page" daily={daily} stats={stats} playing={playing} busy={!ready} howto="page" onGiveUp={giveUp} />
    </section>
  )
}
