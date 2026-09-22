import CharacterSearch from './CharacterSearch'
import RoundResult from './RoundResult'
import RoundStatus from './RoundStatus'
import Thumb from './Thumb'
import type { Game } from './games/types'
import { useI18n } from './i18n'
import type { Stats } from './stats'
import { useRound } from './useRound'

const sizeClass = (text: string) => (text.length > 44 ? 'size-xs' : text.length > 26 ? 'size-s' : '')

type Props = { game: Game; active: boolean; stats: Stats }

export default function ClassicMode({ game, active, stats }: Props) {
  const { t, l, tv, lang, name } = useI18n()
  const { round, guesses, exclude, over, won, skipped, answer, busy, error, guess, giveUp, next, retry } = useRound(game, 'classic', active)

  const legend = game.legend === 'debut' ? (['legend.debutLater', 'legend.debutEarlier'] as const) : (['legend.higher', 'legend.lower'] as const)

  return (
    <section className="mode">
      <div className="card intro">
        <h2>{t('play.classicTitle')}</h2>
        <p className="muted">{t('play.classicPrompt')}</p>
        {round && <p className="round">{t('play.round', { round: round.number, guesses: guesses.length })}</p>}
      </div>

      <RoundStatus loading={!round && !error} error={error} onRetry={retry} />

      {round && over && answer ? (
        <RoundResult game={game} answer={answer} guesses={guesses.length} won={won} skipped={skipped} stats={stats} onNext={next} />
      ) : round ? (
        <>
          <CharacterSearch game={game} exclude={exclude} active={active} busy={busy} onPick={guess} />
          <button className="link-button" onClick={giveUp} disabled={busy}>
            {t('play.giveUp')}
          </button>
        </>
      ) : null}

      {guesses.length > 0 && (
        <div className="grid-scroll">
          <div className="grid" style={{ ['--cols' as string]: game.columns.length + 1 }}>
            <div className="grid-row header">
              <div>{t(game.unit === 'hero' ? 'play.hero' : 'play.character')}</div>
              {game.columns.map((c) => (
                <div key={c.key}>{l(c.title)}</div>
              ))}
            </div>
            {guesses.map(({ entity: g, judgement }) => (
              <div className="grid-row" key={g.id}>
                <div className="cell portrait" title={name(g)}>
                  <Thumb game={game} entity={g} className="portrait-thumb" />
                  <span className="portrait-name">{name(g)}</span>
                </div>
                {game.columns.map((col, i) => {
                  const ctx = { tv, lang }
                  const text = col.text(g, ctx)
                  const icons = col.icons?.(g, ctx) ?? []
                  const verdict = judgement?.[col.key]
                  return (
                    <div
                      key={col.key}
                      title={text}
                      className={`cell ${verdict?.verdict ?? 'wrong'} ${sizeClass(text)}`}
                      style={{ animationDelay: `${(i + 1) * 0.25}s` }}
                    >
                      {icons.length ? (
                        <div className="icons">
                          {icons.map((icon) => (
                            <i key={icon.label} title={icon.label} style={{ background: icon.color }} className={icon.dark ? 'dark' : ''}>
                              {icon.symbol}
                            </i>
                          ))}
                          {icons.length === 1 && <span className="icon-label">{icons[0].label}</span>}
                        </div>
                      ) : (
                        <span>{text}</span>
                      )}
                      {verdict?.arrow && (
                        <b className="arrow" aria-label={t(verdict.arrow === 'up' ? legend[0] : legend[1])}>
                          {verdict.arrow === 'up' ? '↑' : '↓'}
                        </b>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      <ul className="legend">
        <li><span className="swatch correct" />{t('legend.correct')}</li>
        <li><span className="swatch partial" />{t('legend.partial')}</li>
        <li><span className="swatch wrong" />{t('legend.wrong')}</li>
        <li><b className="arrow">↑</b>{t(legend[0])}</li>
        <li><b className="arrow">↓</b>{t(legend[1])}</li>
      </ul>
    </section>
  )
}
