'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useI18n } from './i18n'
import { CheckIcon, CloseIcon, NextIcon, ZoomInIcon, ZoomOutIcon } from './icons'
import { miniUrl } from './pics'
import type { Entity, Game } from './games/types'

type Props = {
  src?: string
  resetKey?: string | number
  state?: 'won' | 'lost' | ''
  banner?: ReactNode
  note?: ReactNode
  onReady?: (ready: boolean) => void
}


export default function MangaStage({ src, resetKey, state = '', banner, note, onReady }: Props) {
  const { t } = useI18n()
  const [loaded, setLoaded] = useState<string | null>(null)
  const [zoom, setZoom] = useState(false)
  const ready = Boolean(src) && loaded === src

  useEffect(() => setLoaded(null), [src])
  useEffect(() => setZoom(false), [resetKey])
  useEffect(() => onReady?.(ready), [ready, onReady])

  return (
    <div className="manga-stage">
      <div className={`manga-frame ${state}`}>
        {!ready && <div className="zoom-loading">{t('image.loading')}</div>}
        <div className="manga-sheet" style={{ transform: zoom ? 'scale(1.8)' : 'scale(1)' }}>
          {src && (
            <img
              key={src}
              className="manga-page"
              src={src}
              alt={t('play.pageTitle')}
              ref={(el) => {
                if (el?.complete && el.naturalWidth) setLoaded(src)
              }}
              onLoad={() => setLoaded(src)}
              style={{ opacity: ready ? 1 : 0 }}
            />
          )}
        </div>
        {note}
        {banner}
      </div>
      <button type="button" className={`manga-zoom ${zoom ? 'on' : ''}`} aria-pressed={zoom} disabled={!ready} onClick={() => setZoom(!zoom)}>
        {zoom ? <ZoomOutIcon /> : <ZoomInIcon />}
        {t(zoom ? 'page.zoomOut' : 'page.zoomIn')}
      </button>
    </div>
  )
}

export function MangaOptions({
  game,
  options,
  missed,
  waiting,
  answerId,
  over,
  disabled,
  onPick,
}: {
  game: Game
  options: Entity[]
  missed: Set<number>
  waiting?: number
  answerId?: number
  over: boolean
  disabled: boolean
  onPick: (entity: Entity) => void
}) {
  const { t, name, tv } = useI18n()
  const meta = (option: Entity) => {
    const row = option as Entity & { demographic?: string; year?: number }
    return [row.demographic ? tv(row.demographic) : '', row.year ? String(row.year) : ''].filter(Boolean).join(' · ')
  }

  return (
    <div className="manga-options" role="radiogroup" aria-label={t('play.pageTitle')}>
      {options.map((option, index) => {
        const wrong = missed.has(option.id)
        const right = over && answerId === option.id
        const pending = waiting === option.id
        const dim = over && !right && !wrong
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={right || wrong}
            className={`manga-option ${right ? 'right' : wrong ? 'wrong' : dim ? 'dim' : ''} ${pending ? 'waiting' : ''}`}
            disabled={disabled || wrong || pending}
            onClick={() => onPick(option)}
          >
            <span className="manga-key">{index + 1}</span>
            <img className="manga-cover" src={miniUrl(game.id, option.id, option.image)} alt="" loading="lazy" decoding="async" />
            <span className="manga-option-body">
              <b>{name(option)}</b>
              <small>{meta(option)}</small>
            </span>
            <span className="manga-mark">{right ? <CheckIcon /> : wrong ? <CloseIcon /> : <NextIcon />}</span>
          </button>
        )
      })}
    </div>
  )
}
