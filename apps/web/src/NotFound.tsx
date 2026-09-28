'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { GameMeta } from './games/meta'
import { useI18n } from './i18n'
import { SearchIcon } from './icons'
import { useHref } from './router'
import { searchGames } from './search'

export default function NotFound({ games }: { games: GameMeta[] }) {
  const { t, l } = useI18n()
  const href = useHref()
  const [query, setQuery] = useState('')
  const found = useMemo(() => searchGames(games, query) ?? [], [games, query])

  return (
    <main className="oops">
      <p className="oops-mark" aria-hidden>
        <span>4</span>
        <span className="oops-hole">
          <i>?</i>
        </span>
        <span>4</span>
      </p>

      <p className="oops-lead muted">{t('oops.lead')}</p>

      <label className="oops-search">
        <SearchIcon />
        <input
          type="search"
          placeholder={t('oops.search')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => event.key === 'Escape' && setQuery('')}
          autoComplete="off"
        />
      </label>

      {query.trim().length > 0 && (
        <div className="oops-results">
          {found.length ? (
            <ul>
              {found.slice(0, 6).map((game) => (
                <li key={game.id}>
                  <Link href={href.play(game.id, game.modes[0])} style={{ '--game': game.accent } as React.CSSProperties}>
                    <i />
                    {l(game.label)}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">{t('oops.empty', { query })}</p>
          )}
        </div>
      )}

      <Link className="primary oops-home" href={href.home}>
        {t('oops.home')}
      </Link>
    </main>
  )
}
