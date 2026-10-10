'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Avatar from './Avatar'
import { api } from './api'
import { useAuth } from './auth'
import { FRAMES } from './frames'
import { useI18n } from './i18n'
import { ChevronIcon, CloseIcon } from './icons'

export default function FramePicker() {
  const { user, refresh } = useAuth()
  const { l } = useI18n()
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) return
    const key = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [open])

  const owned = FRAMES.filter((one) => user?.frames.includes(one.id))
  if (!user || !owned.length) return null

  const pick = async (frame: string | null) => {
    setBusy(true)
    const { ok } = await api('profile', { action: 'frame', frame })
    if (ok) await refresh()
    setBusy(false)
    setOpen(false)
  }

  const title = l({ ru: 'Рамка', uk: 'Рамка', en: 'Frame' })

  return (
    <>
      <button type="button" className="frame-open" onClick={() => setOpen(true)}>
        <span className="frame-open-text">
          <b>{title}</b>
          <small>
            {user.frame
              ? l(owned.find((one) => one.id === user.frame)?.label ?? { ru: '', uk: '', en: '' })
              : l({ ru: 'не выбрана', uk: 'не вибрана', en: 'none' })}
          </small>
        </span>
        <ChevronIcon className="frame-open-arrow" />
      </button>

      {open &&
        mounted &&
        createPortal(
          <div className="modal-backdrop" onClick={() => setOpen(false)} role="presentation">
            <section
              className="card modal frame-modal"
              role="dialog"
              aria-modal="true"
              aria-label={title}
              onClick={(event) => event.stopPropagation()}
            >
              <button type="button" className="modal-close" onClick={() => setOpen(false)} aria-label={l({ ru: 'Закрыть', uk: 'Закрити', en: 'Close' })}>
                <CloseIcon />
              </button>
              <h2>{title}</h2>

              {(['award', 'world', 'other'] as const).map((kind, index, kinds) => {
                const list = owned.filter((one) => one.kind === kind)
                if (!list.length) return null
                const first = kinds.slice(0, index).every((before) => !owned.some((one) => one.kind === before))

                return (
                  <section key={kind} className="frame-group">
                    <h3>
                      {kind === 'award'
                        ? l({ ru: 'Награды', uk: 'Нагороди', en: 'Awards' })
                        : kind === 'world'
                          ? l({ ru: 'Вселенные', uk: 'Всесвіти', en: 'Worlds' })
                          : l({ ru: 'Другое', uk: 'Інше', en: 'Other' })}
                    </h3>
                    <div className="frame-grid">
                      {first && (
                        <button type="button" className={`frame-card ${user.frame ? '' : 'on'}`} disabled={busy} onClick={() => void pick(null)}>
                          <Avatar id={user.id} name={user.nickname} avatar={user.avatar} />
                          <span>{l({ ru: 'Без рамки', uk: 'Без рамки', en: 'No frame' })}</span>
                        </button>
                      )}
                      {list.map((one) => (
                        <button
                          key={one.id}
                          type="button"
                          className={`frame-card ${user.frame === one.id ? 'on' : ''}`}
                          disabled={busy}
                          onClick={() => void pick(one.id)}
                        >
                          <Avatar id={user.id} name={user.nickname} avatar={user.avatar} frame={one.id} />
                          <span>{l(one.label)}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                )
              })}

            </section>
          </div>,
          document.body,
        )}
    </>
  )
}
