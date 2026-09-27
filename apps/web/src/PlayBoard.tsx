import type { ReactNode } from 'react'

type Props = { variant?: 'classic' | 'shot' | 'ability'; media?: ReactNode; side?: ReactNode; children: ReactNode }

const LAYOUT = { classic: '', shot: 'shot-layout', ability: 'ability-layout' } as const

export default function PlayBoard({ variant = 'classic', media, side, children }: Props) {
  return (
    <section className={`play-layout ${LAYOUT[variant]}`}>
      {media}
      <div className="play-main">{children}</div>
      {side}
    </section>
  )
}

export function AskCard({ title, hint, state }: { title: string; hint: string; state?: string }) {
  return (
    <div className={`play-card ${state ? `mode-ask state-${state}` : 'shot-copy'}`}>
      <h2>{title}</h2>
      <p>{hint}</p>
    </div>
  )
}
