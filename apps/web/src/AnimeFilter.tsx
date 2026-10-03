'use client'

import { useEffect, useState } from 'react'
import { useAnimeOnly } from './anime'
import type { Game } from './games/types'
import { useI18n } from './i18n'

const memory = (game: string) => `anime-world:${game}`

const remembered = (game: string) => {
  try {
    return localStorage.getItem(memory(game)) === '1'
  } catch {
    return false
  }
}

export default function AnimeFilter({ game, daily }: { game: Game; daily?: boolean }) {
  const { t } = useI18n()
  const [on, set] = useAnimeOnly(game.id)
  const [known, setKnown] = useState(() => (typeof window === 'undefined' ? false : remembered(game.id)))

  const loaded = game.entities.length > 0
  const mixed = loaded ? game.entities.some((one) => one.anime === false) : known

  useEffect(() => {
    if (!loaded) return
    try {
      localStorage.setItem(memory(game.id), mixed ? '1' : '0')
    } catch {
      return
    }
    setKnown(mixed)
  }, [game.id, loaded, mixed])

  if (daily || !mixed) return null

  return (
    <label className="anime-filter" title={t('anime.hint')}>
      <input type="checkbox" checked={on} suppressHydrationWarning onChange={(event) => set(event.target.checked)} />
      <span>{t('anime.only')}</span>
    </label>
  )
}
