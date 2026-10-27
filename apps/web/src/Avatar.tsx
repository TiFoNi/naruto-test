'use client'

import { useSyncExternalStore, type CSSProperties, type ReactNode } from 'react'
import { avatarUrl } from './pics'
import { faceStyle, frameOf, frameStyle, frameUrl, tuneStamp, watchTune } from './frames'

type Props = { id?: string | null; name: string; avatar?: string | null; frame?: string | null; className?: string; hint?: ReactNode; small?: boolean; medium?: boolean }

export default function Avatar({ id, name, avatar, frame, className, hint, small = false, medium = false }: Props) {
  const tiny = small || (className ?? '').split(' ').includes('small')
  const full = id && avatar ? avatarUrl(id, avatar) : null
  const src = id && avatar ? avatarUrl(id, avatar, tiny) : null
  const worn = frameOf(frame)
  useSyncExternalStore(watchTune, tuneStamp, () => 0)

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
            const img = event.currentTarget
            if (full && src !== full && !img.dataset.full) {
              img.dataset.full = '1'
              img.src = full
            } else img.hidden = true
          }}
        />
      )}
      {hint}
      {worn && (
        <i className="avatar-frame" style={frameStyle(worn.id) as CSSProperties}>
          <img src={frameUrl(worn.id, small ? 'sm' : medium ? 'md' : undefined)} alt="" loading="lazy" decoding="async" />
        </i>
      )}
    </span>
  )
}
