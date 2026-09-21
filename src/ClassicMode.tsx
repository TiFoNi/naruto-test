import { useEffect, useMemo, useState } from 'react'
import CharacterSearch from './CharacterSearch'
import RoundResult from './RoundResult'
import Thumb from './Thumb'
import { pickAnswer, preload, type Character } from './data'
import type { Stats } from './storage'

type Verdict = 'correct' | 'partial' | 'wrong'

const EMPTY = 'Нет'

const NATURE_ICONS: Record<string, { kanji: string; color: string }> = {
  Катон: { kanji: '火', color: '#e8542c' },
  Суйтон: { kanji: '水', color: '#2f7fd6' },
  Футон: { kanji: '風', color: '#3aa56b' },
  Дотон: { kanji: '土', color: '#9a6b3a' },
  Райтон: { kanji: '雷', color: '#d6b21f' },
  Инь: { kanji: '陰', color: '#3b2c5c' },
  Ян: { kanji: '陽', color: '#f2efe6' },
}

type Rendered = { verdict: Verdict; text: string; arrow?: 'up' | 'down'; natures?: string[] }

const sizeClass = (text: string) => (text.length > 44 ? 'size-xs' : text.length > 26 ? 'size-s' : '')

function compareLists(guess: string[], answer: string[]): Verdict {
  const a = new Set(answer)
  if (guess.length === answer.length && guess.every((g) => a.has(g))) return 'correct'
  return guess.some((g) => a.has(g)) ? 'partial' : 'wrong'
}

const COLUMNS: { title: string; render: (g: Character, a: Character) => Rendered }[] = [
  {
    title: 'Пол',
    render: (g, a) => ({ verdict: g.gender === a.gender ? 'correct' : 'wrong', text: g.gender }),
  },
  {
    title: 'Принадлеж\u00ADность',
    render: (g, a) => ({ verdict: compareLists(g.affiliations, a.affiliations), text: g.affiliations.join(', ') || EMPTY }),
  },
  {
    title: 'Виды дзюцу',
    render: (g, a) => ({ verdict: compareLists(g.jutsuTypes, a.jutsuTypes), text: g.jutsuTypes.join(', ') || EMPTY }),
  },
  {
    title: 'Кеккей генкай',
    render: (g, a) => ({ verdict: compareLists(g.kekkeiGenkai, a.kekkeiGenkai), text: g.kekkeiGenkai.join(', ') || EMPTY }),
  },
  {
    title: 'Природа чакры',
    render: (g, a) => ({
      verdict: compareLists(g.natureTypes, a.natureTypes),
      text: g.natureTypes.join(', ') || EMPTY,
      natures: g.natureTypes,
    }),
  },
  {
    title: 'Атрибуты',
    render: (g, a) => ({ verdict: compareLists(g.attributes, a.attributes), text: g.attributes.join(', ') || EMPTY }),
  },
  {
    title: 'Дебют',
    render: (g, a) => ({
      verdict: g.arcIndex === a.arcIndex ? 'correct' : 'wrong',
      text: g.arc,
      arrow: g.arcIndex === a.arcIndex ? undefined : a.arcIndex > g.arcIndex ? 'up' : 'down',
    }),
  },
]

type Props = { onSolved: (guesses: number) => void; onGaveUp: () => void; stats: Stats }

export default function ClassicMode({ onSolved, onGaveUp, stats }: Props) {
  const [answer, setAnswer] = useState(pickAnswer)
  const [guesses, setGuesses] = useState<Character[]>([])
  const [gaveUp, setGaveUp] = useState(false)

  const won = guesses[0]?.id === answer.id
  const over = won || gaveUp
  const exclude = useMemo(() => new Set(guesses.map((g) => g.id)), [guesses])

  useEffect(() => preload(answer), [answer])

  const guess = (c: Character) => {
    if (over) return
    const next = [c, ...guesses]
    setGuesses(next)
    if (c.id === answer.id) onSolved(next.length)
  }

  const nextRound = () => {
    setAnswer(pickAnswer())
    setGuesses([])
    setGaveUp(false)
  }

  return (
    <section className="mode">
      <div className="panel intro">
        <h2>Угадай персонажа из «Наруто»</h2>
        <p>Введи любого персонажа — клетки подскажут, насколько ты близко.</p>
        <p className="muted">Раунд {stats.solved + (won ? 0 : 1)} · попыток: {guesses.length}</p>
      </div>

      {over ? (
        <RoundResult answer={answer} guesses={guesses.length} won={won} stats={stats} onNext={nextRound} />
      ) : (
        <>
          <CharacterSearch exclude={exclude} onPick={guess} />
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
          <div className="grid">
            <div className="grid-row header">
              <div>Персонаж</div>
              {COLUMNS.map((c) => (
                <div key={c.title}>{c.title}</div>
              ))}
            </div>
            {guesses.map((g) => (
              <div className="grid-row" key={g.id}>
                <div className="cell portrait" title={g.name}>
                  <Thumb character={g} className="portrait-thumb" />
                  <span className="portrait-name">{g.name}</span>
                </div>
                {COLUMNS.map((col, i) => {
                  const r = col.render(g, answer)
                  return (
                    <div
                      key={col.title}
                      title={r.text}
                      className={`cell ${r.verdict} ${r.arrow ? `arrow-${r.arrow}` : ''} ${sizeClass(r.text)}`}
                      style={{ animationDelay: `${(i + 1) * 0.25}s` }}
                    >
                      {r.natures?.length ? (
                        <div className="natures">
                          {r.natures.map((n) => (
                            <i key={n} style={{ background: NATURE_ICONS[n]?.color }} className={n === 'Ян' ? 'light' : ''}>
                              {NATURE_ICONS[n]?.kanji}
                            </i>
                          ))}
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
          <div><span className="swatch wrong arrow-up" />Дебют позже</div>
          <div><span className="swatch wrong arrow-down" />Дебют раньше</div>
        </div>
      </div>
    </section>
  )
}
