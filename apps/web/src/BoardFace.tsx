'use client'

import { useSyncExternalStore, type CSSProperties } from 'react'
import { frameOf, frameStyle, frameUrl, tuneStamp, watchTune } from './frames'
import { avatarUrl } from './pics'

const TONES = 8

const toneOf = (nickname: string) => {
  let hash = 0
  for (let i = 0; i < nickname.length; i++) hash = (hash * 31 + nickname.charCodeAt(i)) % 9973
  return hash % TONES
}

type Props = { id?: string; nickname: string; avatar?: string | null; frame?: string | null; big?: boolean }

export default function BoardFace({ id, nickname, avatar, frame, big }: Props) {
  const full = id && avatar ? avatarUrl(id, avatar) : null
  const src = id && avatar ? avatarUrl(id, avatar, !big) : null
  const worn = frameOf(frame)
  useSyncExternalStore(watchTune, tuneStamp, () => 0)

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
              const img = event.currentTarget
              if (full && src !== full && !img.dataset.full) {
                img.dataset.full = '1'
                img.src = full
              } else img.hidden = true
            }}
          />
        )}
      </span>
      {worn && (
        <i className="avatar-frame" style={frameStyle(worn.id) as CSSProperties}>
          <img src={frameUrl(worn.id, big ? 'md' : 'sm')} alt="" loading="lazy" decoding="async" />
        </i>
      )}
    </span>
  )
}
