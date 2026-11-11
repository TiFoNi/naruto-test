'use client'

import { useRef, type CSSProperties, type PointerEvent } from 'react'
import { BANNER_LIFT_MAX, BANNER_ZOOM_MAX, type BannerLook } from '@nanda/game'
import { focusFit, focusRange } from './BannerArt'
import { useI18n } from './i18n'
import { CheckIcon, CloseIcon, DownIcon, RefreshIcon, TrophyIcon, UpIcon, ZoomInIcon, ZoomOutIcon } from './icons'

const ZOOM_STEP = 0.25

const LIFT_STEP = 20

const ART = '.profile-glow > :is(img, video)'

const within = (value: number, range: number[] | null, still: number) => (range ? Math.min(range[1] ?? 100, Math.max(range[0] ?? 0, value)) : still)

export default function BannerFrame({
  look,
  busy,
  onChange,
  onReset,
  onBoard,
  onCancel,
  onSave,
}: {
  look: BannerLook
  busy: boolean
  onChange: (next: BannerLook) => void
  onReset: () => void
  onBoard: () => void
  onCancel: () => void
  onSave: () => void
}) {
  const { l } = useI18n()
  const grab = useRef<{ x: number; y: number; from: BannerLook } | null>(null)
  const surface = useRef<HTMLDivElement>(null)

  const fitOf = (next: BannerLook) => focusFit(surface.current?.parentElement?.querySelector(ART) ?? null, next)

  const settle = (next: BannerLook, from: BannerLook = next) => {
    const fit = fitOf(next)
    if (!fit) return next
    return { ...next, x: within(next.x, focusRange(fit.boxW, fit.w), from.x), y: within(next.y, focusRange(fit.boxH, fit.h), from.y) }
  }

  const press = (event: PointerEvent<HTMLDivElement>) => {
    grab.current = { x: event.clientX, y: event.clientY, from: settle(look) }
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      grab.current = null
    }
  }

  const move = (event: PointerEvent<HTMLDivElement>) => {
    const start = grab.current
    if (!start) return
    const size = fitOf(start.from)
    if (!size) return
    const zoom = Number(getComputedStyle(document.body).getPropertyValue('--page-zoom')) || 1
    const dx = (event.clientX - start.x) / zoom
    const dy = (event.clientY - start.y) / zoom
    const tall = focusRange(size.boxH, size.h) !== null
    const next = settle(
      {
        ...start.from,
        x: start.from.x - (dx / size.w) * 100,
        y: start.from.y - (dy / size.h) * 100,
      },
      start.from,
    )
    onChange(tall ? next : { ...next, lift: Math.round(Math.min(BANNER_LIFT_MAX, Math.max(0, (start.from.lift ?? 0) - dy))) })
  }

  const release = () => {
    grab.current = null
  }

  const zoom = (value: number) => onChange(settle({ ...look, z: Math.min(BANNER_ZOOM_MAX, Math.max(1, Math.round(value * 100) / 100)) }, look))

  const lift = look.lift ?? 0

  const raise = (value: number) => onChange({ ...look, lift: Math.min(BANNER_LIFT_MAX, Math.max(0, value)) })

  const drag = { onPointerDown: press, onPointerMove: move, onPointerUp: release, onPointerCancel: release }

  return (
    <>
      <div
        ref={surface}
        className="frame-surface"
        {...drag}
        role="presentation"
      >
        <span className="frame-hint">{l({ ru: 'Тяни фон, чтобы выбрать кадр', uk: 'Тягни фон, щоб вибрати кадр', en: 'Drag the background to frame it' })}</span>
      </div>
      <div className="frame-bar">
        <div className="look-zoom">
          <button type="button" className="look-step" aria-label={l({ ru: 'Отдалить', uk: 'Віддалити', en: 'Zoom out' })} disabled={look.z <= 1} onClick={() => zoom(look.z - ZOOM_STEP)}>
            <ZoomOutIcon />
          </button>
          <input
            type="range"
            min={1}
            max={BANNER_ZOOM_MAX}
            step={0.05}
            value={look.z}
            aria-label={l({ ru: 'Приближение', uk: 'Наближення', en: 'Zoom' })}
            style={{ '--fill': `${((look.z - 1) / (BANNER_ZOOM_MAX - 1)) * 100}%` } as CSSProperties}
            onChange={(event) => zoom(Number(event.target.value))}
          />
          <button type="button" className="look-step" aria-label={l({ ru: 'Приблизить', uk: 'Наблизити', en: 'Zoom in' })} disabled={look.z >= BANNER_ZOOM_MAX} onClick={() => zoom(look.z + ZOOM_STEP)}>
            <ZoomInIcon />
          </button>
        </div>
        <i className="frame-sep" aria-hidden />
        <div className="frame-tools">
          <button
            type="button"
            className="frame-tool"
            disabled={busy || lift >= BANNER_LIFT_MAX}
            title={l({ ru: 'Фон выше', uk: 'Фон вище', en: 'Move background up' })}
            aria-label={l({ ru: 'Фон выше', uk: 'Фон вище', en: 'Move background up' })}
            onClick={() => raise(lift + LIFT_STEP)}
          >
            <UpIcon />
          </button>
          <button
            type="button"
            className="frame-tool"
            disabled={busy || lift <= 0}
            title={l({ ru: 'Фон ниже', uk: 'Фон нижче', en: 'Move background down' })}
            aria-label={l({ ru: 'Фон ниже', uk: 'Фон нижче', en: 'Move background down' })}
            onClick={() => raise(lift - LIFT_STEP)}
          >
            <DownIcon />
          </button>
        </div>
        <i className="frame-sep" aria-hidden />
        <div className="frame-tools">
          <button type="button" className="frame-tool" disabled={busy} title={l({ ru: 'Сбросить', uk: 'Скинути', en: 'Reset' })} aria-label={l({ ru: 'Сбросить', uk: 'Скинути', en: 'Reset' })} onClick={onReset}>
            <RefreshIcon />
          </button>
          <button
            type="button"
            className="frame-tool"
            disabled={busy}
            title={l({ ru: 'Кадр в лидерах', uk: 'Кадр у лідерах', en: 'Leaderboard frame' })}
            aria-label={l({ ru: 'Кадр в лидерах', uk: 'Кадр у лідерах', en: 'Leaderboard frame' })}
            onClick={onBoard}
          >
            <TrophyIcon />
          </button>
        </div>
        <i className="frame-sep" aria-hidden />
        <div className="look-actions frame-acts">
          <button type="button" className="ghost look-icon" disabled={busy} aria-label={l({ ru: 'Отмена', uk: 'Скасувати', en: 'Cancel' })} onClick={onCancel}>
            <CloseIcon />
            <span>{l({ ru: 'Отмена', uk: 'Скасувати', en: 'Cancel' })}</span>
          </button>
          <button type="button" className="primary look-icon" disabled={busy} aria-label={l({ ru: 'Сохранить', uk: 'Зберегти', en: 'Save' })} onClick={onSave}>
            <CheckIcon />
            <span>{l({ ru: 'Сохранить', uk: 'Зберегти', en: 'Save' })}</span>
          </button>
        </div>
      </div>
    </>
  )
}
