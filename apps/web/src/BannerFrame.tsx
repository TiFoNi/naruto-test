'use client'

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { BANNER_ZOOM_MAX, type BannerLook } from '@nanda/game'
import { focusFit, focusRange, placeFocus } from './BannerArt'
import { useI18n } from './i18n'
import { CheckIcon, CloseIcon, RefreshIcon, TrophyIcon, ZoomInIcon, ZoomOutIcon } from './icons'

const ZOOM_STEP = 0.25

export type FrameDevice = 'desktop' | 'phone'

const SCREEN: Record<FrameDevice, { w: number; h: number }> = { desktop: { w: 1440, h: 900 }, phone: { w: 375, h: 812 } }

const ART = '.profile-glow > :is(img, video)'

const within = (value: number, range: number[] | null, still: number) => (range ? Math.min(range[1] ?? 100, Math.max(range[0] ?? 0, value)) : still)

export default function BannerFrame({
  look,
  device,
  here,
  onDevice,
  busy,
  onChange,
  onReset,
  onBoard,
  onCancel,
  onSave,
}: {
  look: BannerLook
  device: FrameDevice
  here: FrameDevice
  onDevice: (next: FrameDevice) => void
  busy: boolean
  onChange: (next: BannerLook) => void
  onReset: () => void
  onBoard: () => void
  onCancel: () => void
  onSave: () => void
}) {
  const { l } = useI18n()
  const grab = useRef<{ x: number; y: number; from: BannerLook } | null>(null)
  const latest = useRef(look)
  latest.current = look
  const surface = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLIFrameElement>(null)
  const bar = useRef<HTMLDivElement>(null)
  const away = device !== here
  const [fit, setFit] = useState(0.3)

  useEffect(() => {
    if (!away) return
    const sync = () => {
      const below = (bar.current?.offsetHeight ?? 160) + 56
      setFit(Math.min(1, (window.innerWidth - 32) / SCREEN[device].w, (window.innerHeight - below - 24) / SCREEN[device].h))
    }
    sync()
    window.addEventListener('resize', sync)
    return () => window.removeEventListener('resize', sync)
  }, [away, device])

  const paint = (tries = 0) => {
    const arts = [...(frame.current?.contentDocument?.querySelectorAll<HTMLElement>(ART) ?? [])]
    if (!arts.length) {
      if (tries < 40) window.setTimeout(() => paint(tries + 1), 250)
      return
    }
    for (const art of arts) {
      placeFocus(art, latest.current)
      art.addEventListener('load', () => placeFocus(art, latest.current), { once: true })
      art.addEventListener('loadedmetadata', () => placeFocus(art, latest.current), { once: true })
    }
  }

  useEffect(() => {
    if (away) paint()
  })

  const fitOf = (next: BannerLook) =>
    focusFit(away ? (frame.current?.contentDocument?.querySelector(ART) ?? null) : (surface.current?.parentElement?.querySelector(ART) ?? null), next)

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
    const scale = away ? fit : 1
    onChange(
      settle(
        {
          ...start.from,
          x: start.from.x - ((event.clientX - start.x) / scale / size.w) * 100,
          y: start.from.y - ((event.clientY - start.y) / scale / size.h) * 100,
        },
        start.from,
      ),
    )
  }

  const release = () => {
    grab.current = null
  }

  const zoom = (value: number) => onChange(settle({ ...look, z: Math.min(BANNER_ZOOM_MAX, Math.max(1, Math.round(value * 100) / 100)) }, look))

  const drag = { onPointerDown: press, onPointerMove: move, onPointerUp: release, onPointerCancel: release }

  return (
    <>
      {away && (
        <div className="frame-away" role="presentation">
          <div className={`frame-device is-${device}`} style={{ width: SCREEN[device].w * fit, height: SCREEN[device].h * fit }}>
            <iframe
              ref={frame}
              src={typeof window === 'undefined' ? undefined : window.location.pathname}
              title={l({ ru: 'Превью профиля', uk: 'Превʼю профілю', en: 'Profile preview' })}
              tabIndex={-1}
              style={{ width: SCREEN[device].w, height: SCREEN[device].h, transform: `scale(${fit})` }}
              onLoad={() => paint()}
            />
            <div className="frame-grip" {...drag}>
              <span className="frame-hint">{l({ ru: 'Тяни фон, чтобы выбрать кадр', uk: 'Тягни фон, щоб вибрати кадр', en: 'Drag the background to frame it' })}</span>
            </div>
          </div>
        </div>
      )}
      <div
        ref={surface}
        className="frame-surface"
        {...drag}
        role="presentation"
      >
        <span className="frame-hint">{l({ ru: 'Тяни фон, чтобы выбрать кадр', uk: 'Тягни фон, щоб вибрати кадр', en: 'Drag the background to frame it' })}</span>
      </div>
      <div className="frame-bar" ref={bar}>
        <div className="look-tabs frame-tabs" role="tablist">
          {(['desktop', 'phone'] as FrameDevice[]).map((one) => (
            <button key={one} type="button" role="tab" aria-selected={device === one} className={device === one ? 'on' : ''} onClick={() => onDevice(one)}>
              {one === 'desktop' ? l({ ru: 'Компьютер', uk: 'Комп’ютер', en: 'Desktop' }) : l({ ru: 'Телефон', uk: 'Телефон', en: 'Phone' })}
            </button>
          ))}
        </div>
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
        <div className="look-actions frame-acts">
          <button type="button" className="look-reset" disabled={busy} title={l({ ru: 'Сбросить', uk: 'Скинути', en: 'Reset' })} aria-label={l({ ru: 'Сбросить', uk: 'Скинути', en: 'Reset' })} onClick={onReset}>
            <RefreshIcon />
          </button>
          <button
            type="button"
            className="look-reset"
            disabled={busy}
            title={l({ ru: 'Кадр в лидерах', uk: 'Кадр у лідерах', en: 'Leaderboard frame' })}
            aria-label={l({ ru: 'Кадр в лидерах', uk: 'Кадр у лідерах', en: 'Leaderboard frame' })}
            onClick={onBoard}
          >
            <TrophyIcon />
          </button>
          <span />
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
