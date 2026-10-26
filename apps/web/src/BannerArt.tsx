import { bannerClips, bannerPic, bannerSpot, isLive } from './banners'

export default function BannerArt({ id }: { id: string }) {
  if (!isLive(id)) return <img src={bannerPic(id)} alt="" style={{ objectPosition: bannerSpot(id) }} />

  return (
    <video autoPlay loop muted playsInline preload="auto" poster={bannerPic(id)} style={{ objectPosition: bannerSpot(id) }}>
      {bannerClips(id).map((clip) => (
        <source key={clip.type} src={clip.src} type={clip.type} />
      ))}
    </video>
  )
}
