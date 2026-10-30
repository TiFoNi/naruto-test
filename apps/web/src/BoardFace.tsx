'use client'

import { useSyncExternalStore, type CSSProperties } from 'react'
import { frameOf, frameStyle, frameUrl, tuneStamp, watchTune } from './frames'
import { useNear } from './near'
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
  const src = id && avatar ? avatarUrl(id, avatar, true) : null
  const set = big && id && avatar ? `${src} 192w, ${full} 384w` : undefined
  const worn = frameOf(frame)
  useSyncExternalStore(watchTune, tuneStamp, () => 0)
  const [box, near] = useNear<HTMLSpanElement>()

  return (
    <span ref={box} className={`lb-face ${worn ? 'has-frame' : ''}`} aria-hidden>
      <span className={`lb-av ${big ? 'big' : ''} ${src && near ? 'has-pic' : ''}`} data-tone={toneOf(nickname)}>
        {nickname.charAt(0).toUpperCase()}
        {src && near && (
          <img
            src={src}
            srcSet={set}
            sizes={set ? '(max-width: 560px) 72px, 112px' : undefined}
            alt=""
            loading="lazy"
            decoding="async"
            onError={(event) => {
              const img = event.currentTarget
              if (full && src !== full && !img.dataset.full) {
                img.dataset.full = '1'
                img.removeAttribute('srcset')
                img.src = full
              } else img.hidden = true
            }}
          />
        )}
      </span>
      {worn && near && (
        <i className="avatar-frame" style={frameStyle(worn.id) as CSSProperties}>
          <img
            src={frameUrl(worn.id, 'sm')}
            srcSet={big ? `${frameUrl(worn.id, 'sm')} 192w, ${frameUrl(worn.id, 'md')} 512w` : undefined}
            sizes={big ? '(max-width: 560px) 110px, 170px' : undefined}
            alt=""
            loading="lazy"
            decoding="async"
          />
        </i>
      )}
    </span>
  )
}
