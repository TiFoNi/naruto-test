import Thumb from './Thumb'
import type { Game } from './games/types'
import { useI18n } from './i18n'
import type { Guess } from './useRound'

type Props = { game: Game; guesses: Guess[]; answerId?: number; over: boolean; meta: (index: number, guesses: Guess[]) => string }

export default function TriesList({ game, guesses, answerId, over, meta }: Props) {
  const { t, name } = useI18n()

  return (
    <div className="tries">
      <span className="play-card-title">{t('play.tries')}</span>
      {guesses.length === 0 ? (
        <p className="tries-empty">{t(over ? 'play.noTriesOver' : 'play.noTries')}</p>
      ) : (
        <div className="tries-list">
          {guesses.map(({ entity, pending }, i) => {
            const hit = answerId !== undefined && entity.id === answerId
            return (
              <div key={entity.id} className={`try ${pending ? 'pending' : hit ? 'hit' : 'miss'}`}>
                <Thumb game={game} entity={entity} size={36} />
                <span className="try-name">{name(entity)}</span>
                <span className="try-zoom">{meta(i, guesses)}</span>
                {!pending && <span className="try-verdict">{t(hit ? 'play.hit' : 'play.miss')}</span>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
