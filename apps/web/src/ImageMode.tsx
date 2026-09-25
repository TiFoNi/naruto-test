import CharacterSearch from './CharacterSearch'
import PlaySide from './PlaySide'
import RoundResult from './RoundResult'
import RoundStatus from './RoundStatus'
import ShareResult, { type Tile } from './ShareResult'
import ZoomImage from './ZoomImage'
import Yesterday from './Yesterday'
import Thumb from './Thumb'
import type { Game } from './games/types'
import { useI18n } from './i18n'
import type { Stats } from './stats'
import { useRound } from './useRound'
import { apiSrc } from './api'
import { ZOOM_LEVELS, levelAt } from './zoom'

type Props = { game: Game; active: boolean; stats: Stats; daily?: boolean; challenge?: string }


export default function ImageMode({ game, active, stats, daily = false, challenge }: Props) {
  const { t, l, lang, name } = useI18n()
  const { round, guesses, exclude, over, won, skipped, answer, yesterday, busy, error, guess, giveUp, next, retry } = useRound(
    game,
    'image',
    active,
    daily,
    challenge,
  )

  const wrong = guesses.length - (won ? 1 : 0)
  const step = Math.min(wrong, ZOOM_LEVELS.length - 1)
  const zoom = over ? 1 : ZOOM_LEVELS[step]
  const playing = !!round && !over
  const zoomText = (value: number) => (lang === 'en' ? value.toFixed(1) : value.toFixed(1).replace('.', ','))
  const nextLevel = step < ZOOM_LEVELS.length - 1 ? ZOOM_LEVELS[step + 1] : null
  const shownStep = over ? ZOOM_LEVELS.length - 1 : step
  const solvedAt = ZOOM_LEVELS[step]
  const tiles: Tile[] = ZOOM_LEVELS.map((_, i) => (i < step ? 'miss' : i === step ? 'hit' : 'idle'))
  const shareSummary = `${t('play.pillAttempts', { count: guesses.length })} · ${won ? `×${zoomText(solvedAt)}` : t('share.gaveUp')}`

  return (
    <section className="play-layout shot-layout">
      <div className="shot-column">
        <div className="shot">
          <ZoomImage
            game={game}
            src={apiSrc(round?.image)}
            zoom={zoom}
            resetKey={round?.id}
          />
        </div>

        <div className="play-card zoom-scale">
          <div className="zoom-scale-head">
            <span className="play-card-title">{t('play.zoomTitle')}</span>
            <span>{playing && nextLevel ? t('play.zoomNext', { zoom: zoomText(nextLevel) }) : t('play.zoomFull')}</span>
          </div>
          <div className="zoom-steps">
            {ZOOM_LEVELS.map((level, i) => (
              <span key={level} className={i === shownStep ? 'now' : i < shownStep ? 'past' : ''}>
                <i />
                <b>×{zoomText(level)}</b>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="play-main">
        {!over && (
          <div className="play-card shot-copy">
            <h2>{t('play.imageTitle')}</h2>
            <p>{t('play.imagePrompt')}</p>
          </div>
        )}

        {playing && <CharacterSearch game={game} exclude={exclude} active={active} busy={busy} onPick={guess} compact />}

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
            mode="image"
            nextAt={round.nextAt}
            compact
          />
        )}

        {round && over && answer && !skipped && (
          <ShareResult caption={l(game.label)} tiles={tiles} summary={shareSummary} won={won} />
        )}

        {round?.daily && yesterday && <Yesterday game={game} entity={yesterday} />}

        <div className="tries">
          <span className="play-card-title">{t('play.tries')}</span>
          {guesses.length === 0 ? (
            <p className="tries-empty">{t(over ? 'play.noTriesOver' : 'play.noTries')}</p>
          ) : (
            <div className="tries-list">
              {guesses.map(({ entity: g, pending }, i) => {
                const hit = won && g.id === answer?.id
                return (
                  <div key={g.id} className={`try ${pending ? 'pending' : hit ? 'hit' : 'miss'}`}>
                    <Thumb game={game} entity={g} size={36} />
                    <span className="try-name">{name(g)}</span>
                    <span className="try-zoom">×{zoomText(levelAt(guesses.length - 1 - i))}</span>
                    {!pending && <span className="try-verdict">{t(hit ? 'play.hit' : 'play.miss')}</span>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <PlaySide game={game} mode="image" daily={daily} stats={stats} playing={playing} howto="image" onGiveUp={giveUp} />
    </section>
  )
}
