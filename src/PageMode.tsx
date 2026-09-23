import RoundResult from './RoundResult'
import RoundStatus from './RoundStatus'
import Yesterday from './Yesterday'
import type { Game } from './games/types'
import { useI18n } from './i18n'
import type { Stats } from './stats'
import { useRound } from './useRound'

type Props = { game: Game; active: boolean; stats: Stats; daily?: boolean }

export default function PageMode({ game, active, stats, daily = false }: Props) {
  const { t, name } = useI18n()
  const { round, guesses, over, won, skipped, answer, yesterday, busy, error, guess, giveUp, next, retry } = useRound(game, 'page', active, daily)

  const byId = new Map(game.entities.map((e) => [e.id, e]))
  const missed = new Set(guesses.filter((g) => !g.pending).map((g) => g.entity.id))
  const waiting = guesses.find((g) => g.pending)?.entity.id
  const options = (round?.options ?? []).map((id) => byId.get(id)).filter((e) => e !== undefined)

  return (
    <section className="mode">
      {!over && (
        <div className="card intro">
          <h2>{t('play.pageTitle')}</h2>
          <p className="muted">{t('play.pagePrompt')}</p>
          {round?.image && <img className="manga-page" src={round.image} alt={t('play.pageTitle')} />}
          {round && (
            <p className="round">{t(round.daily ? 'daily.round' : 'play.round', { round: round.number, guesses: guesses.length })}</p>
          )}
          {round?.daily && yesterday && <Yesterday game={game} entity={yesterday} />}
        </div>
      )}

      <RoundStatus loading={!round && !error} error={error} onRetry={retry} />

      {round && over && answer ? (
        <>
          <RoundResult game={game} answer={answer} guesses={guesses.length} won={won} skipped={skipped} stats={stats} onNext={next} mode="page" nextAt={round.nextAt} />
          {round.daily && yesterday && (
            <div className="card yesterday-card">
              <Yesterday game={game} entity={yesterday} />
            </div>
          )}
        </>
      ) : round ? (
        <>
          <div className="options">
            {options.map((option) => (
              <button
                key={option.id}
                className={`option ${waiting === option.id ? 'waiting' : missed.has(option.id) ? 'wrong' : ''}`}
                disabled={busy || missed.has(option.id) || waiting === option.id}
                onClick={() => guess(option)}
              >
                <span className="option-name">{name(option)}</span>
                <span className="option-en">{option.nameEn}</span>
              </button>
            ))}
          </div>
          <button className="link-button" onClick={giveUp} disabled={busy}>
            {t('play.giveUp')}
          </button>
        </>
      ) : null}
    </section>
  )
}
