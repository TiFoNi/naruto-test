'use client'

import type { ReactNode } from 'react'
import { avatarUrl } from './pics'

type Props = { id?: string | null; name: string; avatar?: string | null; className?: string; children?: ReactNode }

export default function Avatar({ id, name, avatar, className, children }: Props) {
  const src = id && avatar ? avatarUrl(id, avatar) : null

  return (
    <span className={`avatar ${src ? 'has-pic' : ''} ${className ?? ''}`} aria-hidden>
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
      {children}
    </span>
  )
}
