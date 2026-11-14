import type { ObjectId } from 'mongodb'
import {
  ARENA_CHAKRA_MAX,
  ARENA_CHAKRA_START,
  ARENA_SELL_BACK,
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
  ARENA_SUMMON_SLOTS,
  ARENA_TAVERN,
  CARD_RARITIES,
  arenaCost,
  cardRank,
  type CardRarity,
  type GameId,
} from '@nanda/game'
import tiers from '@nanda/game/data/arena-naruto.json'
import { arenas, entities, type ArenaCard, type ArenaDoc, type ArenaSide } from './db'
import { cardsOf, dexOf } from './dex'
import { gameData } from './games'

const ARENA_ROUNDS = 12

export type ArenaStep = {
  from: string
  all?: string[]
  to: string | null
  damage: number
  dead: boolean
  foe: boolean
  hp: number
  foeHp: number
  mine: ArenaCard[]
  theirs: ArenaCard[]
}

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

const bash = (crew: ArenaCard[]) => crew.reduce((sum, card) => sum + card.atk, 0)

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

export const statsOf = (id: number, _rarity: CardRarity, triple = false) => {
  const base = baseOf(id)
  const mul = triple ? 2 : 1
  return { atk: base.atk * mul, hp: base.hp * mul }
}

const makeCard = (id: number, rarity: CardRarity, summon: boolean, seq: number, triple = false): ArenaCard => {
  const { atk, hp } = statsOf(id, rarity, triple)
  return { uid: `${seq}`, id, rarity, atk, hp, max: hp, summon, ...(triple ? { triple: true } : {}) }
}

export async function arenaOf(userId: ObjectId) {
  return (await arenas()).findOne({ _id: userId })
}

const rarityOf = (ranks: Record<number, CardRarity>, id: number): CardRarity => ranks[id] ?? 'paper'

const foeRanks = (mine: Record<number, CardRarity>, ids: number[]) => {
  const spread = Object.values(mine)
  const out: Record<number, CardRarity> = {}
  for (const id of ids) out[id] = spread.length ? pickOne(spread) : 'paper'
  return out
}

export async function ownedRarity(userId: ObjectId, game: GameId) {
  const [owned, cards, banned] = await Promise.all([dexOf(userId, game), cardsOf(userId, game), bannedIds(game)])
  const ranks: Record<number, CardRarity> = {}
  for (const id of owned) if (!banned.has(id)) ranks[id] = cardRank(cards[id]?.xp ?? 0).rarity
  return ranks
}

export const tavernOf = (doc: ArenaDoc) => doc.shopTier ?? arenaTierAt(doc.turn)

export const upCostOf = (doc: ArenaDoc) => (tavernOf(doc) >= ARENA_TIERS ? 0 : (doc.up ?? arenaUpCost(tavernOf(doc))))

const roll = (pool: number[], top: number) => {
  let list = pool.filter((id) => tierOf(id) <= top)
  for (let up = top + 1; list.length < ARENA_TAVERN && up <= ARENA_TIERS; up++) list = pool.filter((id) => tierOf(id) <= up)
  if (!list.length) list = pool
  return shuffled(list).slice(0, Math.min(ARENA_TAVERN, list.length))
}

export async function startArena(userId: ObjectId, game: GameId) {
  await loadArenaSheet(game)
  const ranks = await ownedRarity(userId, game)
  const { pool } = await gameData(game)
  const [summons, banned] = await Promise.all([summonIds(game), bannedIds(game)])
  const everyone = pool.map((one) => one.id).filter((id) => !banned.has(id) && !summons.has(id) && tierOf(id) > 0)
  if (everyone.length < ARENA_TAVERN) return null

  const doc: ArenaDoc = {
    _id: userId,
    game,
    status: 'playing',
    turn: 1,
    chakra: ARENA_CHAKRA_START,
    cap: ARENA_CHAKRA_START,
    hp: ARENA_HP,
    foeHp: ARENA_HP,
    seq: 0,
    pool: everyone,
    ranks,
    foeRanks: foeRanks(ranks, everyone),
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
  await (await arenas()).replaceOne({ _id: userId }, doc, { upsert: true })
  return doc
}

const ARENA_SLOTS = ARENA_HERO_SLOTS + ARENA_SUMMON_SLOTS

const relay = (side: ArenaSide, line: ArenaCard[]) => {
  side.heroes = line.slice(0, ARENA_HERO_SLOTS)
  side.summons = line.slice(ARENA_HERO_SLOTS)
}

export const freeSlot = (side: ArenaSide) => onBoard(side).length < ARENA_SLOTS

const place = (side: ArenaSide, card: ArenaCard) => relay(side, [...onBoard(side), card])

export function buyCard(doc: ArenaDoc, at: number) {
  const id = doc.tavern[at]
  if (id === undefined || doc.hand.length >= ARENA_HAND) return false
  const rarity = rarityOf(doc.ranks, id)
  const cost = arenaCost()
  if (doc.chakra < cost) return false
  doc.chakra -= cost
  doc.seq += 1
  doc.hand.push(makeCard(id, rarity, doc.summons.includes(id), doc.seq))
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
  doc.hand.push(makeCard(id, first.rarity, first.summon, doc.seq, true))
}

export function sellCard(doc: ArenaDoc, uid: string) {
  const inHand = doc.hand.findIndex((card) => card.uid === uid)
  if (inHand >= 0) doc.hand.splice(inHand, 1)
  else {
    const line = onBoard(doc.board)
    if (!line.some((card) => card.uid === uid)) return false
    relay(doc.board, line.filter((card) => card.uid !== uid))
  }
  doc.chakra = Math.min(doc.chakra + ARENA_SELL_BACK, ARENA_CHAKRA_MAX)
  return true
}

export function moveCard(doc: ArenaDoc, uid: string, at: number) {
  const line = onBoard(doc.board)
  const from = line.findIndex((card) => card.uid === uid)
  if (from < 0 || !Number.isInteger(at) || at < 0 || at >= line.length) return false
  const [card] = line.splice(from, 1)
  line.splice(Math.min(at, line.length), 0, card!)
  relay(doc.board, line)
  return true
}

export function playCard(doc: ArenaDoc, uid: string) {
  const at = doc.hand.findIndex((card) => card.uid === uid)
  if (at < 0) return false
  const card = doc.hand[at]!
  if (!freeSlot(doc.board)) return false
  doc.hand.splice(at, 1)
  place(doc.board, card)
  return true
}

export function rollTavern(doc: ArenaDoc) {
  if (doc.chakra < ARENA_ROLL_COST) return false
  doc.chakra -= ARENA_ROLL_COST
  doc.tavern = roll(doc.pool, tavernOf(doc))
  return true
}

export function upTavern(doc: ArenaDoc) {
  const now = tavernOf(doc)
  if (now >= ARENA_TIERS) return false
  const cost = upCostOf(doc)
  if (doc.chakra < cost) return false
  doc.chakra -= cost
  doc.shopTier = now + 1
  doc.up = arenaUpCost(now + 1)
  return true
}

const worth = (doc: ArenaDoc, id: number) => {
  const { atk, hp } = statsOf(id, rarityOf(doc.foeRanks, id))
  return atk + hp
}

const weakest = (side: ArenaSide) =>
  onBoard(side)
    .slice()
    .sort((a, b) => a.atk + a.hp - (b.atk + b.hp))[0]

function botTurn(doc: ArenaDoc) {
  let left = Math.min(ARENA_CHAKRA_START + doc.turn - 1, ARENA_CHAKRA_MAX)
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
      if (!poorest || poorest.atk + poorest.hp >= worth(doc, id)) break
      relay(doc.foeBoard, onBoard(doc.foeBoard).filter((card) => card.uid !== poorest.uid))
      left += ARENA_SELL_BACK
    }
    left -= cost
    doc.seq += 1
    place(doc.foeBoard, makeCard(id, rarityOf(doc.foeRanks, id), doc.summons.includes(id), doc.seq))
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

  const swing = (card: ArenaCard | undefined, side: ArenaSide, foe: boolean) => {
    if (!card || card.hp <= 0 || !doc.hp || !doc.foeHp) return
    const targets = alive(side)
    let to: string | null = null
    let dead = false
    if (!targets.length) {
      if (foe) doc.hp = Math.max(0, doc.hp - card.atk)
      else doc.foeHp = Math.max(0, doc.foeHp - card.atk)
    } else {
      const target = pickOne(targets)
      target.hp -= card.atk
      card.hp -= target.atk
      to = target.uid
      dead = target.hp <= 0
    }
    drop(ours)
    drop(foes)
    steps.push({
      from: card.uid,
      to,
      damage: card.atk,
      dead,
      foe,
      hp: doc.hp,
      foeHp: doc.foeHp,
      mine: onBoard(ours).map((one) => ({ ...one })),
      theirs: onBoard(foes).map((one) => ({ ...one })),
    })
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
  fight(doc)
  if (doc.status !== 'playing') return doc
  doc.turn += 1
  doc.cap = Math.min(ARENA_CHAKRA_START + doc.turn - 1, ARENA_CHAKRA_MAX)
  doc.chakra = doc.cap
  doc.shopTier = tavernOf(doc)
  doc.up = Math.max(ARENA_UP_MIN, upCostOf(doc) - 1)
  doc.tavern = roll(doc.pool, doc.shopTier)
  return doc
}

export const arenaView = (doc: ArenaDoc) => ({
  status: doc.status,
  turn: doc.turn,
  chakra: doc.chakra,
  chakraMax: doc.cap,
  tavernTier: tavernOf(doc),
  upCost: upCostOf(doc),
  rollCost: ARENA_ROLL_COST,
  hp: doc.hp,
  foeHp: doc.foeHp,
  tavern: doc.tavern.map((id) => {
    const rarity = rarityOf(doc.ranks, id)
    const { atk, hp } = statsOf(id, rarity)
    return { id, rarity, cost: arenaCost(), atk, hp, summon: doc.summons.includes(id), tier: tierOf(id) }
  }),
  hand: doc.hand,
  board: doc.board,
  foeBoard: doc.foeBoard,
  steps: doc.steps ?? [],
  opened: doc.opened ?? null,
  clash: doc.clash ?? null,
})

export const tiersOf = (ranks: Record<number, CardRarity>) =>
  Object.fromEntries(Object.entries(ranks).map(([id, rarity]) => [id, CARD_RARITIES.indexOf(rarity)]))
