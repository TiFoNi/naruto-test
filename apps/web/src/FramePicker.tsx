'use client'

import { useState } from 'react'
import Avatar from './Avatar'
import { api } from './api'
import { useAuth } from './auth'
import { FRAMES } from './frames'
import { useI18n } from './i18n'
import { FRAME_RARITY, RARITIES } from '@nanda/game'

const rank = (id: string) => {
  const spot = RARITIES.indexOf(FRAME_RARITY[id])
  return spot < 0 ? -1 : RARITIES.length - spot
}

export default function FramePicker() {
  const { user, refresh } = useAuth()
  const { l } = useI18n()
  const [busy, setBusy] = useState(false)

  const owned = FRAMES.filter((one) => user?.frames.includes(one.id)).sort((a, b) => rank(a.id) - rank(b.id))
  if (!user || !owned.length) return null

  const pick = async (frame: string | null) => {
    setBusy(true)
    const { ok } = await api('profile', { action: 'frame', frame })
    if (ok) await refresh()
    setBusy(false)
  }

  const bare = l({ ru: 'Без рамки', uk: 'Без рамки', en: 'No frame' })

  return (
    <section className="ava-sec frame-sec">
      <h3>{l({ ru: 'Рамка', uk: 'Рамка', en: 'Frame' })}</h3>
      <div className="frame-sec-body">
        <div className="frame-grid">
          <button
            type="button"
            className={`frame-card ${user.frame ? '' : 'on'}`}
            disabled={busy}
            title={bare}
            aria-label={bare}
            onClick={() => void pick(null)}
          >
            <Avatar id={user.id} name={user.nickname} avatar={user.avatar} />
          </button>
          {owned.map((one) => (
            <button
              key={one.id}
              type="button"
              className={`frame-card ${user.frame === one.id ? 'on' : ''}`}
              disabled={busy}
              title={l(one.label)}
              aria-label={l(one.label)}
              onClick={() => void pick(one.id)}
            >
              <Avatar id={user.id} name={user.nickname} avatar={user.avatar} frame={one.id} />
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
