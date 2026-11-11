'use client'

import { useEffect, useLayoutEffect, useRef, type CSSProperties, type RefObject } from 'react'
import type { BannerLook, BannerLooks, LookPlace } from '@nanda/game'
import { bannerClips, bannerPic, bannerSet, bannerSpot, boardSizes, isLive } from './banners'

export const lookStyle = (id: string, look?: BannerLook | null): CSSProperties =>
  look
    ? {
        objectPosition: `${look.x}% ${look.y}%`,
        transformOrigin: `${look.x}% ${look.y}%`,
        transform: look.z > 1 ? `scale(${look.z})` : undefined,
      }
    : { objectPosition: bannerSpot(id) }

type Media = HTMLImageElement & HTMLVideoElement

export const mediaSize = (node: Element | null) => {
  const media = node as (Partial<HTMLImageElement> & Partial<HTMLVideoElement>) | null
  if (media?.naturalWidth) return { w: media.naturalWidth, h: media.naturalHeight ?? 0 }
  if (media?.videoWidth) return { w: media.videoWidth, h: media.videoHeight ?? 0 }
  return null
}

const within = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value))

export const focusFit = (media: Element | null, look: BannerLook) => {
  const natural = mediaSize(media)
  const box = media?.parentElement
  if (!natural?.w || !natural.h || !box?.clientWidth || !box.clientHeight) return null
  const boxW = box.clientWidth
  const boxH = box.clientHeight
  const scale = Math.max(boxW / natural.w, boxH / natural.h) * Math.max(1, look.z)
  return { boxW, boxH, w: natural.w * scale, h: natural.h * scale }
}

export const focusRange = (span: number, size: number) => (size > span + 0.5 ? [(span / 2 / size) * 100, 100 - (span / 2 / size) * 100] : null)

export const placeFocus = (media: Element | null, look: BannerLook) => {
  const fit = focusFit(media, look)
  if (!fit || !media) return
  const left = within(fit.boxW / 2 - (look.x / 100) * fit.w, fit.boxW - fit.w, 0)
  const top = within(fit.boxH / 2 - (look.y / 100) * fit.h, fit.boxH - fit.h, 0)
  Object.assign((media as HTMLElement).style, {
    left: `${left}px`,
    top: `${top}px`,
    width: `${fit.w}px`,
    height: `${fit.h}px`,
    maxWidth: 'none',
    objectFit: 'fill',
    objectPosition: '',
    transform: '',
    transformOrigin: '',
  })
}

const useFocus = (media: RefObject<Media | null>, look: BannerLook | null | undefined) => {
  const x = look?.x
  const y = look?.y
  const z = look?.z
  useLayoutEffect(() => {
    const node = media.current
    const box = node?.parentElement
    if (!node || !box || x === undefined || y === undefined || typeof ResizeObserver === 'undefined') return
    const place = () => placeFocus(node, { x, y, z: z ?? 1 })
    place()
    const watch = new ResizeObserver(place)
    watch.observe(box)
    node.addEventListener('load', place)
    node.addEventListener('loadedmetadata', place)
    return () => {
      watch.disconnect()
      node.removeEventListener('load', place)
      node.removeEventListener('loadedmetadata', place)
    }
  }, [media, x, y, z])
}

export default function BannerArt({
  id,
  look,
  place,
  first = false,
  focus = false,
}: {
  id: string
  look?: BannerLooks | null
  place: LookPlace | 'profile'
  first?: boolean
  focus?: boolean
}) {
  const media = useRef<Media>(null)
  const chosen = place === 'profile' ? look?.desktop : (look?.[place] ?? look?.desktop)
  const focused = focus && chosen ? chosen : null
  useFocus(media, focused)
  const style = focused ? {} : lookStyle(id, chosen)
  if (!isLive(id)) {
    const board = place === 'board'
    return (
      <img
        ref={media}
        src={bannerPic(id, board)}
        srcSet={board ? bannerSet(id) : undefined}
        sizes={board ? boardSizes(first, chosen?.z) : undefined}
        alt=""
        style={style}
        fetchPriority={first ? 'high' : undefined}
        decoding={first ? 'sync' : 'async'}
      />
    )
  }
  return <LiveArt id={id} style={style} clip={media} />
}

function LiveArt({ id, style, clip }: { id: string; style: CSSProperties; clip: RefObject<Media | null> }) {
  useEffect(() => {
    const node = clip.current
    if (!node || typeof IntersectionObserver === 'undefined') return
    const watch = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) void node.play().catch(() => undefined)
      else node.pause()
    })
    watch.observe(node)
    return () => watch.disconnect()
  }, [clip])

  return (
    <video ref={clip} autoPlay loop muted playsInline preload="auto" poster={bannerPic(id)} style={style}>
      {bannerClips(id).map((clip) => (
        <source key={clip.type} src={clip.src} type={clip.type} />
      ))}
    </video>
  )
}
