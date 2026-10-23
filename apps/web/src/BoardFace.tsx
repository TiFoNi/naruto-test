'use client'

import type { CSSProperties } from 'react'
import { frameOf, frameStyle, frameUrl } from './frames'
import { avatarUrl } from './pics'

const TONES = 8

const toneOf = (nickname: string) => {
  let hash = 0
  for (let i = 0; i < nickname.length; i++) hash = (hash * 31 + nickname.charCodeAt(i)) % 9973
  return hash % TONES
}

type Props = { id?: string; nickname: string; avatar?: string | null; frame?: string | null; big?: boolean }

export default function BoardFace({ id, nickname, avatar, frame, big }: Props) {
  const src = id && avatar ? avatarUrl(id, avatar) : null
  const worn = frameOf(frame)

  return (
    <span className={`lb-face ${worn ? 'has-frame' : ''}`} aria-hidden>
      <span className={`lb-av ${big ? 'big' : ''} ${src ? 'has-pic' : ''}`} data-tone={toneOf(nickname)}>
        {nickname.charAt(0).toUpperCase()}
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
      </span>
      {worn && (
        <i className="avatar-frame" style={{ backgroundImage: `url(${frameUrl(worn.id, !big)})`, ...frameStyle(worn.id) } as CSSProperties} />
      )}
    </span>
  )
}
