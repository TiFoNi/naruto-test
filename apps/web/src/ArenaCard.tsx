'use client'

import { torn } from './torn'
import { useI18n, type UiKey } from './i18n'
import { memo, type CSSProperties } from 'react'
import { CARD_RARITIES, type CardRarity } from '@nanda/game'
import { BACK_POINTS, BADGE_POINTS, DexFace, StatBadge } from './DexCard'
import type { Entity, GameId } from './games/types'

export type Card = { uid: string; id: number; rarity: CardRarity; atk: number; hp: number; max: number; summon: boolean; triple?: boolean; tier?: number; taunt?: boolean; cleave?: boolean; shot?: string | null; spell?: string; dodge?: number; charm?: boolean; sound?: boolean; poison?: boolean; medic?: boolean; fury?: boolean; guard?: string | null; ward?: string | false; ghost?: boolean; skills?: { key: string; cost: number; beast?: number | null }[]; armed?: string[] }
export type Side = { heroes: Card[]; summons: Card[] }
export type Offer = { id: number; rarity: CardRarity; cost: number; atk: number; hp: number; summon: boolean; tier: number; taunt?: boolean; cleave?: boolean; shot?: string | null; charm?: boolean; sound?: boolean; poison?: boolean; medic?: boolean; fury?: boolean; guard?: string | null; skills?: { key: string; cost: number; beast?: number | null }[] }
export type Step = {
  from: string
  all?: string[]
  to: string | null
  splash?: string[]
  shot?: string
  dodged?: string[]
  charm?: boolean
  skip?: boolean
  sapped?: string[]
  venom?: boolean
  ability?: string
  heals?: Record<string, number>
  wards?: string[]
  warded?: string[]
  raged?: string[]
  summoned?: string
  risen?: string
  again?: boolean
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
  coins: number
  coinsMax: number
  tavernTier: number
  upCost: number
  rollCost: number
  seq: number
  turnSec: number
  hp: number
  foeHp: number
  tavern: Offer[]
  spellOffer: { kind: string; cost: number } | null
  now: number
  turnEndsAt: number
  fightEndsAt: number | null
  armed: string[]
  hand: Card[]
  board: Side
  foeBoard: Side
  steps: Step[]
  opened: { hp: number; foeHp: number } | null
  clash: { mine: Card[]; theirs: Card[] } | null
}

const ARENA_SHAPE = 43

export const Ward = ({ breaking = false }: { look?: string; breaking?: boolean }) => (
  <span className={`ar-ward ${breaking ? 'is-breaking' : ''}`} aria-hidden>
    <i className="ar-ward-edge">
      <svg viewBox="0 0 300 400" preserveAspectRatio="none">
        <polygon points={BACK_POINTS} />
      </svg>
    </i>
    <i className="ar-ward-film" style={{ clipPath: torn(ARENA_SHAPE, 4) }}>
      <i className="ar-ward-shine" />
    </i>
  </span>
)

const oneWord = (name: string) => name.replace(/\(.*?\)/g, '').trim().split(/[\s/]+/)[0] || name

export const tierOf = (rarity: CardRarity) => CARD_RARITIES.indexOf(rarity)

export const ArenaFace = memo(function ArenaFace({
  game,
  entity,
  rarity,
  atk,
  hp,
  summon,
  triple,
  tier,
  taunt,
  cleave,
  shot,
  dodge,
  charm,
  sound,
  poison,
  medic,
  fury,
  guard,
  shield,
  ghost,
}: {
  game: GameId
  entity?: Entity
  rarity?: CardRarity
  atk: number
  hp: number
  summon: boolean
  triple?: boolean
  tier?: number
  taunt?: boolean
  cleave?: boolean
  shot?: string | null
  dodge?: number
  charm?: boolean
  sound?: boolean
  poison?: boolean
  medic?: boolean
  fury?: boolean
  guard?: string | null
  shield?: string | false
  ghost?: boolean
}) {
  const { t } = useI18n()
  if (!entity) return <span className="arena-slot" aria-hidden />
  return (
    <span
      className={`arena-card ${summon ? 'is-summon' : ''} ${triple ? 'is-triple' : ''} ${shield ? 'is-shielded' : ''} ${ghost ? 'is-ghost' : ''}`}
      style={{ '--tilt': `${(((entity.id * 7919) % 9) - 4) * 0.55}deg` } as CSSProperties}
    >
      <DexFace game={game} id={entity.id} image={entity.image} label={oneWord(entity.name)} tier={Math.max(0, tierOf(rarity ?? 'paper'))} seed={ARENA_SHAPE}>
        {!!tier && (
          <span className={`ar-tier is-t${tier}`} aria-hidden>
            <svg viewBox="0 0 130 100" preserveAspectRatio="none">
              <polygon points={BADGE_POINTS} vectorEffect="non-scaling-stroke" />
            </svg>
            {Array.from({ length: 6 }, (_, i) => (
              <i key={i} className={i < tier ? 'is-on' : ''} />
            ))}
          </span>
        )}
        {taunt && <span className="ar-taunt">{t('arena.taunt')}</span>}
        {cleave && <span className="ar-taunt is-cleave">{t('arena.cleave')}</span>}
        {shot && <span className="ar-taunt is-ranged">{t('arena.ranged')}</span>}
        {charm && <span className="ar-taunt is-charm">{t('arena.charm')}</span>}
        {sound && <span className="ar-taunt is-sound">{t('arena.sound')}</span>}
        {poison && <span className="ar-taunt is-poison">{t('arena.poison')}</span>}
        {medic && <span className="ar-taunt is-medic">{t('arena.medic')}</span>}
        {fury && <span className="ar-taunt is-fury">{t('arena.fury')}</span>}
        {guard && <span className="ar-taunt is-guard">{t('arena.guard')}</span>}
        {!!dodge && <span className="ar-taunt is-dodge">{t('arena.dodge')}</span>}
        {shield && <Ward look={shield} />}
        <StatBadge kind="atk" value={atk} />
        <StatBadge kind="hp" value={hp} />
      </DexFace>
    </span>
  )
})

export const SpellFace = memo(function SpellFace({ kind, cost }: { kind: string; cost?: number }) {
  const { t } = useI18n()
  return (
    <span className="arena-card is-spell" title={t(`arena.spell.${kind}.hint` as UiKey)}>
      <span className="dex-scrap ar-spell">
        <i className="dex-paper" style={{ clipPath: torn(ARENA_SHAPE, 4) }} />
        <span className="dex-pic" style={{ clipPath: torn(ARENA_SHAPE * 3 + 1, 3, 7) }}>
          <img className="is-in" src={`/spells/${kind}-card.webp`} alt="" draggable={false} />
        </span>
        <b>
          <span>{t(`arena.spell.${kind}` as UiKey)}</span>
        </b>
        {cost !== undefined && (
          <span className="ar-tier ar-price-tag">
            <svg viewBox="0 0 130 100" preserveAspectRatio="none" aria-hidden>
              <polygon points={BADGE_POINTS} vectorEffect="non-scaling-stroke" />
            </svg>
            <i className="ar-coin" />
            <b>{cost}</b>
          </span>
        )}
      </span>
    </span>
  )
})
