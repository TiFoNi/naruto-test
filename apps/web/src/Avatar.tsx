'use client'

import type { CSSProperties, ReactNode } from 'react'
import { avatarUrl } from './pics'
import { faceStyle, frameOf, frameStyle, frameUrl } from './frames'

type Props = { id?: string | null; name: string; avatar?: string | null; frame?: string | null; className?: string; hint?: ReactNode }

export default function Avatar({ id, name, avatar, frame, className, hint }: Props) {
  const src = id && avatar ? avatarUrl(id, avatar) : null
  const worn = frameOf(frame)

  return (
    <span
      className={`avatar ${src ? 'has-pic' : ''} ${worn ? 'has-frame' : ''} ${className ?? ''}`}
      style={worn ? (faceStyle(worn.id) as CSSProperties) : undefined}
      aria-hidden
    >
      <b className="avatar-letter">{name.charAt(0).toUpperCase()}</b>
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
      {worn && (
        <i className="avatar-frame" style={{ backgroundImage: `url(${frameUrl(worn.id)})`, ...frameStyle(worn.id) } as CSSProperties} />
      )}
    </span>
  )
}
