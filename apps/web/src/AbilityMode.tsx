import AbilityIcon from './AbilityIcon'
import CharacterSearch from './CharacterSearch'
import PlayPanel from './PlayPanel'
import PlaySide from './PlaySide'
import RoundResult from './RoundResult'
import RoundStatus from './RoundStatus'
import Thumb from './Thumb'
import Yesterday from './Yesterday'
import type { Game } from './games/types'
import { useI18n } from './i18n'
import type { Stats } from './stats'
import { useRound } from './useRound'
import { apiSrc } from './api'

type Props = { game: Game; active: boolean; stats: Stats; daily?: boolean; challenge?: string }

export default function AbilityMode({ game, active, stats, daily = false, challenge }: Props) {
  const { t, name, lang } = useI18n()
  const { round, guesses, exclude, over, won, skipped, answer, yesterday, busy, error, guess, giveUp, next, retry } = useRound(
    game,
    'ability',
    active,
    daily,
    challenge,
  )

  const wrong = guesses.filter((g) => !g.pending).length - (won ? 1 : 0)
  const src = round?.image ? `${apiSrc(round.image)}&v=${over ? 'done' : wrong}` : null
  const hintIn = round?.hintAt !== undefined ? round.hintAt - wrong : 0


  const playing = !!round && !over
  const hint = round?.ability
    ? `${t(over ? 'ability.was' : 'ability.hint')} ${round.ability[lang]}`
    : round && !over && hintIn > 0
      ? t('ability.hintIn', { count: hintIn })
      : t('play.abilityPrompt')

  return (
    <section className="play-layout">
      <div className="play-main">
        <PlayPanel
          media={<AbilityIcon src={src ?? undefined} resetKey={round?.id} />}
          title={t('play.abilityTitle')}
          hint={hint}
          attempts={guesses.length}
          streak={stats.streak}
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
            mode="ability"
            nextAt={round.nextAt}
          />
        )}

        <div className="guess-list">
          {guesses.map(({ entity: g, pending }) => (
            <div key={g.id} className={`guess-chip ${pending ? 'pending' : won && g.id === answer?.id ? 'correct' : 'wrong'}`}>
              <Thumb game={game} entity={g} size={44} />
              <span>{name(g)}</span>
            </div>
          ))}
        </div>
      </div>

      <PlaySide game={game} mode="ability" daily={daily} stats={stats} playing={playing} onGiveUp={giveUp} />
    </section>
  )
}
