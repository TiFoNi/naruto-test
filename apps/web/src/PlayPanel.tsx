import type { ReactNode } from 'react'

type Props = {
  media: ReactNode
  title: string
  hint: string
  aside?: ReactNode
  note?: ReactNode
  children?: ReactNode
}

export default function PlayPanel({ media, title, hint, aside, note, children }: Props) {
  return (
    <div className="play-panel">
      <div className="play-panel-top">
        <div className="play-media">{media}</div>
        <div className="play-copy">
          <h2>{title}</h2>
          <p>{hint}</p>
          {note}
        </div>
        {aside}
      </div>
      {children}
    </div>
  )
}
