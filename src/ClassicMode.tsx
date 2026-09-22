import { useEffect, useMemo, useState } from 'react'
import CharacterSearch from './CharacterSearch'
import RoundResult from './RoundResult'
import Thumb from './Thumb'
import type { Entity, Game } from './games/types'
import type { Stats } from './storage'
import { pickAnswer, preload } from './util'

const sizeClass = (text: string) => (text.length > 44 ? 'size-xs' : text.length > 26 ? 'size-s' : '')

type Props = { game: Game; active: boolean; onSolved: (guesses: number) => void; onGaveUp: () => void; stats: Stats }

export default function ClassicMode({ game, active, onSolved, onGaveUp, stats }: Props) {
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

  return (
    <section className="mode">
      <div className="panel intro">
        <h2>{game.classic.title}</h2>
        <p>{game.classic.prompt}</p>
        <p className="muted">
          Раунд {stats.solved + (won ? 0 : 1)} · попыток: {guesses.length}
        </p>
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
              Сдаюсь, покажи ответ
            </button>
          )}
        </>
      )}

      {guesses.length > 0 && (
        <div className="grid-scroll">
          <div className="grid" style={{ ['--cols' as string]: game.columns.length + 1 }}>
            <div className="grid-row header">
              <div>{game.id === 'dota' ? 'Герой' : 'Персонаж'}</div>
              {game.columns.map((c) => (
                <div key={c.title}>{c.title}</div>
              ))}
            </div>
            {guesses.map((g) => (
              <div className="grid-row" key={g.id}>
                <div className="cell portrait" title={g.name}>
                  <Thumb game={game} entity={g} className="portrait-thumb" />
                  <span className="portrait-name">{g.name}</span>
                </div>
                {game.columns.map((col, i) => {
                  const r = col.render(g, answer)
                  return (
                    <div
                      key={col.title}
                      title={r.text}
                      className={`cell ${r.verdict} ${r.arrow ? `arrow-${r.arrow}` : ''} ${sizeClass(r.text)}`}
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
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="panel legend">
        <h3>Цвета</h3>
        <div className="legend-items">
          <div><span className="swatch correct" />Верно</div>
          <div><span className="swatch partial" />Частично</div>
          <div><span className="swatch wrong" />Неверно</div>
          <div><span className="swatch wrong arrow-up" />{game.legend.up}</div>
          <div><span className="swatch wrong arrow-down" />{game.legend.down}</div>
        </div>
      </div>
    </section>
  )
}
