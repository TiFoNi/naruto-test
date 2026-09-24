import type { ReactNode } from 'react'
import { useI18n } from './i18n'

type Props = {
  media: ReactNode
  title: string
  hint: string
  attempts?: number
  streak: number
  children?: ReactNode
}

export default function PlayPanel({ media, title, hint, attempts, streak, children }: Props) {
  const { t } = useI18n()
  const chips = [
    { key: 'attempts', label: t('play.chipAttempts'), value: attempts ?? 0 },
    { key: 'streak', label: t('play.chipStreak'), value: streak, hot: true },
  ]

  return (
    <div className="play-panel">
      <div className="play-panel-top">
        <div className="play-media">{media}</div>
        <div className="play-copy">
          <h2>{title}</h2>
          <p>{hint}</p>
        </div>
        <div className="play-chips">
          {chips.map((chip) => (
            <span key={chip.key} className={`play-chip ${chip.hot ? 'hot' : ''}`}>
              <b>{chip.value}</b>
              <small>{chip.label}</small>
            </span>
          ))}
        </div>
      </div>
      {children}
    </div>
  )
}
