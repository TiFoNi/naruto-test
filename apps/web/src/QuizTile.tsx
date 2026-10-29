'use client'

import { useState } from 'react'
import type { Entity, Game } from './games/types'
import { useI18n } from './i18n'
import { CheckIcon, CloseIcon } from './icons'
import { abilityUrl, fullUrl } from './pics'
import type { QuizOption } from './quiz'
import Thumb from './Thumb'

export type TileState = 'idle' | 'picked' | 'right' | 'wrong' | 'missed'

type Props = {
  game: Game
  option: QuizOption
  byId: Map<number, Entity>
  state?: TileState
  disabled?: boolean
  onClick?: () => void
}

export function useOptionLabel(byId: Map<number, Entity>) {
  const { name, l } = useI18n()
  return (option: QuizOption) => {
    if (option.kind === 'text') return option.text
    if (option.kind === 'ability') return option.name ? l(option.name) : option.key
    const entity = byId.get(option.id)
    return entity ? name(entity) : `#${option.id}`
  }
}

function Art({ game, option, byId }: { game: Game; option: QuizOption; byId: Map<number, Entity> }) {
  const [broken, setBroken] = useState(false)
  if (option.kind === 'text') return null
  if (option.kind === 'ability') {
    return broken ? null : <img className="quiz-tile-art is-icon" src={abilityUrl(option.key)} alt="" loading="lazy" onError={() => setBroken(true)} />
  }
  const entity = byId.get(option.id)
  if (!entity) return null
  if (broken) return <Thumb game={game} entity={entity} className="quiz-tile-art is-thumb" />
  return <img className="quiz-tile-art" src={fullUrl(game.id, entity.id, entity.image)} alt="" loading="lazy" onError={() => setBroken(true)} />
}

export default function QuizTile({ game, option, byId, state = 'idle', disabled, onClick }: Props) {
  const label = useOptionLabel(byId)(option)
  const mark = state === 'right' || state === 'missed' || state === 'picked' ? <CheckIcon /> : state === 'wrong' ? <CloseIcon /> : null

  return (
    <button
      type="button"
      className={`quiz-tile kind-${option.kind} is-${state} ${option.kind === 'entity' && byId.has(option.id) ? 'has-art' : ''}`}
      disabled={disabled}
      aria-pressed={state === 'picked'}
      onClick={onClick}
    >
      <Art game={game} option={option} byId={byId} />
      <span className="quiz-tile-label">{label}</span>
      {mark && <i className="quiz-tile-mark">{mark}</i>}
    </button>
  )
}

type ChipProps = {
  game: Game
  option: QuizOption
  byId: Map<number, Entity>
  state?: TileState
  active?: boolean
  disabled?: boolean
  onClick?: () => void
}

function ChipArt({ game, option, byId }: { game: Game; option: QuizOption; byId: Map<number, Entity> }) {
  const [broken, setBroken] = useState(false)
  if (option.kind === 'text') return null
  if (option.kind === 'ability') return broken ? null : <img className="quiz-chip-art" src={abilityUrl(option.key)} alt="" loading="lazy" onError={() => setBroken(true)} />
  const entity = byId.get(option.id)
  return entity ? <Thumb game={game} entity={entity} size={36} className="quiz-chip-art" /> : null
}

export function QuizChip({ game, option, byId, state = 'idle', active, disabled, onClick }: ChipProps) {
  const label = useOptionLabel(byId)(option)
  const mark = state === 'right' ? <CheckIcon /> : state === 'wrong' ? <CloseIcon /> : null
  return (
    <button type="button" className={`quiz-chip kind-${option.kind} is-${state} ${active ? 'is-active' : ''}`} disabled={disabled} onClick={onClick}>
      <ChipArt game={game} option={option} byId={byId} />
      <span className="quiz-chip-label">{label}</span>
      {mark && <i className="quiz-chip-mark">{mark}</i>}
    </button>
  )
}
