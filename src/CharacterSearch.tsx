import { useMemo, useState } from 'react'
import Thumb from './Thumb'
import { characters, normalize, type Character } from './data'

type Props = {
  exclude: Set<number>
  disabled?: boolean
  onPick: (c: Character) => void
}

export default function CharacterSearch({ exclude, disabled, onPick }: Props) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  const matches = useMemo(() => {
    const q = normalize(query.trim())
    if (!q) return []
    const available = characters.filter((c) => !exclude.has(c.id))
    const names = (c: Character) => [normalize(c.name), normalize(c.nameEn)]
    const starts = available.filter((c) => names(c).some((n) => n.split(/\s+/).some((w) => w.startsWith(q))))
    const contains = available.filter((c) => !starts.includes(c) && names(c).some((n) => n.includes(q)))
    return [...starts, ...contains].slice(0, 8)
  }, [query, exclude])

  const pick = (c: Character | undefined) => {
    if (!c) return
    onPick(c)
    setQuery('')
    setActive(0)
  }

  return (
    <div className="search">
      <div className="search-box">
        <input
          autoFocus
          disabled={disabled}
          value={query}
          placeholder="Введи имя персонажа…"
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
        <button className="send" disabled={disabled || !matches.length} onClick={() => pick(matches[active])}>
          ➤
        </button>
      </div>
      {matches.length > 0 && (
        <ul className="suggestions">
          {matches.map((c, i) => (
            <li
              key={c.id}
              className={i === active ? 'active' : ''}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault()
                pick(c)
              }}
            >
              <Thumb character={c} size={44} />
              <span className="suggestion-name">
                {c.name}
                <small>{c.nameEn}</small>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
