import CharacterSearch from './CharacterSearch'
import GuessGrid from './GuessGrid'
import PlayPanel from './PlayPanel'
import PlaySide from './PlaySide'
import RoundResult from './RoundResult'
import RoundStatus from './RoundStatus'
import ShareResult, { type Tile } from './ShareResult'
import Yesterday from './Yesterday'
import type { Game } from './games/types'
import { useI18n } from './i18n'
import type { Stats } from './stats'
import { useRound } from './useRound'

type Props = { game: Game; active: boolean; stats: Stats; daily?: boolean; challenge?: string }

export default function ClassicMode({ game, active, stats, daily = false, challenge }: Props) {
  const { t, l } = useI18n()
  const { round, guesses, exclude, over, won, skipped, answer, yesterday, busy, error, guess, giveUp, next, retry } = useRound(
    game,
    'classic',
    active,
    daily,
    challenge,
  )
  const playing = !!round && !over
  const tiles: Tile[] = guesses
    .filter((g) => !g.pending)
    .map((g): Tile => (won && g.entity.id === answer?.id ? 'hit' : 'miss'))
    .reverse()

  return (
    <section className="play-layout">
      <div className="play-main">
        <PlayPanel
          media={
            <span className="play-mystery" aria-hidden>
              ?
            </span>
          }
          title={t('play.classicTitle')}
          hint={t('play.classicPrompt')}
        >
          {playing && <CharacterSearch game={game} exclude={exclude} active={active} busy={busy} onPick={guess} />}
        </PlayPanel>

        {round?.daily && yesterday && <Yesterday game={game} entity={yesterday} />}

        <RoundStatus loading={!round && !error} error={error} onRetry={retry} />

        {round && over && answer && (
          <RoundResult
            game={game}
            answer={answer}
            guesses={guesses.length}
            won={won}
            skipped={skipped}
            stats={stats}
            onNext={next}
            challenge={challenge}
            mode="classic"
            nextAt={round.nextAt}
          />
        )}

        {round && over && answer && !skipped && (
          <ShareResult caption={l(game.label)} tiles={tiles} summary={t('play.pillAttempts', { count: guesses.length })} won={won} />
        )}

        <GuessGrid game={game} guesses={guesses} answerId={answer?.id} />
      </div>

      <PlaySide game={game} mode="classic" daily={daily} stats={stats} playing={playing} legend onGiveUp={giveUp} />
    </section>
  )
}
