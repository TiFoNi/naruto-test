import CharacterSearch from './CharacterSearch'
import RoundResult from './RoundResult'
import RoundStatus from './RoundStatus'
import ZoomImage from './ZoomImage'
import Yesterday from './Yesterday'
import Thumb from './Thumb'
import type { Game } from './games/types'
import { useI18n } from './i18n'
import type { Stats } from './stats'
import { useRound } from './useRound'

const ZOOM_LEVELS = [7, 5.6, 4.5, 3.6, 2.9, 2.35, 1.9, 1.55, 1.25, 1]
type Props = { game: Game; active: boolean; stats: Stats; daily?: boolean }

export default function ImageMode({ game, active, stats, daily = false }: Props) {
  const { t, name } = useI18n()
  const { round, guesses, exclude, over, won, skipped, answer, yesterday, busy, error, guess, giveUp, next, retry } = useRound(game, 'image', active, daily)

  const wrong = guesses.length - (won ? 1 : 0)
  const zoom = over ? 1 : ZOOM_LEVELS[Math.min(wrong, ZOOM_LEVELS.length - 1)]



  return (
    <section className="mode">
      <div className="card intro">
        <h2>{t('play.imageTitle')}</h2>
        <p className="muted">{t('play.imagePrompt')}</p>
        <ZoomImage game={game} src={round?.image} zoom={zoom} resetKey={round?.id} seed={round?.daily ? `${game.id}-${round.daily}` : undefined} />
        {round && (
          <p className="round">
            {t(round.daily ? 'daily.round' : 'play.round', { round: round.number, guesses: guesses.length })} · {t('play.zoom', { zoom: zoom.toFixed(1) })}
          </p>
        )}
        {round?.daily && yesterday && <Yesterday game={game} entity={yesterday} />}
      </div>

      <RoundStatus loading={!round && !error} error={error} onRetry={retry} />

      {round && over && answer ? (
        <RoundResult game={game} answer={answer} guesses={guesses.length} won={won} skipped={skipped} stats={stats} onNext={next} mode="image" nextAt={round.nextAt} />
      ) : round ? (
        <>
          <CharacterSearch game={game} exclude={exclude} active={active} busy={busy} onPick={guess} />
          <button className="link-button" onClick={giveUp} disabled={busy}>
            {t('play.giveUp')}
          </button>
        </>
      ) : null}

      <div className="guess-list">
        {guesses.map(({ entity: g, pending }) => (
          <div key={g.id} className={`guess-chip ${pending ? 'pending' : won && g.id === answer?.id ? 'correct' : 'wrong'}`}>
            <Thumb game={game} entity={g} size={44} />
            <span>{name(g)}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
