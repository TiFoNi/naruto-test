'use client'

import { useEffect, useRef, type CSSProperties } from 'react'
import type { BannerLook, BannerLooks, LookPlace } from '@nanda/game'
import { BOARD_SIZES, bannerClips, bannerPic, bannerSet, bannerSpot, isLive } from './banners'

export const lookStyle = (id: string, look?: BannerLook | null): CSSProperties =>
  look
    ? {
        objectPosition: `${look.x}% ${look.y}%`,
        transformOrigin: `${look.x}% ${look.y}%`,
        transform: look.z > 1 ? `scale(${look.z})` : undefined,
      }
    : { objectPosition: bannerSpot(id) }

export default function BannerArt({
  id,
  look,
  place,
  first = false,
}: {
  id: string
  look?: BannerLooks | null
  place: LookPlace | 'profile'
  first?: boolean
}) {
  const style = lookStyle(id, place === 'profile' ? look?.desktop : (look?.[place] ?? look?.desktop))
  if (!isLive(id)) {
    const board = place === 'board'
    return (
      <img
        src={bannerPic(id, board)}
        srcSet={board ? bannerSet(id) : undefined}
        sizes={board ? BOARD_SIZES[first ? 'first' : 'rest'] : undefined}
        alt=""
        style={style}
        fetchPriority={first ? 'high' : undefined}
        decoding={first ? 'sync' : 'async'}
      />
    )
  }
  return <LiveArt id={id} style={style} />
}

function LiveArt({ id, style }: { id: string; style: CSSProperties }) {
  const clip = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const node = clip.current
    if (!node || typeof IntersectionObserver === 'undefined') return
    const watch = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) void node.play().catch(() => undefined)
      else node.pause()
    })
    watch.observe(node)
    return () => watch.disconnect()
  }, [])

  return (
    <video ref={clip} autoPlay loop muted playsInline preload="auto" poster={bannerPic(id)} style={style}>
      {bannerClips(id).map((clip) => (
        <source key={clip.type} src={clip.src} type={clip.type} />
      ))}
    </video>
  )
}
