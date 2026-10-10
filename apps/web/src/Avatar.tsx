'use client'

import type { ReactNode } from 'react'
import { avatarUrl } from './pics'
import { FRAMES, frameUrl } from './frames'

type Props = { id?: string | null; name: string; avatar?: string | null; frame?: string | null; className?: string; hint?: ReactNode }

export default function Avatar({ id, name, avatar, frame, className, hint }: Props) {
  const src = id && avatar ? avatarUrl(id, avatar) : null
  const worn = frame && FRAMES.some((one) => one.id === frame) ? frame : null

  return (
    <span className={`avatar ${src ? 'has-pic' : ''} ${worn ? 'has-frame' : ''} ${className ?? ''}`} aria-hidden>
      {name.charAt(0).toUpperCase()}
      {src && (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          onError={(event) => {
            event.currentTarget.hidden = true
          }}
        />
      )}
      {hint}
      {worn && <i className="avatar-frame" style={{ backgroundImage: `url(${frameUrl(worn)})` }} />}
    </span>
  )
}
