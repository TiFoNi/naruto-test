'use client'

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { BANNER_ZOOM_MAX, type BannerLook, type BannerLooks, type LookPlace } from '@nanda/game'
import { lookStyle } from './BannerArt'
import { api } from './api'
import { useAuth } from './auth'
import { bannerPic } from './banners'
import { useI18n } from './i18n'
import type { L10n } from './i18n/langs'
import { CheckIcon, CloseIcon } from './icons'
import { BOARD_RATIO, STAGE_MIN, STAGE_RATIO, usePhoneRatio } from './ProfileStage'

type Place = { key: LookPlace; aspect: number; start: BannerLook; label: L10n }

const PLACES: Place[] = [
  { key: 'desktop', aspect: STAGE_RATIO, start: { x: 50, y: 28, z: 1 }, label: { ru: 'Профиль', uk: 'Профіль', en: 'Profile' } },
  { key: 'board', aspect: BOARD_RATIO, start: { x: 50, y: 28, z: 1 }, label: { ru: 'Лидеры', uk: 'Лідери', en: 'Leaderboard' } },
]


const clamp = (value: number) => Math.min(100, Math.max(0, value))

export default function BannerTuner({ banner, looks, onClose }: { banner: string; looks: BannerLooks | null; onClose: () => void }) {
  const { l } = useI18n()
  const { refresh } = useAuth()
  const [draft, setDraft] = useState<BannerLooks>(looks ?? {})
  const [current, setCurrent] = useState<LookPlace>('desktop')
  const [busy, setBusy] = useState(false)
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const picture = useRef<HTMLImageElement>(null)
  const grab = useRef<{ x: number; y: number; from: BannerLook; node: HTMLElement } | null>(null)

  const placeOf = (key: LookPlace) => PLACES.find((one) => one.key === key)!
  const aspectOf = (key: LookPlace) => placeOf(key).aspect
  const lookAt = (key: LookPlace) => draft[key] ?? (key === 'board' ? draft.desktop : undefined) ?? placeOf(key).start
  const look = lookAt(current)
  const aspect = aspectOf(current)
  const phoneRatio = usePhoneRatio(STAGE_MIN)
  const solo = current === 'board'

  const setLook = (next: BannerLook) => setDraft((was) => ({ ...was, [current]: next }))

  const measure = (node: HTMLImageElement | null) => {
    if (node?.complete && node.naturalWidth) setNatural({ w: node.naturalWidth, h: node.naturalHeight })
  }

  useEffect(() => measure(picture.current), [])

  const overflow = (node: HTMLElement) => {
    const box = node.getBoundingClientRect()
    if (!natural) return { x: 0, y: 0 }
    const cover = Math.max(box.width / natural.w, box.height / natural.h)
    return { x: natural.w * cover * look.z - box.width, y: natural.h * cover * look.z - box.height }
  }

  const press = (event: PointerEvent<HTMLElement>) => {
    grab.current = { x: event.clientX, y: event.clientY, from: look, node: event.currentTarget }
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      grab.current = null
    }
  }

  const move = (event: PointerEvent<HTMLElement>) => {
    const start = grab.current
    if (!start) return
    const room = overflow(start.node)
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    setLook({
      ...start.from,
      x: room.x > 1 ? clamp(start.from.x - (dx / room.x) * 100) : start.from.x,
      y: room.y > 1 ? clamp(start.from.y - (dy / room.y) * 100) : start.from.y,
    })
  }

  const release = () => {
    grab.current = null
  }

  const reset = () =>
    setDraft((was) => {
      const next = { ...was }
      delete next[current]
      return next
    })

  const save = async () => {
    setBusy(true)
    const { ok } = await api('profile', { action: 'bannerLook', banner, look: Object.keys(draft).length ? draft : null })
    if (ok) await refresh()
    setBusy(false)
    if (ok) onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <section
        className="card modal look-modal"
        role="dialog"
        aria-modal="true"
        aria-label={l({ ru: 'Настройка фона', uk: 'Налаштування фону', en: 'Background setup' })}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="modal-close" aria-label={l({ ru: 'Закрыть', uk: 'Закрити', en: 'Close' })} onClick={onClose}>
          <CloseIcon />
        </button>

        <h2>{l({ ru: 'Настройка фона', uk: 'Налаштування фону', en: 'Background setup' })}</h2>
        <p className="look-lead">
          {l({
            ru: 'Перетащи картинку, чтобы выбрать, что останется в кадре.',
            uk: 'Перетягни картинку, щоб вибрати, що лишиться в кадрі.',
            en: 'Drag the picture to choose what stays in view.',
          })}
        </p>

        <div className="look-tabs" role="tablist">
          {PLACES.map((place) => (
            <button
              key={place.key}
              type="button"
              role="tab"
              aria-selected={current === place.key}
              className={current === place.key ? 'on' : ''}
              onClick={() => setCurrent(place.key)}
            >
              {l(place.label)}
            </button>
          ))}
        </div>

        <div className={`look-row ${solo ? '' : 'has-phone'}`}>
          <figure className="look-card">
            <div
              className="look-stage"
              style={{ aspectRatio: String(aspect) }}
              onPointerDown={press}
              onPointerMove={move}
              onPointerUp={release}
              onPointerCancel={release}
              role="presentation"
            >
              <img
                ref={picture}
                src={bannerPic(banner)}
                alt=""
                draggable={false}
                style={lookStyle(banner, look)}
                onLoad={(event) => measure(event.currentTarget)}
              />
            </div>
            {!solo && <figcaption>{l({ ru: 'Компьютер', uk: 'Комп’ютер', en: 'Desktop' })}</figcaption>}
          </figure>

          {!solo && (
            <figure className="look-card look-phone">
              <span
                className="look-frame look-drag"
                style={{ aspectRatio: String(phoneRatio) }}
                onPointerDown={press}
                onPointerMove={move}
                onPointerUp={release}
                onPointerCancel={release}
                role="presentation"
              >
                <img src={bannerPic(banner)} alt="" draggable={false} style={lookStyle(banner, look)} />
              </span>
              <figcaption>{l({ ru: 'Телефон', uk: 'Телефон', en: 'Phone' })}</figcaption>
            </figure>
          )}
        </div>

        <label className="look-zoom">
          <span>{l({ ru: 'Приближение', uk: 'Наближення', en: 'Zoom' })}</span>
          <input
            type="range"
            min={1}
            max={BANNER_ZOOM_MAX}
            step={0.05}
            value={look.z}
            style={{ '--fill': `${((look.z - 1) / (BANNER_ZOOM_MAX - 1)) * 100}%` } as CSSProperties}
            onChange={(event) => setLook({ ...look, z: Number(event.target.value) })}
          />
          <b>×{look.z.toFixed(2).replace(/\.?0+$/, '')}</b>
        </label>

        <div className="look-actions">
          <button type="button" className="ghost" disabled={busy || !draft[current]} onClick={reset}>
            {l({ ru: 'Сбросить', uk: 'Скинути', en: 'Reset' })}
          </button>
          <span />
          <button
            type="button"
            className="ghost look-icon"
            disabled={busy}
            aria-label={l({ ru: 'Отмена', uk: 'Скасувати', en: 'Cancel' })}
            onClick={onClose}
          >
            <CloseIcon />
            <span>{l({ ru: 'Отмена', uk: 'Скасувати', en: 'Cancel' })}</span>
          </button>
          <button
            type="button"
            className="primary look-icon"
            disabled={busy}
            aria-label={l({ ru: 'Сохранить', uk: 'Зберегти', en: 'Save' })}
            onClick={() => void save()}
          >
            <CheckIcon />
            <span>{l({ ru: 'Сохранить', uk: 'Зберегти', en: 'Save' })}</span>
          </button>
        </div>
      </section>
    </div>
  )
}
