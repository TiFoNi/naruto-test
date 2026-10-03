'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAnimeOnly } from './anime'
import type { Game } from './games/types'
import { useI18n } from './i18n'

type Props = {
  game: Game
  daily?: boolean
  playing?: boolean
  fresh?: boolean
  roundAnime?: boolean
  onSurrender?: () => void
  onRefilter?: (anime: boolean) => void
}

const memory = (game: string) => `anime-world:${game}`

const remembered = (game: string) => {
  try {
    return localStorage.getItem(memory(game)) === '1'
  } catch {
    return false
  }
}

export default function AnimeFilter({ game, daily, playing = false, fresh = false, roundAnime = false, onSurrender, onRefilter }: Props) {
  const { t } = useI18n()
  const [on, set] = useAnimeOnly(game.id)
  const [known, setKnown] = useState(() => (typeof window === 'undefined' ? false : remembered(game.id)))
  const [asking, setAsking] = useState<boolean | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

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

  useEffect(() => {
    if (asking === null) return
    const key = (event: KeyboardEvent) => event.key === 'Escape' && setAsking(null)
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [asking])

  if (daily || !mixed) return null

  const pick = (next: boolean) => {
    if (playing && roundAnime !== next && !fresh) return setAsking(next)
    set(next)
    if (playing && roundAnime !== next) onRefilter?.(next)
  }

  const confirm = () => {
    if (asking === null) return
    onSurrender?.()
    set(asking)
    setAsking(null)
  }

  return (
    <>
      <label className="anime-filter" title={t('anime.hint')}>
        <input type="checkbox" checked={on} suppressHydrationWarning onChange={(event) => pick(event.target.checked)} />
        <span>{t('anime.only')}</span>
      </label>

      {asking !== null &&
        mounted &&
        createPortal(
          <div className="modal-backdrop" onClick={() => setAsking(null)} role="presentation">
            <section className="card modal ask-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
              <h2>{asking ? t('anime.turnOn') : t('anime.turnOff')}</h2>
              <p>{t('anime.surrender')}</p>
              <div className="ask-actions">
                <button type="button" className="ask-cancel" onClick={() => setAsking(null)}>
                  {t('profile.cancel')}
                </button>
                <button type="button" className="ask-danger" onClick={confirm}>
                  {t('anime.surrenderYes')}
                </button>
              </div>
            </section>
          </div>,
          document.body,
        )}
    </>
  )
}
