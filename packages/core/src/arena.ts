import type { ObjectId } from 'mongodb'
import {
  ARENA_ABILITIES,
  ARENA_CHAKRA_MAX,
  ARENA_CHAKRA_START,
  ARENA_COIN_MAX,
  ARENA_COIN_START,
  ARENA_SELL_BACK,
  ARENA_SPELL_CHANCE,
  ARENA_SPELL_COST,
  ARENA_HAND,
  ARENA_HERO_SLOTS,
  ARENA_HP,
  ARENA_BAN_MARK,
  ARENA_SUMMON_MARK,
  ARENA_TIERS,
  ARENA_TRIPLE,
  ARENA_ROLL_COST,
  ARENA_UP_MIN,
  arenaPower,
  arenaTierAt,
  arenaUpCost,
  ARENA_TURN_SEC,
  ARENA_SUMMON_SLOTS,
  ARENA_TAVERN,
  CARD_RARITIES,
  arenaCost,
  type CardRarity,
  type GameId,
  type ArenaAbility,
} from '@nanda/game'
import tiers from '@nanda/game/data/arena-naruto.json'
import traits from '@nanda/game/data/arena-naruto-traits.json'
import { arenas, entities, type ArenaCard, type ArenaDoc, type ArenaSide, type ArenaStep } from './db'
import { dexOf, gradesOf } from './dex'
import { gameData } from './games'

const ARENA_ROUNDS = 12

export type { ArenaStep } from './db'

const pickOne = <T>(list: T[]) => list[Math.floor(Math.random() * list.length)]!

const shuffled = <T>(list: T[]) => {
  const order = [...list]
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[order[i], order[j]] = [order[j]!, order[i]!]
  }
  return order
}

const blankSide = (): ArenaSide => ({ heroes: [], summons: [] })

const onBoard = (side: ArenaSide) => [...side.heroes, ...side.summons]

const alive = (side: ArenaSide) => onBoard(side).filter((card) => card.hp > 0)

const drop = (side: ArenaSide) => {
  side.heroes = side.heroes.filter((card) => card.hp > 0)
  side.summons = side.summons.filter((card) => card.hp > 0)
}

const bash = (crew: ArenaCard[]) => crew.reduce((sum, card) => sum + tierOf(card.id), 0)

const marked = <T extends { id: number }>(pool: T[], mark: string) =>
  new Set(pool.filter((one) => ((one as unknown as { attributes?: string[] }).attributes ?? []).includes(mark)).map((one) => one.id))

export async function summonIds(game: GameId) {
  const { pool } = await gameData(game)
  return marked(pool, ARENA_SUMMON_MARK)
}

export async function bannedIds(game: GameId) {
  const { pool } = await gameData(game)
  return marked(pool, ARENA_BAN_MARK)
}

const sheet = tiers as unknown as Record<string, [number, number, number] | undefined>
const taunts = new Set<number>((traits as { taunt?: number[] }).taunt ?? [])
const cleavers = new Set<number>((traits as { cleave?: number[] }).cleave ?? [])
const shooters = new Map<number, string>(Object.entries((traits as { ranged?: Record<string, string> }).ranged ?? {}).map(([id, kind]) => [Number(id), kind]))

export const tauntOf = (id: number) => taunts.has(id)

export const cleaveOf = (id: number) => cleavers.has(id)

export const shotOf = (id: number) => shooters.get(id) ?? null

const venoms = new Set<number>(((traits as Record<string, unknown>).poison as number[] | undefined) ?? [])
const singers = new Set<number>(((traits as Record<string, unknown>).sound as number[] | undefined) ?? [])

export const soundOf = (id: number) => singers.has(id)

const healers = new Set<number>(((traits as Record<string, unknown>).medic as number[] | undefined) ?? [])

export const medicOf = (id: number) => healers.has(id)
const skills = new Map<number, [ArenaAbility, CardRarity][]>(
  Object.entries(((traits as Record<string, unknown>).abilities as Record<string, [ArenaAbility, CardRarity][]> | undefined) ?? {}).map(([id, list]) => [Number(id), list]),
)

export const poisonOf = (id: number) => venoms.has(id)

const callers = new Map<number, number>(Object.entries(((traits as Record<string, unknown>).summon as Record<string, number> | undefined) ?? {}).map(([id, beast]) => [Number(id), beast]))
const furies = new Set<number>(((traits as Record<string, unknown>).fury as number[] | undefined) ?? [])
const wardens = new Map<number, string>(Object.entries(((traits as Record<string, unknown>).ward as Record<string, string> | undefined) ?? {}).map(([id, reach]) => [Number(id), reach]))

export const beastOf = (id: number) => callers.get(id) ?? null

export const furyOf = (id: number) => furies.has(id)

export const wardOf = (id: number) => wardens.get(id) ?? null

const looks = new Map<number, string>(Object.entries(((traits as Record<string, unknown>).wardLook as Record<string, string> | undefined) ?? {}).map(([id, look]) => [Number(id), look]))

const lookOf = (id: number) => looks.get(id) ?? 'sand'

export const costOf = (id: number, key: ArenaAbility) => {
  if (key !== 'summon') return ARENA_ABILITIES[key]
  const beast = beastOf(id)
  const row = beast === null ? undefined : rowOf(beast)
  return row ? Math.max(1, Math.round((row[1] + row[2]) / 5)) : ARENA_ABILITIES.summon
}

const SLOTS_OF: Partial<Record<string, number>> = { summon: 1, limbo: 2 }

const callsFor = (side: ArenaSide) => side.summons.length + onBoard(side).reduce((sum, one) => sum + (one.armed ?? []).reduce((all, key) => all + (SLOTS_OF[key] ?? 0), 0), 0)

const guards = (card: ArenaCard) => !!card.ghost || tauntOf(card.id)

const skillView = (id: number, rarity: CardRarity) =>
  skillsOf(id, rarity).map((key) => ({ key, cost: costOf(id, key), ...(key === 'summon' ? { beast: beastOf(id) } : {}) }))

export const skillsOf = (id: number, rarity: CardRarity) =>
  (skills.get(id) ?? []).filter(([, need]) => CARD_RARITIES.indexOf(rarity) >= CARD_RARITIES.indexOf(need)).map(([key]) => key)

const AMATERASU_HIT = 4
const AMATERASU_BURN = 2

export function toggleAbility(doc: ArenaDoc, uid: string, key: string) {
  const card = onBoard(doc.board).find((one) => one.uid === uid)
  if (!card || !(key in ARENA_ABILITIES)) return false
  const ability = key as ArenaAbility
  if (!skillsOf(card.id, card.rarity).includes(ability)) return false
  const cost = costOf(card.id, ability)
  const armed = card.armed ?? []
  if (armed.includes(ability)) {
    card.armed = armed.filter((one) => one !== ability)
    doc.chakra = Math.min(doc.chakra + cost, doc.chakraCap)
    return true
  }
  if (doc.chakra < cost) return false
  if (callsFor(doc.board) + (SLOTS_OF[ability] ?? 0) > ARENA_SUMMON_SLOTS) return false
  card.armed = [...armed, ability]
  doc.chakra -= cost
  return true
}

function botAbilities(doc: ArenaDoc) {
  let left = doc.chakraCap
  for (const card of shuffled(onBoard(doc.foeBoard))) {
    for (const ability of skillsOf(card.id, card.rarity)) {
      const cost = costOf(card.id, ability)
      if (left < cost) continue
      if (callsFor(doc.foeBoard) + (SLOTS_OF[ability] ?? 0) > ARENA_SUMMON_SLOTS) continue
      left -= cost
      card.armed = [...(card.armed ?? []), ability]
    }
  }
}

const CACHE_MS = 15_000
let edits: Record<string, [number, number, number]> = {}
let readAt = 0

export const forgetArenaSheet = () => {
  readAt = 0
}

export async function loadArenaSheet(game: GameId) {
  if (Date.now() - readAt < CACHE_MS) return
  const rows = await (await entities())
    .find({ game, arena: { $exists: true } }, { projection: { _id: 0, id: 1, arena: 1 } })
    .toArray()
  const next: Record<string, [number, number, number]> = {}
  for (const row of rows as { id: number; arena?: unknown }[]) {
    const cell = row.arena
    if (Array.isArray(cell) && cell.length >= 3 && cell.every((one) => typeof one === 'number')) next[String(row.id)] = cell.slice(0, 3) as [number, number, number]
  }
  edits = next
  readAt = Date.now()
}

const rowOf = (id: number) => edits[String(id)] ?? sheet[String(id)]

export const tierOf = (id: number) => rowOf(id)?.[0] ?? 2

export const arenaSheet = () => ({ book: sheet, edits })

const baseOf = (id: number) => {
  const row = rowOf(id)
  if (!row) return { atk: arenaPower(2), hp: arenaPower(2) }
  return { atk: row[1], hp: row[2] }
}

export const statsOf = (id: number, _rarity: CardRarity, triple = false, power = 1) => {
  const base = baseOf(id)
  const mul = (triple ? 2 : 1) * (power || 1)
  return { atk: Math.round(base.atk * mul), hp: Math.round(base.hp * mul) }
}

const makeCard = (id: number, rarity: CardRarity, summon: boolean, seq: number, triple = false, power = 1): ArenaCard => {
  const { atk, hp } = statsOf(id, rarity, triple, power)
  return { uid: `${seq}`, id, rarity, atk, hp, max: hp, summon, ...(triple ? { triple: true } : {}) }
}

const FIGHT_LEAD_MS = 1600
const FIGHT_STEP_MS = 1360
const FIGHT_DEATH_MS = 1100
const FIGHT_SHARE = 0.85
const TURN_GRACE_MS = 4000
const FIGHT_GEN_MS = 700
const FIGHT_HEAL_MS = 650
const FIGHT_CALL_MS = 300
const FIGHT_CLAY_MS = 450

const replayMs = (steps: ArenaStep[]) => {
  let total = FIGHT_LEAD_MS
  let standing = Infinity
  for (const step of steps) {
    const now = step.mine.length + step.theirs.length
    total += FIGHT_STEP_MS + (now < standing && standing !== Infinity ? FIGHT_DEATH_MS : 0) + (step.charm || step.skip ? FIGHT_GEN_MS : 0) + (step.heals ? FIGHT_HEAL_MS : 0) + (step.summoned || step.risen ? FIGHT_CALL_MS : 0) + (step.shot === 'clay' ? FIGHT_CLAY_MS : 0)
    standing = now
  }
  return Math.round(total * FIGHT_SHARE)
}

const turnFrom = (at: number) => new Date(at + ARENA_TURN_SEC * 1000)

export const inFight = (doc: ArenaDoc) => !!doc.fightEndsAt && Date.now() < doc.fightEndsAt.getTime()

export function tick(doc: ArenaDoc) {
  if (doc.status !== 'playing' || inFight(doc) || !doc.turnEndsAt) return false
  if (Date.now() < doc.turnEndsAt.getTime() + TURN_GRACE_MS) return false
  endTurn(doc)
  return true
}

export async function arenaOf(userId: ObjectId) {
  const doc = await (await arenas()).findOne({ _id: userId })
  if (doc && !doc.turnEndsAt) doc.turnEndsAt = turnFrom(Date.now())
  if (doc && doc.coins === undefined) {
    const old = doc as ArenaDoc & { cap?: number }
    doc.coins = old.chakra ?? ARENA_COIN_START
    doc.coinCap = old.cap ?? ARENA_COIN_START
    doc.chakraCap = Math.min(ARENA_CHAKRA_START + doc.turn - 1, ARENA_CHAKRA_MAX)
    doc.chakra = doc.chakraCap
  }
  return doc
}

const rarityOf = (ranks: Record<number, CardRarity>, id: number): CardRarity => ranks[id] ?? 'paper'

const foeRanks = (mine: Record<number, CardRarity>, ids: number[]) => {
  const spread = Object.values(mine)
  const out: Record<number, CardRarity> = {}
  for (const id of ids) out[id] = spread.length ? pickOne(spread) : 'paper'
  return out
}

const foePowers = (mine: Record<number, number>, ids: number[]) => {
  const spread = Object.values(mine)
  const out: Record<number, number> = {}
  for (const id of ids) out[id] = spread.length ? pickOne(spread) : 1
  return out
}

export async function ownedRarity(userId: ObjectId, game: GameId) {
  const [owned, cards, banned] = await Promise.all([dexOf(userId, game), gradesOf(userId, game), bannedIds(game)])
  const ranks: Record<number, CardRarity> = {}
  for (const id of owned) if (!banned.has(id)) ranks[id] = cards[id]?.rarity ?? CARD_RARITIES[0]!
  return ranks
}

export async function ownedPower(userId: ObjectId, game: GameId) {
  const cards = await gradesOf(userId, game)
  const out: Record<number, number> = {}
  for (const [id, card] of Object.entries(cards)) out[Number(id)] = card.power ?? 1
  return out
}

export const tavernOf = (doc: ArenaDoc) => doc.shopTier ?? arenaTierAt(doc.turn)

export const upCostOf = (doc: ArenaDoc) => (tavernOf(doc) >= ARENA_TIERS ? 0 : (doc.up ?? arenaUpCost(tavernOf(doc))))

const TAVERN_MAIN = 3
const TAVERN_BELOW = 2

const roll = (all: number[], top: number, seen: number[] = []) => {
  const fresh = all.filter((id) => !seen.includes(id))
  const pool = fresh.filter((id) => Math.abs(tierOf(id) - top) <= 1).length >= ARENA_TAVERN ? fresh : all
  const at = (tier: number, weight: number) => pool.filter((id) => tierOf(id) === tier).map((id) => ({ id, weight }))
  let bag = [...at(top, TAVERN_MAIN), ...at(top - 1, TAVERN_BELOW)]
  for (let down = top - 2; bag.length < ARENA_TAVERN && down >= 1; down--) bag.push(...at(down, 1))
  for (let up = top + 1; bag.length < ARENA_TAVERN && up <= ARENA_TIERS; up++) bag.push(...at(up, 1))
  if (!bag.length) bag = pool.map((id) => ({ id, weight: 1 }))
  const picked: number[] = []
  while (picked.length < ARENA_TAVERN && bag.length) {
    let left = Math.random() * bag.reduce((sum, one) => sum + one.weight, 0)
    const index = Math.max(0, bag.findIndex((one) => (left -= one.weight) < 0))
    picked.push(bag[index]!.id)
    bag.splice(index, 1)
  }
  return picked
}

export async function startArena(userId: ObjectId, game: GameId) {
  await loadArenaSheet(game)
  const [ranks, powers] = await Promise.all([ownedRarity(userId, game), ownedPower(userId, game)])
  const { pool } = await gameData(game)
  const [summons, banned] = await Promise.all([summonIds(game), bannedIds(game)])
  const everyone = pool.map((one) => one.id).filter((id) => !banned.has(id) && !summons.has(id) && tierOf(id) > 0)
  if (everyone.length < ARENA_TAVERN) return null

  const doc: ArenaDoc = {
    _id: userId,
    game,
    status: 'playing',
    turn: 1,
    coins: ARENA_COIN_START,
    coinCap: ARENA_COIN_START,
    chakra: ARENA_CHAKRA_START,
    chakraCap: ARENA_CHAKRA_START,
    hp: ARENA_HP,
    foeHp: ARENA_HP,
    seq: 0,
    pool: everyone,
    ranks,
    powers,
    foeRanks: foeRanks(ranks, everyone),
    foePowers: foePowers(powers, everyone),
    summons: [...summons],
    tavern: [],
    hand: [],
    board: blankSide(),
    foeBoard: blankSide(),
    shopTier: 1,
    up: arenaUpCost(1),
    steps: [],
    startedAt: new Date(),
    updatedAt: new Date(),
  }
  doc.tavern = roll(doc.pool, 1)
  doc.spellOffer = offerSpell()
  doc.turnEndsAt = turnFrom(Date.now())
  doc.fightEndsAt = null
  await (await arenas()).replaceOne({ _id: userId }, doc, { upsert: true })
  return doc
}

const relay = (side: ArenaSide, line: ArenaCard[]) => {
  side.heroes = line.filter((card) => !card.summon).slice(0, ARENA_HERO_SLOTS)
  side.summons = line.filter((card) => card.summon).slice(0, ARENA_SUMMON_SLOTS)
}

export const freeSlot = (side: ArenaSide, summon = false) =>
  summon ? side.summons.length < ARENA_SUMMON_SLOTS : side.heroes.length < ARENA_HERO_SLOTS

const place = (side: ArenaSide, card: ArenaCard) => relay(side, [...onBoard(side), card])

export function buyCard(doc: ArenaDoc, at: number) {
  const id = doc.tavern[at]
  if (id === undefined || doc.hand.length >= ARENA_HAND) return false
  const rarity = rarityOf(doc.ranks, id)
  const cost = arenaCost()
  if (doc.coins < cost) return false
  doc.coins -= cost
  doc.seq += 1
  doc.hand.push(makeCard(id, rarity, doc.summons.includes(id), doc.seq, false, powerOf(doc.powers, id)))
  doc.tavern.splice(at, 1)
  fuse(doc, id)
  return true
}

function fuse(doc: ArenaDoc, id: number) {
  const same = (card: ArenaCard) => card.id === id && !card.triple
  const found = [...doc.hand.filter(same), ...onBoard(doc.board).filter(same)]
  if (found.length < ARENA_TRIPLE) return
  const burn = new Set(found.slice(0, ARENA_TRIPLE).map((card) => card.uid))
  doc.hand = doc.hand.filter((card) => !burn.has(card.uid))
  relay(doc.board, onBoard(doc.board).filter((card) => !burn.has(card.uid)))
  doc.seq += 1
  const first = found[0]!
  doc.hand.push(makeCard(id, first.rarity, first.summon, doc.seq, true, powerOf(doc.powers, id)))
}

export function sellCard(doc: ArenaDoc, uid: string) {
  const inHand = doc.hand.findIndex((card) => card.uid === uid)
  if (inHand >= 0) doc.hand.splice(inHand, 1)
  else {
    const line = onBoard(doc.board)
    const sold = line.find((card) => card.uid === uid)
    if (!sold) return false
    for (const ability of sold.armed ?? []) doc.chakra = Math.min(doc.chakra + (ability in ARENA_ABILITIES ? costOf(sold.id, ability as ArenaAbility) : 0), doc.chakraCap)
    relay(doc.board, line.filter((card) => card.uid !== uid))
  }
  doc.coins = Math.min(doc.coins + ARENA_SELL_BACK, ARENA_COIN_MAX)
  return true
}

export function moveCard(doc: ArenaDoc, uid: string, at: number) {
  const group = doc.board.heroes.some((card) => card.uid === uid) ? doc.board.heroes : doc.board.summons
  const from = group.findIndex((card) => card.uid === uid)
  if (from < 0 || !Number.isInteger(at) || at < 0 || at >= group.length) return false
  const [card] = group.splice(from, 1)
  group.splice(Math.min(at, group.length), 0, card!)
  return true
}

export const SPELLS = ['kawarimi'] as const

const offerSpell = () => (Math.random() < ARENA_SPELL_CHANCE ? SPELLS[0] : null)

export function buySpell(doc: ArenaDoc) {
  const spell = doc.spellOffer
  if (!spell || doc.hand.length >= ARENA_HAND || doc.coins < ARENA_SPELL_COST) return false
  doc.coins -= ARENA_SPELL_COST
  doc.seq += 1
  doc.hand.push({ uid: `${doc.seq}`, id: 0, rarity: 'paper', atk: 0, hp: 0, max: 0, summon: false, spell })
  doc.spellOffer = null
  return true
}

export function castSpell(doc: ArenaDoc, uid: string, target: string) {
  const at = doc.hand.findIndex((card) => card.uid === uid && card.spell)
  if (at < 0) return false
  const aim = onBoard(doc.board).find((card) => card.uid === target)
  if (!aim) return false
  if (doc.hand[at]!.spell === 'kawarimi') {
    if ((aim.dodge ?? 0) > 0) return false
    aim.dodge = 1
  }
  doc.hand.splice(at, 1)
  return true
}

export function playCard(doc: ArenaDoc, uid: string, to = -1) {
  const at = doc.hand.findIndex((card) => card.uid === uid)
  if (at < 0) return false
  const card = doc.hand[at]!
  if (card.spell) return false
  if (!freeSlot(doc.board, card.summon)) return false
  doc.hand.splice(at, 1)
  const group = card.summon ? doc.board.summons : doc.board.heroes
  group.splice(Number.isInteger(to) && to >= 0 ? Math.min(to, group.length) : group.length, 0, card)
  return true
}

export function rollTavern(doc: ArenaDoc) {
  if (doc.coins < ARENA_ROLL_COST) return false
  doc.coins -= ARENA_ROLL_COST
  doc.tavern = roll(doc.pool, tavernOf(doc), doc.tavern)
  doc.spellOffer = offerSpell()
  return true
}

export function upTavern(doc: ArenaDoc) {
  const now = tavernOf(doc)
  if (now >= ARENA_TIERS) return false
  const cost = upCostOf(doc)
  if (doc.coins < cost) return false
  doc.coins -= cost
  doc.shopTier = now + 1
  doc.up = arenaUpCost(now + 1)
  return true
}

const powerOf = (map: Record<number, number> | undefined, id: number) => map?.[id] ?? 1

const BOT_TAUNTS = 2
const BOT_TAUNT_BONUS = 4

const guardsOf = (side: ArenaSide) => onBoard(side).filter((card) => tauntOf(card.id)).length

const bonusOf = (side: ArenaSide, id: number, owned = false) => {
  if (!tauntOf(id)) return 0
  const have = guardsOf(side) - (owned ? 1 : 0)
  return have < BOT_TAUNTS ? BOT_TAUNT_BONUS : 0
}

const worth = (doc: ArenaDoc, id: number) => {
  const { atk, hp } = statsOf(id, rarityOf(doc.foeRanks, id), false, powerOf(doc.foePowers, id))
  return atk + hp + bonusOf(doc.foeBoard, id)
}

const valueOf = (side: ArenaSide, card: ArenaCard) => card.atk + card.hp + bonusOf(side, card.id, true)

const weakest = (side: ArenaSide) =>
  onBoard(side)
    .slice()
    .sort((a, b) => valueOf(side, a) - valueOf(side, b))[0]

function botTurn(doc: ArenaDoc) {
  let left = Math.min(ARENA_COIN_START + doc.turn - 1, ARENA_COIN_MAX)
  let tier = doc.foeShop ?? arenaTierAt(doc.turn)
  let up = doc.foeUp ?? arenaUpCost(tier)
  const cost = arenaCost()

  if (tier < ARENA_TIERS && left >= up && (left - up >= cost || !freeSlot(doc.foeBoard))) {
    left -= up
    tier += 1
    up = arenaUpCost(tier)
  } else if (tier < ARENA_TIERS) {
    up = Math.max(ARENA_UP_MIN, up - 1)
  }

  let offers = roll(doc.pool, tier).sort((a, b) => worth(doc, b) - worth(doc, a))
  while (left >= cost) {
    const id = offers.shift()
    if (id === undefined) {
      if (left < cost + ARENA_ROLL_COST) break
      left -= ARENA_ROLL_COST
      offers = roll(doc.pool, tier).sort((a, b) => worth(doc, b) - worth(doc, a))
      continue
    }
    if (!freeSlot(doc.foeBoard)) {
      const poorest = weakest(doc.foeBoard)
      if (!poorest || valueOf(doc.foeBoard, poorest) >= worth(doc, id)) break
      relay(doc.foeBoard, onBoard(doc.foeBoard).filter((card) => card.uid !== poorest.uid))
      left += ARENA_SELL_BACK
    }
    left -= cost
    doc.seq += 1
    place(doc.foeBoard, makeCard(id, rarityOf(doc.foeRanks, id), doc.summons.includes(id), doc.seq, false, powerOf(doc.foePowers, id)))
  }

  doc.foeShop = tier
  doc.foeUp = up
}

const copySide = (side: ArenaSide): ArenaSide => ({ heroes: side.heroes.map((one) => ({ ...one })), summons: side.summons.map((one) => ({ ...one })) })

function fight(doc: ArenaDoc) {
  const steps: ArenaStep[] = []
  const ours = copySide(doc.board)
  const foes = copySide(doc.foeBoard)
  const mine = alive(ours)
  const theirs = alive(foes)
  const weStart = doc.turn % 2 === 1
  doc.opened = { hp: doc.hp, foeHp: doc.foeHp }

  const snap = () => ({
    hp: doc.hp,
    foeHp: doc.foeHp,
    mine: onBoard(ours).map((one) => ({ ...one })),
    theirs: onBoard(foes).map((one) => ({ ...one })),
  })

  const start = new Map([...onBoard(ours), ...onBoard(foes)].map((one) => [one.uid, one.atk]))
  const raisers = new Map<ArenaSide, ArenaCard>()
  const graves: { side: ArenaSide; card: ArenaCard; at: number; by: ArenaCard }[] = []

  const bury = () => {
    for (const side of [ours, foes]) {
      const by = raisers.get(side)
      if (!by) continue
      const fallen = side.heroes.filter((one) => one.hp <= 0)
      if (!fallen.length) continue
      raisers.delete(side)
      const card = fallen.find((one) => one !== by)
      if (!card) continue
      const at = side.heroes.slice(0, side.heroes.indexOf(card)).filter((one) => one.hp > 0).length
      graves.push({ side, card, at, by })
    }
    drop(ours)
    drop(foes)
  }

  const rise = () => {
    for (const { side, card, at, by } of graves.splice(0)) {
      card.hp = card.max
      card.atk = start.get(card.uid) ?? card.atk
      card.stun = false
      card.burn = 0
      card.bound = null
      card.link = null
      card.ward = false
      card.dodge = 0
      side.heroes.splice(Math.min(at, side.heroes.length), 0, card)
      steps.push({ from: by.uid, to: card.uid, risen: card.uid, ability: 'revive', damage: 0, dead: false, foe: side === foes, ...snap() })
    }
  }

  const strongest = (list: ArenaCard[]) => list.slice().sort((a, b) => b.atk + b.hp - (a.atk + a.hp))[0]

  const sides = [
    [ours, foes, false],
    [foes, ours, true],
  ] as const
  for (const [team, rivals, foe] of weStart ? sides : [sides[1], sides[0]]) {
    for (const card of alive(team)) {
      if (soundOf(card.id)) card.sonic = true
      for (const ability of card.armed ?? []) {
        if (ability === 'genjutsu') {
          const open = alive(rivals).filter((one) => !one.stun)
          if (!open.length) continue
          const target = pickOne(open)
          target.stun = true
          steps.push({ from: card.uid, to: target.uid, charm: true, ability, damage: 0, dead: false, foe, ...snap() })
        } else if (ability === 'amaterasu') {
          const target = strongest(alive(rivals))
          if (!target) continue
          target.hp -= AMATERASU_HIT
          target.burn = (target.burn ?? 0) + AMATERASU_BURN
          const dead = target.hp <= 0
          bury()
          steps.push({ from: card.uid, to: target.uid, ability, damage: AMATERASU_HIT, dead, foe, ...snap() })
          rise()
        } else if (ability === 'mind') {
          const target = alive(rivals)
            .filter((one) => !one.bound)
            .sort((a, b) => b.atk - a.atk)[0]
          if (!target) continue
          target.bound = card.uid
          card.link = target.uid
          steps.push({ from: card.uid, to: target.uid, ability, damage: 0, dead: false, foe, ...snap() })
        } else if (ability === 'swap') {
          card.swap = true
        } else if (ability === 'sonic') {
          card.sonic = true
        } else if (ability === 'summon') {
          const beast = beastOf(card.id)
          if (beast === null || team.summons.length >= ARENA_SUMMON_SLOTS) continue
          const { atk, hp } = statsOf(beast, card.rarity, !!card.triple, powerOf(foe ? doc.foePowers : doc.powers, card.id))
          doc.seq += 1
          const spawn: ArenaCard = { uid: `${doc.seq}`, id: beast, rarity: card.rarity, atk, hp, max: hp, summon: true }
          team.summons.push(spawn)
          steps.push({ from: card.uid, to: spawn.uid, summoned: [spawn.uid], ability, damage: 0, dead: false, foe, ...snap() })
        } else if (ability === 'limbo') {
          const clones: string[] = []
          for (let i = 0; i < 2 && team.summons.length < ARENA_SUMMON_SLOTS; i++) {
            const hp = Math.ceil(card.max / 2)
            doc.seq += 1
            const spawn: ArenaCard = { uid: `${doc.seq}`, id: card.id, rarity: card.rarity, atk: Math.ceil(card.atk / 2), hp, max: hp, summon: true, ghost: true }
            team.summons.push(spawn)
            clones.push(spawn.uid)
          }
          if (clones.length) steps.push({ from: card.uid, to: clones[0]!, summoned: clones, ability, damage: 0, dead: false, foe, ...snap() })
        } else if (ability === 'revive') {
          raisers.set(team, card)
        }
      }
    }
    for (const card of alive(team)) {
      const reach = wardOf(card.id)
      if (!reach) continue
      const at = team.heroes.indexOf(card)
      const covered =
        reach === 'all' ? alive(team) : reach === 'near' ? [team.heroes[at - 1], team.heroes[at + 1]].filter((one): one is ArenaCard => !!one && one.hp > 0) : [card]
      const fresh = covered.filter((one) => !one.ward)
      if (!fresh.length) continue
      for (const one of fresh) one.ward = lookOf(card.id)
      steps.push({ from: card.uid, to: null, wards: fresh.map((one) => one.uid), ability: 'ward', damage: 0, dead: false, foe, ...snap() })
    }
  }

  const release = (ino: ArenaCard) => {
    if (!ino.link) return
    for (const one of [...onBoard(ours), ...onBoard(foes)]) if (one.bound === ino.uid) one.bound = null
    ino.link = null
  }

  const swing = (card: ArenaCard | undefined, side: ArenaSide, foe: boolean) => {
    if (!card || card.hp <= 0 || !doc.hp || !doc.foeHp) return
    if (card.burn) {
      card.hp -= card.burn
      const dead = card.hp <= 0
      if (dead) for (const one of [...onBoard(ours), ...onBoard(foes)]) if (one.uid === card.uid) release(one)
      bury()
      steps.push({ from: card.uid, to: card.uid, ability: 'burn', damage: card.burn, dead, foe, ...snap() })
      rise()
      if (dead) return
    }
    if (card.bound) {
      const ino = [...alive(ours), ...alive(foes)].find((one) => one.uid === card.bound)
      if (ino) {
        steps.push({ from: card.uid, to: null, skip: true, ability: 'mind', damage: 0, dead: false, foe, ...snap() })
        return
      }
      card.bound = null
    }
    if (card.link && [...alive(ours), ...alive(foes)].some((one) => one.uid === card.link)) {
      steps.push({ from: card.uid, to: null, skip: true, ability: 'mind', damage: 0, dead: false, foe, ...snap() })
      return
    }
    if (card.stun) {
      card.stun = false
      steps.push({ from: card.uid, to: null, skip: true, damage: 0, dead: false, foe, ...snap() })
      return
    }
    strike(card, side, foe, false)
    if (furyOf(card.id) && card.hp > 0 && doc.hp && doc.foeHp && alive(side).length) strike(card, side, foe, true)
  }

  const strike = (card: ArenaCard, side: ArenaSide, foe: boolean, again: boolean) => {
    const blow = card.atk
    const targets = alive(side)
    let to: string | null = null
    let dead = false
    const splash: string[] = []
    const dodged: string[] = []
    const sapped: string[] = []
    const warded: string[] = []
    const raged: string[] = []
    let venom = false
    let swapFrom: string | undefined
    let swapTo: string | undefined
    const heals: Record<string, number> = {}
    const mend = (one: ArenaCard) => {
      if (one.hp <= 0) return
      const team = onBoard(ours).includes(one) ? ours : foes
      const medics = alive(team).filter((other) => other !== one && medicOf(other.id)).length
      if (!medics || one.hp >= one.max) return
      const before = one.hp
      one.hp = Math.min(one.max, one.hp + medics)
      heals[one.uid] = (heals[one.uid] ?? 0) + one.hp - before
    }
    const sap = (one: ArenaCard) => {
      if (one.hp <= 0) return
      one.atk = Math.max(0, one.atk - 1)
      one.hp = Math.max(1, one.hp - 1)
      sapped.push(one.uid)
    }
    const harm = (one: ArenaCard, damage: number) => {
      if (damage <= 0) return
      if (one.link) release(one)
      if (one.ward) {
        one.ward = false
        warded.push(one.uid)
        return
      }
      if (one.swap) {
        one.swap = false
        const mates = alive(foe ? foes : ours).filter((other) => other.uid !== card.uid)
        const stand = mates.length ? pickOne(mates) : card
        stand.hp -= damage
        swapFrom = one.uid
        swapTo = stand.uid
        return
      }
      if ((one.dodge ?? 0) > 0) {
        one.dodge = (one.dodge ?? 0) - 1
        dodged.push(one.uid)
        return
      }
      one.hp -= damage
      if (poisonOf(card.id)) {
        one.hp = 0
        venom = true
      }
      if (furyOf(one.id) && one.hp > 0) {
        one.atk += 1
        raged.push(one.uid)
      }
      if (card.sonic) sap(one)
      mend(one)
    }
    if (!targets.length) {
      if (foe) doc.hp = Math.max(0, doc.hp - blow)
      else doc.foeHp = Math.max(0, doc.foeHp - blow)
    } else {
      const walls = targets.filter(guards)
      const target = pickOne(walls.length ? walls : targets)
      if (cleaveOf(card.id)) {
        const at = targets.indexOf(target)
        for (const near of [targets[at - 1], targets[at + 1]]) {
          if (!near) continue
          harm(near, blow)
          splash.push(near.uid)
        }
      }
      harm(target, blow)
      if (!shotOf(card.id) && target.atk > 0 && swapFrom !== target.uid) {
        if (card.ward) {
          card.ward = false
          warded.push(card.uid)
        } else {
          card.hp -= target.atk
          if (poisonOf(target.id)) card.hp = 0
          if (furyOf(card.id) && card.hp > 0) {
            card.atk += 1
            raged.push(card.uid)
          }
          mend(card)
        }
      }
      to = target.uid
      dead = target.hp <= 0
    }
    bury()
    steps.push({
      from: card.uid,
      to,
      ...(again ? { again } : {}),
      ...(warded.length ? { warded } : {}),
      ...(raged.length ? { raged } : {}),
      ...(splash.length ? { splash } : {}),
      ...(to && shotOf(card.id) ? { shot: shotOf(card.id)! } : {}),
      ...(dodged.length ? { dodged } : {}),
      ...(sapped.length ? { sapped } : {}),
      ...(venom ? { venom } : {}),
      ...(swapFrom && swapTo ? { swapFrom, swapTo } : {}),
      ...(Object.keys(heals).length ? { heals } : {}),
      damage: blow,
      dead,
      foe,
      hp: doc.hp,
      foeHp: doc.foeHp,
      mine: onBoard(ours).map((one) => ({ ...one })),
      theirs: onBoard(foes).map((one) => ({ ...one })),
    })
    rise()
  }

  const empty = () => !alive(ours).length || !alive(foes).length
  const over = () => !doc.hp || !doc.foeHp

  for (let round = 0; round < ARENA_ROUNDS && !empty() && !over(); round++) {
    const left = alive(ours)
    const right = alive(foes)
    for (let step = 0; step < Math.max(left.length, right.length); step++) {
      if (weStart) {
        if (empty() || over()) break
        swing(left[step], foes, false)
        if (empty() || over()) break
        swing(right[step], ours, true)
      } else {
        if (empty() || over()) break
        swing(right[step], ours, true)
        if (empty() || over()) break
        swing(left[step], foes, false)
      }
    }
  }

  if (!over()) {
    const ourTurn = alive(ours).length > 0
    const crew = ourTurn ? alive(ours) : alive(foes)
    if (crew.length) {
      const damage = bash(crew)
      if (ourTurn) doc.foeHp = Math.max(0, doc.foeHp - damage)
      else doc.hp = Math.max(0, doc.hp - damage)
      steps.push({
        from: crew[0]!.uid,
        all: crew.map((card) => card.uid),
        to: null,
        damage,
        dead: false,
        foe: !ourTurn,
        hp: doc.hp,
        foeHp: doc.foeHp,
        mine: onBoard(ours).map((one) => ({ ...one })),
        theirs: onBoard(foes).map((one) => ({ ...one })),
      })
    }
  }

  doc.steps = steps
  doc.clash = { mine: onBoard(ours), theirs: onBoard(foes) }
  if (!doc.foeHp && !doc.hp) doc.status = 'lost'
  else if (!doc.foeHp) doc.status = 'won'
  else if (!doc.hp) doc.status = 'lost'
}

export function endTurn(doc: ArenaDoc) {
  if (doc.status !== 'playing') return doc
  botTurn(doc)
  botAbilities(doc)
  doc.armed = [...onBoard(doc.board), ...onBoard(doc.foeBoard)].filter((card) => (card.dodge ?? 0) > 0).map((card) => card.uid)
  fight(doc)
  for (const card of [...onBoard(doc.board), ...onBoard(doc.foeBoard)]) {
    delete card.dodge
    delete card.armed
  }
  const settled = Date.now() + replayMs(doc.steps ?? [])
  doc.fightEndsAt = new Date(settled)
  doc.turnEndsAt = turnFrom(settled)
  if (doc.status !== 'playing') return doc
  doc.turn += 1
  doc.coinCap = Math.min(ARENA_COIN_START + doc.turn - 1, ARENA_COIN_MAX)
  doc.coins = doc.coinCap
  doc.chakraCap = Math.min(ARENA_CHAKRA_START + doc.turn - 1, ARENA_CHAKRA_MAX)
  doc.chakra = doc.chakraCap
  doc.shopTier = tavernOf(doc)
  doc.up = Math.max(ARENA_UP_MIN, upCostOf(doc) - 1)
  doc.tavern = roll(doc.pool, doc.shopTier, doc.tavern)
  doc.spellOffer = offerSpell()
  return doc
}

const ranked = (card: ArenaCard) => ({ ...card, tier: tierOf(card.id), taunt: guards(card), cleave: cleaveOf(card.id), shot: shotOf(card.id), poison: poisonOf(card.id), sound: soundOf(card.id), medic: medicOf(card.id), fury: furyOf(card.id), guard: wardOf(card.id), skills: skillView(card.id, card.rarity), armed: card.armed ?? [] })

const rankedSide = (side: ArenaSide) => ({ heroes: side.heroes.map(ranked), summons: side.summons.map(ranked) })

export const arenaView = (doc: ArenaDoc) => ({
  status: doc.status,
  turn: doc.turn,
  seq: doc.seq,
  coins: doc.coins,
  coinsMax: doc.coinCap,
  chakra: doc.chakra,
  chakraMax: doc.chakraCap,
  tavernTier: tavernOf(doc),
  spellOffer: doc.spellOffer ? { kind: doc.spellOffer, cost: ARENA_SPELL_COST } : null,
  now: Date.now(),
  turnEndsAt: doc.turnEndsAt?.getTime() ?? Date.now() + ARENA_TURN_SEC * 1000,
  fightEndsAt: doc.fightEndsAt?.getTime() ?? null,
  armed: doc.armed ?? [],
  upCost: upCostOf(doc),
  rollCost: ARENA_ROLL_COST,
  turnSec: ARENA_TURN_SEC,
  hp: doc.hp,
  foeHp: doc.foeHp,
  tavern: doc.tavern.map((id) => {
    const rarity = rarityOf(doc.ranks, id)
    const power = powerOf(doc.powers, id)
    const { atk, hp } = statsOf(id, rarity, false, power)
    return { id, rarity, cost: arenaCost(), atk, hp, summon: doc.summons.includes(id), tier: tierOf(id), taunt: tauntOf(id), cleave: cleaveOf(id), shot: shotOf(id), poison: poisonOf(id), sound: soundOf(id), medic: medicOf(id), fury: furyOf(id), guard: wardOf(id), skills: skillView(id, rarity), power }
  }),
  hand: doc.hand.map(ranked),
  board: rankedSide(doc.board),
  foeBoard: rankedSide(doc.foeBoard),
  steps: (doc.steps ?? []).map((step) => ({ ...step, mine: step.mine.map(ranked), theirs: step.theirs.map(ranked) })),
  opened: doc.opened ?? null,
  clash: doc.clash ? { mine: doc.clash.mine.map(ranked), theirs: doc.clash.theirs.map(ranked) } : null,
})

export const tiersOf = (ranks: Record<number, CardRarity>) =>
  Object.fromEntries(Object.entries(ranks).map(([id, rarity]) => [id, CARD_RARITIES.indexOf(rarity)]))
