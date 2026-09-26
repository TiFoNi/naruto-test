import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Thumb from './Thumb'
import type { Entity, Game } from './games/types'
import { ruToUk, useI18n } from './i18n'
import { normalize } from './util'
import { ArrowIcon, SearchIcon } from './icons'

const LIMIT = 8

type Props = {
  game: Game
  exclude: Set<number>
  busy?: boolean
  compact?: boolean
  onPick: (e: Entity) => void
}

export default function CharacterSearch({ game, exclude, busy = false, compact = false, onPick }: Props) {
  const { t, name, alt } = useI18n()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const list = useRef<HTMLUListElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const [place, setPlace] = useState<{ up: boolean; max: number }>({ up: false, max: 400 })

  const index = useMemo(
    () =>
      game.entities.map((e) => ({
        e,
        terms: [e.name, ruToUk(e.name), e.nameEn, e.aliases].filter((s): s is string => !!s).map(normalize),
      })),
    [game, game.entities],
  )

  const matches = useMemo(() => {
    const q = normalize(query.trim())
    if (!q) return []
    const rank = ({ e, terms }: (typeof index)[number]) => {
      const tier = terms.some((term) => term.startsWith(q))
        ? 0
        : terms.some((term) => term.split(/[\s-]+/).some((w) => w.startsWith(q)))
          ? 1
          : terms.some((term) => term.includes(q))
            ? 2
            : -1
      return tier < 0 ? -1 : tier * 2 + (e.answer ? 0 : 1)
    }
    return index
      .filter(({ e }) => !exclude.has(e.id))
      .map((x) => ({ x, r: rank(x) }))
      .filter(({ r }) => r >= 0)
      .sort((a, b) => a.r - b.r)
      .slice(0, LIMIT)
      .map(({ x }) => x.e)
  }, [query, exclude, index])

  const open = matches.length > 0

  useLayoutEffect(() => {
    if (!open) return
    let frame = 0

    const fit = () => {
      frame = 0
      const rect = box.current?.getBoundingClientRect()
      if (!rect) return
      const gap = 12
      const below = window.innerHeight - rect.bottom - gap
      const above = rect.top - gap
      const up = below < 220 && above > below
      const max = Math.max(120, Math.min(400, up ? above : below))
      setPlace((current) => (current.up === up && current.max === max ? current : { up, max }))
    }

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(fit)
    }

    fit()
    window.addEventListener('resize', schedule)
    window.addEventListener('scroll', schedule, { passive: true })
    return () => {
      window.removeEventListener('resize', schedule)
      window.removeEventListener('scroll', schedule)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [open])

  useEffect(() => {
    list.current?.children[active]?.scrollIntoView({ block: 'nearest' })
  }, [active])

  useEffect(() => {
    list.current?.scrollTo({ top: 0 })
  }, [query])

  const pick = (e: Entity | undefined) => {
    if (!e || busy) return
    onPick(e)
    setQuery('')
    setActive(0)
  }

  return (
    <div className={`search ${compact ? 'compact' : ''}`}>
      <div className="search-row">
      <div className="search-box" ref={box}>
        <SearchIcon />
        <input
          value={query}
          placeholder={t(game.unit === 'hero' ? 'play.searchHero' : 'play.searchCharacter')}
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
            } else if (e.key === 'PageDown') {
              e.preventDefault()
              setActive((a) => Math.min(a + 5, matches.length - 1))
            } else if (e.key === 'PageUp') {
              e.preventDefault()
              setActive((a) => Math.max(a - 5, 0))
            } else if (e.key === 'Escape') {
              setQuery('')
            }
          }}
        />
        {!compact && <span className="search-left">{t('play.left', { count: game.entities.length - exclude.size })}</span>}
      </div>
      <button className="send" aria-label={t('play.guess')} disabled={!matches.length || busy} onClick={() => pick(matches[active])}>
        {compact ? <ArrowIcon /> : <>{t('play.guess')} <ArrowIcon /></>}
      </button>
      </div>
      {matches.length > 0 && (
        <ul className={`suggestions ${place.up ? 'up' : ''}`} ref={list} style={{ maxHeight: place.max }}>
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
                {name(e)}
                {alt(e) && <small>{alt(e)}</small>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
