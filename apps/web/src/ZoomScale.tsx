import type { CSSProperties } from 'react'

type Props = { title: string; note: string; labels: string[]; current: number; clarity?: boolean }

export default function ZoomScale({ title, note, labels, current, clarity }: Props) {
  return (
    <div className="play-card zoom-scale">
      <div className="zoom-scale-head">
        <span className="play-card-title">{title}</span>
        <span>{note}</span>
      </div>
      <div className={`zoom-steps ${clarity ? 'clarity-steps' : ''}`} style={clarity ? ({ ['--steps' as string]: labels.length } as CSSProperties) : undefined}>
        {labels.map((label, i) => (
          <span key={label} className={i === current ? 'now' : i < current ? 'past' : ''}>
            <i />
            <b>{label}</b>
          </span>
        ))}
      </div>
    </div>
  )
}
