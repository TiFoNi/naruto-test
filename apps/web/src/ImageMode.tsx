import AnimeFilter from './AnimeFilter'
import CharacterSearch from './CharacterSearch'
import PlayBoard, { AskCard } from './PlayBoard'
import PlaySide from './PlaySide'
import TriesList from './TriesList'
import ZoomScale from './ZoomScale'
import RoundResult from './RoundResult'
import RoundStatus from './RoundStatus'
import ZoomImage from './ZoomImage'
import Yesterday from './Yesterday'
import type { Game } from './games/types'
import { useI18n } from './i18n'
import type { Stats } from './stats'
import { useRound } from './useRound'
import { ZOOM_LEVELS, levelAt } from './zoom'

type Props = { game: Game; active: boolean; stats: Stats; daily?: boolean; challenge?: string }


export default function ImageMode({ game, active, stats, daily = false, challenge }: Props) {
  const { t, lang } = useI18n()
  const { round, guesses, exclude, over, won, skipped, answer, yesterday, busy, error, guess, giveUp, next, retry } = useRound(
    game,
    'image',
    active,
    daily,
    challenge,
  )

  const wrong = guesses.length - (won ? 1 : 0)
  const step = Math.min(wrong, ZOOM_LEVELS.length - 1)
  const playing = !!round && !over
  const zoomText = (value: number) => (lang === 'en' ? value.toFixed(1) : value.toFixed(1).replace('.', ','))
  const nextLevel = step < ZOOM_LEVELS.length - 1 ? ZOOM_LEVELS[step + 1] : null
  const shownStep = over ? ZOOM_LEVELS.length - 1 : step

  return (
    <PlayBoard
      variant="shot"
      media={
        <div className="shot-column">
          <div className="shot">
            <ZoomImage game={game} shot={round?.shot} zoom={round?.zoom ?? ZOOM_LEVELS[0]} focus={round?.focus} />
          </div>

          <ZoomScale
            title={t('play.zoomTitle')}
            note={playing && nextLevel ? t('play.zoomNext', { zoom: zoomText(nextLevel) }) : t('play.zoomFull')}
            labels={ZOOM_LEVELS.map((level) => `×${zoomText(level)}`)}
            current={shownStep}
          />
        </div>
      }
      side={<PlaySide game={game} mode="image" daily={daily} stats={stats} playing={playing} howto="image" onGiveUp={giveUp} />}
    >
      {!over && <AskCard title={t('play.imageTitle')} hint={t('play.imagePrompt')} aside={<AnimeFilter game={game} daily={daily} />} />}

      {!over && !error && <CharacterSearch game={game} exclude={exclude} busy={busy || !round} onPick={guess} compact limited={!daily} />}

      <RoundStatus error={error} onRetry={retry} />

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

      {round?.daily && yesterday && <Yesterday game={game} entity={yesterday} />}

      <TriesList
        game={game}
        guesses={guesses}
        answerId={answer?.id}
        over={over}
        meta={(i, list) => `×${zoomText(levelAt(list.length - 1 - i))}`}
      />
    </PlayBoard>
  )
}
