import CharacterSearch from './CharacterSearch'
import GuessGrid, { Legend } from './GuessGrid'
import RoundResult from './RoundResult'
import RoundStatus from './RoundStatus'
import Yesterday from './Yesterday'
import type { Game } from './games/types'
import { useI18n } from './i18n'
import type { Stats } from './stats'
import { useRound } from './useRound'

type Props = { game: Game; active: boolean; stats: Stats; daily?: boolean }

export default function ClassicMode({ game, active, stats, daily = false }: Props) {
  const { t } = useI18n()
  const { round, guesses, exclude, over, won, skipped, answer, yesterday, busy, error, guess, giveUp, next, retry } = useRound(game, 'classic', active, daily)


  return (
    <section className="mode">
      <div className="card intro">
        <h2>{t('play.classicTitle')}</h2>
        <p className="muted">{t('play.classicPrompt')}</p>
        {round && <p className="round">{t(round.daily ? 'daily.round' : 'play.round', { round: round.number, guesses: guesses.length })}</p>}
        {round?.daily && yesterday && <Yesterday game={game} entity={yesterday} />}
      </div>

      <RoundStatus loading={!round && !error} error={error} onRetry={retry} />

      {round && over && answer ? (
        <RoundResult game={game} answer={answer} guesses={guesses.length} won={won} skipped={skipped} stats={stats} onNext={next} mode="classic" nextAt={round.nextAt} />
      ) : round ? (
        <>
          <CharacterSearch game={game} exclude={exclude} active={active} busy={busy} onPick={guess} />
          <button className="link-button" onClick={giveUp} disabled={busy}>
            {t('play.giveUp')}
          </button>
        </>
      ) : null}

      <GuessGrid game={game} guesses={guesses} />

      <Legend game={game} />
    </section>
  )
}
