import type { ReactNode } from 'react'

type Props = { variant?: 'classic' | 'shot' | 'ability' | 'page' | 'phrase'; media?: ReactNode; side?: ReactNode; children: ReactNode }

const LAYOUT = { classic: '', shot: 'shot-layout', ability: 'ability-layout', page: 'page-layout', phrase: 'phrase-layout' } as const

export default function PlayBoard({ variant = 'classic', media, side, children }: Props) {
  return (
    <section className={`play-layout ${LAYOUT[variant]}`}>
      {media}
      <div className="play-main">{children}</div>
      {side}
    </section>
  )
}

export function AskCard({ title, hint, state, aside }: { title: string; hint: string; state?: string; aside?: ReactNode }) {
  return (
    <div className={`play-card ${state ? `mode-ask state-${state}` : 'shot-copy'}`}>
      <div className="play-card-head">
        <h2>{title}</h2>
        {aside}
      </div>
      <p>{hint}</p>
    </div>
  )
}
