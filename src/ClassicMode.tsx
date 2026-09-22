import { useEffect, useMemo, useState } from 'react'
import CharacterSearch from './CharacterSearch'
import RoundResult from './RoundResult'
import Thumb from './Thumb'
import type { Entity, Game } from './games/types'
import { useI18n } from './i18n'
import type { Stats } from './stats'
import { pickAnswer, preload } from './util'

const sizeClass = (text: string) => (text.length > 44 ? 'size-xs' : text.length > 26 ? 'size-s' : '')

type Props = { game: Game; active: boolean; onSolved: (guesses: number) => void; onGaveUp: () => void; stats: Stats }

export default function ClassicMode({ game, active, onSolved, onGaveUp, stats }: Props) {
  const { t, l, tv, lang, name } = useI18n()
  const [answer, setAnswer] = useState(() => pickAnswer(game))
  const [guesses, setGuesses] = useState<Entity[]>([])
  const [gaveUp, setGaveUp] = useState(false)

  const won = guesses[0]?.id === answer.id
  const over = won || gaveUp
  const exclude = useMemo(() => new Set(guesses.map((g) => g.id)), [guesses])

  useEffect(() => preload(game, answer), [game, answer])

  const guess = (e: Entity) => {
    if (over) return
    const next = [e, ...guesses]
    setGuesses(next)
    if (e.id === answer.id) onSolved(next.length)
  }

  const nextRound = () => {
    setAnswer(pickAnswer(game))
    setGuesses([])
    setGaveUp(false)
  }

  const legend = game.legend === 'debut' ? (['legend.debutLater', 'legend.debutEarlier'] as const) : (['legend.higher', 'legend.lower'] as const)

  return (
    <section className="mode">
      <div className="card intro">
        <h2>{t('play.classicTitle')}</h2>
        <p className="muted">{t('play.classicPrompt')}</p>
        <p className="round">{t('play.round', { round: stats.solved + (won ? 0 : 1), guesses: guesses.length })}</p>
      </div>

      {over ? (
        <RoundResult game={game} answer={answer} guesses={guesses.length} won={won} stats={stats} onNext={nextRound} />
      ) : (
        <>
          <CharacterSearch game={game} exclude={exclude} active={active} onPick={guess} />
          {guesses.length >= 3 && (
            <button
              className="link-button"
              onClick={() => {
                setGaveUp(true)
                onGaveUp()
              }}
            >
              {t('play.giveUp')}
            </button>
          )}
        </>
      )}

      {guesses.length > 0 && (
        <div className="grid-scroll">
          <div className="grid" style={{ ['--cols' as string]: game.columns.length + 1 }}>
            <div className="grid-row header">
              <div>{t(game.unit === 'hero' ? 'play.hero' : 'play.character')}</div>
              {game.columns.map((c) => (
                <div key={c.title.en}>{l(c.title)}</div>
              ))}
            </div>
            {guesses.map((g) => (
              <div className="grid-row" key={g.id}>
                <div className="cell portrait" title={name(g)}>
                  <Thumb game={game} entity={g} className="portrait-thumb" />
                  <span className="portrait-name">{name(g)}</span>
                </div>
                {game.columns.map((col, i) => {
                  const r = col.render(g, answer, { tv, lang })
                  return (
                    <div
                      key={col.title.en}
                      title={r.text}
                      className={`cell ${r.verdict} ${sizeClass(r.text)}`}
                      style={{ animationDelay: `${(i + 1) * 0.25}s` }}
                    >
                      {r.icons?.length ? (
                        <div className="icons">
                          {r.icons.map((icon) => (
                            <i key={icon.label} title={icon.label} style={{ background: icon.color }} className={icon.dark ? 'dark' : ''}>
                              {icon.symbol}
                            </i>
                          ))}
                          {r.icons.length === 1 && <span className="icon-label">{r.icons[0].label}</span>}
                        </div>
                      ) : (
                        <span>{r.text}</span>
                      )}
                      {r.arrow && (
                        <b className="arrow" aria-label={t(r.arrow === 'up' ? legend[0] : legend[1])}>
                          {r.arrow === 'up' ? '↑' : '↓'}
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
