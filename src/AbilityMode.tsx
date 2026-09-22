import { useEffect, useState } from 'react'
import CharacterSearch from './CharacterSearch'
import RoundResult from './RoundResult'
import RoundStatus from './RoundStatus'
import Thumb from './Thumb'
import Yesterday from './Yesterday'
import type { Game } from './games/types'
import { useI18n } from './i18n'
import type { Stats } from './stats'
import { useRound } from './useRound'

type Props = { game: Game; active: boolean; stats: Stats; daily?: boolean }

export default function AbilityMode({ game, active, stats, daily = false }: Props) {
  const { t, name, lang } = useI18n()
  const { round, guesses, exclude, over, won, skipped, answer, yesterday, busy, error, guess, giveUp, next, retry } = useRound(
    game,
    'ability',
    active,
    daily,
  )
  const [loaded, setLoaded] = useState<string | null>(null)

  const wrong = guesses.filter((g) => !g.pending).length - (won ? 1 : 0)
  const src = round?.image ? `${round.image}&v=${over ? 'done' : wrong}` : null
  const hintIn = round?.hintAt !== undefined ? round.hintAt - wrong : 0

  useEffect(() => setLoaded(null), [round?.id])

  return (
    <section className="mode">
      <div className="card intro">
        <h2>{t('play.abilityTitle')}</h2>
        <p className="muted">{t('play.abilityPrompt')}</p>
        <div className="ability-frame">
          {src && loaded !== src && <div className="zoom-loading">{t('image.loading')}</div>}
          {src && <img key={src} src={src} alt="" draggable={false} onLoad={() => setLoaded(src)} style={{ opacity: loaded === src ? 1 : 0 }} />}
        </div>
        {round && (
          <p className="round">
            {t(round.daily ? 'daily.round' : 'play.round', { round: round.number, guesses: guesses.length })}
          </p>
        )}
        {round?.ability ? (
          <p className="ability-hint">
            {t(over ? 'ability.was' : 'ability.hint')} <b>{round.ability[lang]}</b>
          </p>
        ) : (
          round && !over && hintIn > 0 && <p className="muted ability-hint">{t('ability.hintIn', { count: hintIn })}</p>
        )}
        {round?.daily && yesterday && <Yesterday game={game} entity={yesterday} />}
      </div>

      <RoundStatus loading={!round && !error} error={error} onRetry={retry} />

      {round && over && answer ? (
        <RoundResult
          game={game}
          answer={answer}
          guesses={guesses.length}
          won={won}
          skipped={skipped}
          stats={stats}
          onNext={next}
          mode="ability"
          nextAt={round.nextAt}
        />
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
