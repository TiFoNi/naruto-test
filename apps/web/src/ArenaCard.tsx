'use client'

import { torn } from './torn'
import { useI18n, type UiKey } from './i18n'
import { memo, useEffect, useState, type CSSProperties } from 'react'
import { CARD_RARITIES, type CardRarity } from '@nanda/game'
import { BACK_POINTS, BADGE_POINTS, DexFace } from './DexCard'
import { hdUrl } from './pics'
import { HeartIcon } from './icons'
import type { Entity, GameId } from './games/types'

export type Card = { uid: string; id: number; rarity: CardRarity; atk: number; hp: number; max: number; summon: boolean; triple?: boolean; tier?: number; taunt?: boolean; cleave?: boolean; shot?: string | null; spell?: string; dodge?: number; charm?: boolean; sound?: boolean; poison?: boolean; medic?: boolean; fury?: boolean; scorch?: boolean; bomb?: boolean; guard?: string | null; ward?: string | false; ghost?: boolean; stun?: boolean; skills?: { key: string; cost: number; beast?: number | null }[]; armed?: string[]; heal?: number; mythic?: string | null; clan?: string | null; boost?: { atk: number; hp: number }; aim?: string; captain?: boolean; burn?: number; gated?: boolean; bound?: string | null; link?: string | null; clone?: boolean; fake?: boolean; away?: number; art?: string; shade?: boolean; chained?: number; molten?: boolean; scorched?: boolean }
export type Side = { heroes: Card[]; summons: Card[] }
export type Offer = { id: number; rarity: CardRarity; cost: number; atk: number; hp: number; summon: boolean; tier: number; taunt?: boolean; cleave?: boolean; shot?: string | null; charm?: boolean; sound?: boolean; poison?: boolean; medic?: boolean; fury?: boolean; scorch?: boolean; bomb?: boolean; guard?: string | null; skills?: { key: string; cost: number; beast?: number | null }[]; heal?: number; mythic?: string | null; clan?: string | null }
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
  summoned?: string[]
  risen?: string
  again?: boolean
  sealed?: string[]
  cursed?: string[]
  countered?: string[]
  marks?: [string, string][]
  swapFrom?: string
  swapTo?: string
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
  synergy?: Synergy[]
  kits?: Record<string, LadderRow[]>
  clans?: string[]
  cried?: { from: string; to: string[]; atk: number; hp: number } | null
  buffs?: { to: string; atk: number; hp: number; coin?: number; chakra?: number }[] | null
  discover?: Offer[]
  buffAt?: number
  frozen?: boolean
  crew?: { captain: { id: number; scope: string; atk: number; hp: number } | null; teams: { key: string; ids: number[]; atk: number; hp: number; have: number; on: boolean }[] }
}
export type Synergy = { clan: string; count: number; need: number; cap: number; ready: number }
export type LadderRow = { need?: CardRarity; key: string; n?: number; scope?: string; atk?: number; hp?: number; ids?: number[]; with?: number[]; pierce?: boolean }

const ARENA_SHAPE = 43

export const Ward = ({ breaking = false, frost = false, sand = false, thawing = false }: { look?: string; breaking?: boolean; frost?: boolean; sand?: boolean; thawing?: boolean }) => (
  <span className={`ar-ward ${breaking ? 'is-breaking' : ''} ${frost ? 'is-frost' : ''} ${sand ? 'is-sand' : ''} ${thawing ? 'is-thawing' : ''}`} aria-hidden>
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

const THAW_MS = 420

const useThaw = (frost: boolean) => {
  const [prev, setPrev] = useState(frost)
  const [thawing, setThawing] = useState(false)
  if (prev !== frost) {
    setPrev(frost)
    setThawing(!frost)
  }
  useEffect(() => {
    if (!thawing) return
    const timer = window.setTimeout(() => setThawing(false), THAW_MS)
    return () => window.clearTimeout(timer)
  }, [thawing])
  return thawing
}

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
  kamui,
  charm,
  sound,
  poison,
  medic,
  fury,
  scorch,
  bomb,
  guard,
  shield,
  frost,
  clone,
  fake,
  away,
  art,
  ghost,
  boost,
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
  kamui?: boolean
  charm?: boolean
  sound?: boolean
  poison?: boolean
  medic?: boolean
  away?: boolean
  art?: string
  clone?: boolean
  fake?: boolean
  frost?: boolean
  fury?: boolean
  scorch?: boolean
  bomb?: boolean
  guard?: string | null
  shield?: string | false
  ghost?: boolean
  boost?: { atk: number; hp: number }
}) {
  const { t } = useI18n()
  const thawing = useThaw(!!frost)
  if (!entity) return <span className="arena-slot" aria-hidden />
  return (
    <span
      data-tip={JSON.stringify({ id: entity.id, rarity: rarity ?? 'paper', shot, dodge: kamui ? 0 : dodge })}
      className={`arena-card ${summon ? 'is-summon' : ''} ${triple ? 'is-triple' : ''} ${shield ? 'is-shielded' : ''} ${ghost ? 'is-ghost' : ''} ${fake ? 'is-fake' : ''} ${away ? 'is-away' : ''}`}
      style={{ '--tilt': `${(((entity.id * 7919) % 9) - 4) * 0.55}deg` } as CSSProperties}
    >
      <DexFace game={game} id={entity.id} image={entity.image} src={art ? `/arena/${art}.webp` : hdUrl(game, entity.id, entity.image)} label={art ? t(`arena.art.${art}` as UiKey) : oneWord(entity.name)} tier={Math.max(0, tierOf(rarity ?? 'paper'))} seed={ARENA_SHAPE}>
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
        {charm && <span className="ar-taunt is-charm">{t('arena.charm')}</span>}
        {sound && <span className="ar-taunt is-sound">{t('arena.sound')}</span>}
        {poison && <span className="ar-taunt is-poison">{t('arena.poison')}</span>}
        {medic && <span className="ar-taunt is-medic">{t('arena.medic')}</span>}
        {fury && <span className="ar-taunt is-fury">{t('arena.fury')}</span>}
        {scorch && <span className="ar-taunt is-scorch">{t('arena.scorch')}</span>}
        {bomb && <span className="ar-taunt is-bomb">{t('arena.bomb')}</span>}
        {guard && <span className="ar-taunt is-guard">{t('arena.guard')}</span>}
        {!!dodge && <span className={`ar-taunt is-dodge ${kamui ? 'is-kamui' : ''}`}>{t(kamui ? 'arena.myth.kamui' : 'arena.dodge')}</span>}
        {clone && <span className="ar-taunt is-clone">{t('arena.clone')}</span>}
        {shield ? <Ward look={shield} /> : frost || thawing ? <Ward frost thawing={thawing} /> : null}
        <span className="ar-stats">
          <span className={`is-atk ${boost?.atk ? 'is-boosted' : ''}`}>
            <svg className="icon" viewBox="0 0 24 24" aria-hidden>
              <path d="M12 1 L14 10 L23 12 L14 14 L12 23 L10 14 L1 12 L10 10 Z" />
              <circle cx="12" cy="12" r="2.2" className="is-hole" />
            </svg>
            <b>{atk}</b>
          </span>
          <span className={`is-hp ${boost?.hp ? 'is-boosted' : ''}`}>
            <HeartIcon />
            <b>{hp}</b>
          </span>
        </span>
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
            <i className="ar-orb is-full" />
            <b>{cost}</b>
          </span>
        )}
      </span>
    </span>
  )
})
