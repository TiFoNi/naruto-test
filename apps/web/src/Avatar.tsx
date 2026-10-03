'use client'

import type { ReactNode } from 'react'
import { avatarUrl } from './pics'
import { frameUrl } from './frames'

type Props = { id?: string | null; name: string; avatar?: string | null; frame?: string | null; className?: string; children?: ReactNode }

export default function Avatar({ id, name, avatar, frame, className, children }: Props) {
  const src = id && avatar ? avatarUrl(id, avatar) : null

  return (
    <span className={`avatar ${src ? 'has-pic' : ''} ${frame ? 'has-frame' : ''} ${className ?? ''}`} aria-hidden>
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
      {frame && <i className="avatar-frame" style={{ backgroundImage: `url(${frameUrl(frame)})` }} />}
      {children}
    </span>
  )
}
