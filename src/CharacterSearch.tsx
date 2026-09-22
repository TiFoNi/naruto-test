import { useEffect, useMemo, useRef, useState } from 'react'
import Thumb from './Thumb'
import type { Entity, Game } from './games/types'
import { normalize } from './util'

type Props = {
  game: Game
  exclude: Set<number>
  active: boolean
  onPick: (e: Entity) => void
}

export default function CharacterSearch({ game, exclude, active: visible, onPick }: Props) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (visible) input.current?.focus()
  }, [visible])

  const index = useMemo(
    () => game.entities.map((e) => ({ e, terms: game.searchTerms(e).map(normalize) })),
    [game],
  )

  const matches = useMemo(() => {
    const q = normalize(query.trim())
    if (!q) return []
    const available = index.filter(({ e }) => !exclude.has(e.id))
    const starts = available.filter(({ terms }) => terms.some((t) => t.split(/[\s-]+/).some((w) => w.startsWith(q))))
    const contains = available.filter((x) => !starts.includes(x) && x.terms.some((t) => t.includes(q)))
    return [...starts, ...contains].slice(0, 8).map(({ e }) => e)
  }, [query, exclude, index])

  const pick = (e: Entity | undefined) => {
    if (!e) return
    onPick(e)
    setQuery('')
    setActive(0)
  }

  return (
    <div className="search">
      <div className="search-box">
        <input
          ref={input}
          value={query}
          placeholder={game.placeholder}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActive((a) => Math.min(a + 1, matches.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((a) => Math.max(a - 1, 0))
            } else if (e.key === 'Enter') {
              pick(matches[active])
            } else if (e.key === 'Escape') {
              setQuery('')
            }
          }}
        />
        <button className="send" disabled={!matches.length} onClick={() => pick(matches[active])}>
          ➤
        </button>
      </div>
      {matches.length > 0 && (
        <ul className="suggestions">
          {matches.map((e, i) => (
            <li
              key={e.id}
              className={i === active ? 'active' : ''}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(ev) => {
                ev.preventDefault()
                pick(e)
              }}
            >
              <Thumb game={game} entity={e} size={44} />
              <span className="suggestion-name">
                {e.name}
                {game.subtitle(e) && <small>{game.subtitle(e)}</small>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
