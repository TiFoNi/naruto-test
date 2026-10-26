import type { CSSProperties } from 'react'
import type { BannerLook, BannerLooks, LookPlace } from '@nanda/game'
import { bannerClips, bannerPic, bannerSpot, isLive } from './banners'

export const lookStyle = (id: string, look?: BannerLook | null): CSSProperties =>
  look
    ? {
        objectPosition: `${look.x}% ${look.y}%`,
        transformOrigin: `${look.x}% ${look.y}%`,
        transform: look.z > 1 ? `scale(${look.z})` : undefined,
      }
    : { objectPosition: bannerSpot(id) }

export default function BannerArt({ id, look, place }: { id: string; look?: BannerLooks | null; place: LookPlace | 'profile' }) {
  const style = lookStyle(id, place === 'profile' ? look?.desktop : (look?.[place] ?? look?.desktop))
  if (!isLive(id)) return <img src={bannerPic(id)} alt="" style={style} />

  return (
    <video autoPlay loop muted playsInline preload="auto" poster={bannerPic(id)} style={style}>
      {bannerClips(id).map((clip) => (
        <source key={clip.type} src={clip.src} type={clip.type} />
      ))}
    </video>
  )
}
