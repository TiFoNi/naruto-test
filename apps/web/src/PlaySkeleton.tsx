import type { ModeId } from './modes'

const LAYOUT: Record<ModeId, string> = {
  classic: 'play-layout',
  image: 'play-layout shot-layout',
  ability: 'play-layout ability-layout',
  page: 'play-layout page-layout',
}

export default function PlaySkeleton({ mode }: { mode: ModeId }) {
  return (
    <section className={`${LAYOUT[mode]} play-skeleton`} aria-hidden>
      {mode !== 'classic' && <span className={`skeleton-block media ${mode}`} />}
      <div className="play-main">
        <span className="skeleton-block copy" />
        <span className="skeleton-block body" />
      </div>
      <div className="skeleton-side">
        <span className="skeleton-block stats" />
        <span className="skeleton-block actions" />
      </div>
    </section>
  )
}
