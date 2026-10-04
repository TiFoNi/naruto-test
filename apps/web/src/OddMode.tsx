import { useEffect, useRef, useState } from 'react'
import AnimeFilter from './AnimeFilter'
import PlayBoard from './PlayBoard'
import PlayPanel from './PlayPanel'
import PlaySide from './PlaySide'
import RoundResult from './RoundResult'
import RoundStatus from './RoundStatus'
import Yesterday from './Yesterday'
import type { Entity, Game } from './games/types'
import { useI18n, type UiKey } from './i18n'
import { ArrowIcon, CheckIcon, CloseIcon } from './icons'
import { miniUrl } from './pics'
import type { Stats } from './stats'
import { useRound } from './useRound'

type Props = { game: Game; active: boolean; stats: Stats; daily?: boolean; challenge?: string }

export default function OddMode({ game, active, stats, daily = false, challenge }: Props) {
  const { t, l, tv, name } = useI18n()
  const { round, guesses, over, won, skipped, answer, yesterday, busy, error, guess, giveUp, refilter, next, retry } = useRound(
    game,
    'odd',
    active,
    daily,
    challenge,
  )

  const byId = new Map(game.entities.map((e) => [e.id, e]))
  const four = (round?.options ?? []).map((id) => byId.get(id)).filter((one) => one !== undefined)
  const missed = new Set(guesses.filter((g) => !g.pending).map((g) => g.entity.id))
  const waiting = guesses.find((g) => g.pending)?.entity.id

  const playing = !!round && !over
  const scored = daily || !!challenge
  const [number, setNumber] = useState(1)

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
    if (key === 'Enter' && over && !scored) return next()
    if (!playing || busy) return
    const option = four[Number(key) - 1]
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

  const column = game.columns.find((one) => one.key === round?.trait?.key)
  const field = column ? l(column.title) : (round?.trait?.key ?? '')
  const trait = round?.trait?.value ? `${field} — ${tv(round.trait.value)}` : field

  const mood = !over ? (missed.size ? 'wrong' : 'ask') : won ? 'won' : 'lost'
  const headline: UiKey =
    mood === 'ask'
      ? 'play.oddTitle'
      : mood === 'wrong'
        ? 'odd.again'
        : mood === 'won'
          ? guesses.length === 1
            ? 'odd.first'
            : 'odd.got'
          : skipped
            ? 'result.skipped'
            : 'result.lost'
  const hint =
    mood === 'won'
      ? t(guesses.length === 1 ? 'odd.firstHint' : 'odd.gotHint', { trait })
      : mood === 'lost'
        ? t('odd.lostHint', { trait })
        : field
          ? t('play.oddPrompt', { field })
          : t('play.oddPromptPlain')

  return (
    <PlayBoard side={<PlaySide game={game} mode="odd" daily={daily} stats={stats} playing={playing} howto="odd" onGiveUp={giveUp} />}>
      <PlayPanel
        title={t(headline)}
        hint={hint}
        aside={
          <span className="play-aside">
            {!daily && !challenge && round && <span className="play-round">{t('play.roundNo', { number })}</span>}
            <AnimeFilter
              game={game}
              daily={daily}
              playing={playing}
              fresh={guesses.length === 0}
              roundAnime={round?.anime === true}
              onSurrender={giveUp}
              onRefilter={refilter}
            />
          </span>
        }
        media={
          <span className="play-mystery" aria-hidden>
            ?
          </span>
        }
      >
        <div className="odd-grid" role="radiogroup" aria-label={t('play.oddTitle')}>
          {four.map((option: Entity, index) => {
            const wrong = missed.has(option.id)
            const right = over && answer?.id === option.id
            const pending = waiting === option.id
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={right || wrong}
                className={`odd-card ${right ? 'right' : wrong ? 'wrong' : over ? 'dim' : ''} ${pending ? 'waiting' : ''}`}
                disabled={!playing || busy || wrong || pending}
                onClick={() => guess(option)}
              >
                <span className="odd-key">{index + 1}</span>
                <img src={miniUrl(game.id, option.id, option.image)} alt="" loading="lazy" decoding="async" draggable={false} />
                <b>{name(option)}</b>
                {(right || wrong) && <span className="odd-mark">{right ? <CheckIcon /> : <CloseIcon />}</span>}
              </button>
            )
          })}
        </div>
      </PlayPanel>

      {over && !scored && (
        <button type="button" className="primary mode-next" onClick={next}>
          {t('odd.next')}
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
          mode="odd"
          nextAt={round.nextAt}
          compact
        />
      )}

      {round?.daily && yesterday && <Yesterday game={game} entity={yesterday} />}
    </PlayBoard>
  )
}
