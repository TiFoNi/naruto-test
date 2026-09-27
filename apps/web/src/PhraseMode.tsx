import CharacterSearch from './CharacterSearch'
import PhraseColumn from './PhraseColumn'
import TriesList from './TriesList'
import PlayBoard from './PlayBoard'
import PlaySide from './PlaySide'
import RoundResult from './RoundResult'
import RoundStatus from './RoundStatus'
import Yesterday from './Yesterday'
import type { Game } from './games/types'
import { useI18n } from './i18n'
import { ArrowIcon } from './icons'
import type { Stats } from './stats'
import { useRound } from './useRound'

type Props = { game: Game; active: boolean; stats: Stats; daily?: boolean; challenge?: string }

export default function PhraseMode({ game, active, stats, daily = false, challenge }: Props) {
  const { t } = useI18n()
  const { round, guesses, exclude, over, won, skipped, answer, yesterday, busy, error, guess, giveUp, next, retry } = useRound(
    game,
    'phrase',
    active,
    daily,
    challenge,
  )
  const playing = !!round && !over
  const scored = !skipped || over
  const phrases = round?.phrases ?? []
  const voiceAt = round?.voiceAt ?? 3
  const voiceLeft = Math.max(voiceAt - phrases.length, 0)
  const mood = over ? (won ? 'won' : 'lost') : 'ask'

  const headline = over
    ? t(won ? 'phrase.headlineWon' : 'phrase.headlineLost')
    : t('play.phraseTitle')
  const subline = over
    ? t(won ? 'phrase.wonHint' : 'phrase.lostHint', { count: guesses.length })
    : t('play.phrasePrompt')

  return (
    <PlayBoard
      variant="phrase"
      side={<PlaySide game={game} mode="phrase" daily={daily} stats={stats} playing={playing} howto="phrase" onGiveUp={giveUp} />}
      media={
        <PhraseColumn lines={phrases} left={round?.phrasesLeft ?? 0} voiceLeft={voiceLeft} voice={round?.voice} resetKey={round?.id} over={over} />
      }
    >
      <div className={`play-card mode-ask state-${mood}`}>
        <h2>{headline}</h2>
        <p>{subline}</p>
      </div>

      {!over && !error && <CharacterSearch game={game} exclude={exclude} busy={busy || !round} onPick={guess} compact />}

      {over && !scored && (
        <button type="button" className="primary mode-next" onClick={next}>
          {t('ability.next')}
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
          mode="phrase"
          nextAt={round.nextAt}
          compact
        />
      )}

      {round?.daily && yesterday && <Yesterday game={game} entity={yesterday} />}

      <TriesList game={game} guesses={guesses} answerId={answer?.id} over={over} meta={() => ''} />
    </PlayBoard>
  )
}
