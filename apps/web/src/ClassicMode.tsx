import AnimeFilter from './AnimeFilter'
import CharacterSearch from './CharacterSearch'
import GuessGrid from './GuessGrid'
import PlayBoard from './PlayBoard'
import PlayPanel from './PlayPanel'
import PlaySide from './PlaySide'
import RoundResult from './RoundResult'
import RoundStatus from './RoundStatus'
import Yesterday from './Yesterday'
import type { Game } from './games/types'
import { useI18n } from './i18n'
import type { Stats } from './stats'
import { useRound } from './useRound'

type Props = { game: Game; active: boolean; stats: Stats; daily?: boolean; challenge?: string; mode?: 'classic' | 'blind' }

export default function ClassicMode({ game, active, stats, daily = false, challenge, mode = 'classic' }: Props) {
  const blind = mode === 'blind'
  const { t } = useI18n()
  const { round, guesses, exclude, over, won, skipped, answer, yesterday, gained, busy, error, guess, giveUp, refilter, next, retry } = useRound(
    game,
    mode,
    active,
    daily,
    challenge,
  )
  const playing = !!round && !over
  return (
    <PlayBoard side={<PlaySide game={game} mode={mode} daily={daily} stats={stats} playing={playing} legend={!blind} howto={blind ? 'blind' : undefined} onGiveUp={giveUp} />}>
      {!over && (
        <PlayPanel
          media={
            <span className="play-mystery" aria-hidden>
              ?
            </span>
          }
          title={t('play.classicTitle')}
          aside={<AnimeFilter game={game} daily={daily} playing={!!round && !over} fresh={guesses.length === 0} roundAnime={round?.anime === true} onSurrender={giveUp} onRefilter={refilter} />}
          hint={t('play.classicPrompt')}
        >
          {!error && <CharacterSearch game={game} exclude={exclude} busy={busy || !round} onPick={guess} limited={round?.anime === true} />}
        </PlayPanel>
      )}

      {round?.daily && yesterday && <Yesterday game={game} entity={yesterday} />}

      <RoundStatus error={error} onRetry={retry} />

      {round && over && answer && (
        <RoundResult
          game={game}
          answer={answer}
          guesses={guesses.length}
          won={won}
          skipped={skipped}
          stats={stats}
          gained={gained}
          day={round?.daily}
          board={guesses
                  .filter((g) => !g.pending)
                  .slice(0, 4)
                  .reverse()
                  .map((g) => game.columns.map((col) => g.judgement?.[col.key]?.verdict ?? 'wrong'))}
          onNext={next}
          challenge={challenge}
          mode={mode}
          nextAt={round.nextAt}
        />
      )}

      <GuessGrid game={game} guesses={guesses} answerId={answer?.id} loading={!round && !error} blind={blind} />
    </PlayBoard>
  )
}
