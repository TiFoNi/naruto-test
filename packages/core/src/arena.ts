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
  arenaBonus,
  arenaPower,
  arenaTierAt,
  ARENA_SUMMON_SLOTS,
  ARENA_TAVERN,
  CARD_RARITIES,
  arenaCost,
  cardRank,
  type CardRarity,
  type GameId,
} from '@nanda/game'
import tiers from '@nanda/game/data/arena-naruto.json'
import { arenas, type ArenaCard, type ArenaDoc, type ArenaSide } from './db'
import { cardsOf, dexOf } from './dex'
import { gameData } from './games'

const ARENA_ROUNDS = 12

export type ArenaStep = {
  from: string
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

export const tierOf = (id: number) => Number((tiers as Record<string, number>)[String(id)] ?? 2)

export const statsOf = (id: number, rarity: CardRarity, triple = false) => {
  const base = arenaPower(tierOf(id))
  const gain = arenaBonus(rarity)
  const mul = triple ? 2 : 1
  return { atk: (base + gain.atk) * mul, hp: (base + gain.hp) * mul }
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

const roll = (pool: number[], turn: number) => {
  const top = arenaTierAt(turn)
  const fit = pool.filter((id) => tierOf(id) <= top)
  const list = fit.length >= ARENA_TAVERN ? fit : pool.filter((id) => tierOf(id) <= Math.min(ARENA_TIERS, top + 1))
  return shuffled(list.length ? list : pool).slice(0, Math.min(ARENA_TAVERN, list.length || pool.length))
}

export async function startArena(userId: ObjectId, game: GameId) {
  const ranks = await ownedRarity(userId, game)
  const { pool } = await gameData(game)
  const [summons, banned] = await Promise.all([summonIds(game), bannedIds(game)])
  const everyone = pool.map((one) => one.id).filter((id) => !banned.has(id) && !summons.has(id))
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
    steps: [],
    startedAt: new Date(),
    updatedAt: new Date(),
  }
  doc.tavern = roll(doc.pool, 1)
  await (await arenas()).replaceOne({ _id: userId }, doc, { upsert: true })
  return doc
}

export const freeSlot = (side: ArenaSide, summon: boolean) =>
  summon ? side.summons.length < ARENA_SUMMON_SLOTS : side.heroes.length < ARENA_HERO_SLOTS

const place = (side: ArenaSide, card: ArenaCard) => {
  if (card.summon) side.summons.push(card)
  else side.heroes.push(card)
}

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
  doc.board.heroes = doc.board.heroes.filter((card) => !burn.has(card.uid))
  doc.board.summons = doc.board.summons.filter((card) => !burn.has(card.uid))
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
    doc.board.heroes = doc.board.heroes.filter((card) => card.uid !== uid)
    doc.board.summons = doc.board.summons.filter((card) => card.uid !== uid)
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
  doc.board.heroes = line.filter((one) => !one.summon)
  doc.board.summons = line.filter((one) => one.summon)
  return true
}

export function playCard(doc: ArenaDoc, uid: string) {
  const at = doc.hand.findIndex((card) => card.uid === uid)
  if (at < 0) return false
  const card = doc.hand[at]!
  if (!freeSlot(doc.board, card.summon)) return false
  doc.hand.splice(at, 1)
  place(doc.board, card)
  return true
}

function botTurn(doc: ArenaDoc) {
  let left = Math.min(ARENA_CHAKRA_START + doc.turn - 1, ARENA_CHAKRA_MAX)
  const offers = roll(doc.pool, doc.turn)
  for (const id of offers) {
    const rarity = rarityOf(doc.foeRanks, id)
    const cost = arenaCost()
    const summon = doc.summons.includes(id)
    if (cost > left || !freeSlot(doc.foeBoard, summon)) continue
    left -= cost
    doc.seq += 1
    place(doc.foeBoard, makeCard(id, rarity, summon, doc.seq))
  }
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
    for (const card of ourTurn ? alive(ours) : alive(foes)) {
      if (over()) break
      swing(card, ourTurn ? foes : ours, !ourTurn)
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
  doc.tavern = roll(doc.pool, doc.turn)
  return doc
}

export const arenaView = (doc: ArenaDoc) => ({
  status: doc.status,
  turn: doc.turn,
  chakra: doc.chakra,
  chakraMax: doc.cap,
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
