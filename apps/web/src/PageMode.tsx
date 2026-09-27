import { useEffect, useRef, useState } from 'react'
import MangaStage, { MangaOptions } from './MangaStage'
import PlayBoard from './PlayBoard'
import PlaySide from './PlaySide'
import RoundResult from './RoundResult'
import RoundStatus from './RoundStatus'
import Yesterday from './Yesterday'
import type { Game } from './games/types'
import { useI18n, type UiKey } from './i18n'
import type { Stats } from './stats'
import { useRound } from './useRound'
import { apiSrc } from './api'
import { ArrowIcon } from './icons'

type Props = { game: Game; active: boolean; stats: Stats; daily?: boolean; challenge?: string }

export default function PageMode({ game, active, stats, daily = false, challenge }: Props) {
  const { t, name } = useI18n()
  const { round, guesses, over, won, skipped, answer, yesterday, busy, error, guess, giveUp, next, retry } = useRound(game, 'page', active, daily, challenge)

  const byId = new Map(game.entities.map((e) => [e.id, e]))
  const missed = new Set(guesses.filter((g) => !g.pending).map((g) => g.entity.id))
  const waiting = guesses.find((g) => g.pending)?.entity.id
  const options = (round?.options ?? []).map((id) => byId.get(id)).filter((e) => e !== undefined)
  const src = apiSrc(round?.image)

  const [ready, setReady] = useState(false)
  const [number, setNumber] = useState(1)
  const playing = !!round && !over
  const scored = daily || !!challenge

  const played = stats.solved + stats.skipped
  const playedRef = useRef(played)
  playedRef.current = played

  useEffect(() => {
    if (!round?.id) return
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

  const mood = !over ? (missed.size ? 'wrong' : 'ask') : won ? 'won' : 'lost'
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

  return (
    <PlayBoard
      variant="page"
      side={<PlaySide game={game} mode="page" daily={daily} stats={stats} playing={playing} howto="page" onGiveUp={giveUp} />}
      media={
        <MangaStage
          src={src}
          resetKey={round?.id}
          state={over ? (won ? 'won' : 'lost') : ''}
          note={!daily && !challenge && round ? <span className="manga-round">{t('play.roundNo', { number })}</span> : null}
          banner={
            over && answer ? (
              <span className="manga-banner">
                <small>{t(won ? 'page.bannerWon' : 'page.bannerLost')}</small>
                <b>{name(answer)}</b>
              </span>
            ) : null
          }
          onReady={setReady}
        />
      }
    >
      <div className={`play-card mode-ask state-${mood}`}>
        <h2>{t(headline)}</h2>
        <p>{t(subline)}</p>
      </div>

      <MangaOptions
        game={game}
        options={options}
        missed={missed}
        waiting={waiting}
        answerId={over ? answer?.id : undefined}
        over={over}
        disabled={!playing || busy || !ready}
        onPick={guess}
      />

        {over && !scored && (
          <button type="button" className="primary mode-next" onClick={next}>
            {t('page.next')}
            <ArrowIcon />
          </button>
        )}

        <RoundStatus error={error} onRetry={retry} />

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
    </PlayBoard>
  )
}
