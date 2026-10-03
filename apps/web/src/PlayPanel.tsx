import type { ReactNode } from 'react'

type Props = {
  media: ReactNode
  title: string
  hint: string
  aside?: ReactNode
  children?: ReactNode
}

export default function PlayPanel({ media, title, hint, aside, children }: Props) {
  return (
    <div className="play-panel">
      <div className="play-panel-top">
        <div className="play-media">{media}</div>
        <div className="play-copy">
          <h2>{title}</h2>
          <p>{hint}</p>
        </div>
        {aside}
      </div>
      {children}
    </div>
  )
}
