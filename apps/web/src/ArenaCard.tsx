'use client'

import { memo } from 'react'
import { CARD_RARITIES, type CardRarity } from '@nanda/game'
import { DexFace, StatBadge } from './DexCard'
import type { Entity, GameId } from './games/types'

export type Card = { uid: string; id: number; rarity: CardRarity; atk: number; hp: number; max: number; summon: boolean; triple?: boolean }
export type Side = { heroes: Card[]; summons: Card[] }
export type Offer = { id: number; rarity: CardRarity; cost: number; atk: number; hp: number; summon: boolean; tier: number }
export type Step = {
  from: string
  all?: string[]
  to: string | null
  damage: number
  dead: boolean
  foe: boolean
  hp: number
  foeHp: number
  mine: Card[]
  theirs: Card[]
}
export type ArenaView = {
  status: 'playing' | 'won' | 'lost'
  turn: number
  chakra: number
  chakraMax: number
  tavernTier: number
  upCost: number
  rollCost: number
  hp: number
  foeHp: number
  tavern: Offer[]
  hand: Card[]
  board: Side
  foeBoard: Side
  steps: Step[]
  opened: { hp: number; foeHp: number } | null
  clash: { mine: Card[]; theirs: Card[] } | null
}

const ARENA_SHAPE = 7

const oneWord = (name: string) => name.replace(/\(.*?\)/g, '').trim().split(/[\s/]+/)[0] || name

export const tierOf = (rarity: CardRarity) => CARD_RARITIES.indexOf(rarity)

export const ArenaFace = memo(function ArenaFace({
  game,
  entity,
  atk,
  hp,
  summon,
  triple,
}: {
  game: GameId
  entity?: Entity
  rarity?: CardRarity
  atk: number
  hp: number
  summon: boolean
  triple?: boolean
}) {
  if (!entity) return <span className="arena-slot" aria-hidden />
  return (
    <span className={`arena-card ${summon ? 'is-summon' : ''} ${triple ? 'is-triple' : ''}`}>
      <DexFace game={game} id={entity.id} image={entity.image} label={oneWord(entity.name)} tier={0} seed={ARENA_SHAPE}>
        <StatBadge kind="atk" value={atk} />
        <StatBadge kind="hp" value={hp} />
      </DexFace>
    </span>
  )
})
