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
  arenaTurnSec,
  ARENA_SUMMON_SLOTS,
  ARENA_TAVERN,
  ARENA_CLANS,
  ARENA_ROTATION,
  CARD_RARITIES,
  rankOf,
  type ArenaClan,
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
const bag = traits as Record<string, unknown>
const listOf = (key: string) => new Set<number>((bag[key] as number[] | undefined) ?? [])
const mapOf = <T>(key: string) => new Map<number, T>(Object.entries((bag[key] as Record<string, T> | undefined) ?? {}).map(([id, value]) => [Number(id), value]))

const taunts = listOf('taunt')
const venoms = listOf('poison')
const singers = listOf('sound')
const furies = listOf('fury')
const biters = listOf('bite')
const tailed = listOf('tailed')
const shooters = mapOf<string>('ranged')
const healers = mapOf<number>('medic')
const wardens = mapOf<string>('ward')
const looks = mapOf<string>('wardLook')
const callers = mapOf<number>('summon')
const clans = mapOf<ArenaClan>('faction')
const mythics = mapOf<string>('mythic')
const skills = mapOf<[ArenaAbility, CardRarity][]>('abilities')
const captains = mapOf<[string, number, number]>('captain')
const cries = mapOf<[string, number, number]>('cry')
type Counter = { by: number[]; together?: boolean; vs: { ids?: number[]; clan?: string; tailed?: boolean }; mul: number; pierce?: boolean }
const counters = ((bag.counters as Counter[] | undefined) ?? []).map((one) => ({ ...one, by: [...one.by] }))
const teams = ((bag.parties as { key: string; ids: number[]; atk: number; hp: number }[] | undefined) ?? []).map((one) => ({ ...one, ids: [...one.ids] }))

const BRONZE = 1
const SILVER = 2
const GOLD = 3
const LEGEND = 4
const MYTHIC = 5

const reach = (rarity: CardRarity, step: number) => rankOf(rarity) >= step

const level = (has: boolean, rarity: CardRarity) => (!has || !reach(rarity, BRONZE) ? 0 : reach(rarity, LEGEND) ? 2 : 1)

export const shotOf = (id: number) => shooters.get(id) ?? null

export const tauntOf = (id: number, rarity: CardRarity) => level(taunts.has(id), rarity) > 0

export const poisonOf = (id: number, rarity: CardRarity) => level(venoms.has(id), rarity)

export const soundOf = (id: number, rarity: CardRarity) => level(singers.has(id), rarity)

export const furyOf = (id: number, rarity: CardRarity) => level(furies.has(id), rarity)

export const healOf = (id: number, rarity: CardRarity) => {
  const base = healers.get(id) ?? 0
  return level(base > 0, rarity) ? base + (reach(rarity, LEGEND) ? 1 : 0) : 0
}

export const wardOf = (id: number, rarity: CardRarity) => {
  const reachOf = wardens.get(id)
  if (!level(!!reachOf, rarity)) return null
  if (!reach(rarity, LEGEND)) return 'self'
  if (reachOf === 'all' && mythicOf(id, rarity) === 'forest') return 'all'
  return 'near'
}

export const mythicOf = (id: number, rarity: CardRarity) => (reach(rarity, MYTHIC) ? (mythics.get(id) ?? null) : null)

export const cleaveOf = (id: number, rarity: CardRarity) => mythicOf(id, rarity) === 'cleave'

export const clanOf = (id: number) => clans.get(id) ?? null

export const beastOf = (id: number) => callers.get(id) ?? null

const lookOf = (id: number) => looks.get(id) ?? 'sand'

const PASSIVES = [
  ['taunt', taunts],
  ['poison', venoms],
  ['sound', singers],
  ['medic', new Set(healers.keys())],
  ['fury', furies],
  ['guard', new Set(wardens.keys())],
] as const

const passivesOf = (id: number) => PASSIVES.filter(([, ids]) => ids.has(id)).map(([key]) => key)

const goldOf = (id: number) => (skills.get(id) ?? []).filter(([, need]) => need !== 'mythic').map(([key]) => key)

const mythicSkillsOf = (id: number) => (skills.get(id) ?? []).filter(([, need]) => need === 'mythic').map(([key]) => key)

export const costOf = (id: number, key: ArenaAbility, rarity: CardRarity = 'paper') => {
  const beast = key === 'summon' ? beastOf(id) : null
  const row = beast === null ? undefined : rowOf(beast)
  const base = row ? Math.max(1, Math.round((row[1] + row[2]) / 5)) : ARENA_ABILITIES[key]
  const cheap = reach(rarity, LEGEND) && goldOf(id).includes(key) ? 1 : 0
  return Math.max(1, base - cheap)
}

export type LadderRow = { need?: CardRarity; key: string; n?: number; scope?: string; atk?: number; hp?: number; ids?: number[]; with?: number[]; pierce?: boolean }

export const ladderOf = (id: number): LadderRow[] => {
  const rows: LadderRow[] = []
  const passive = passivesOf(id)
  const gold = goldOf(id)
  const mythic = [...(mythics.has(id) ? [`myth.${mythics.get(id)}`] : []), ...mythicSkillsOf(id).map((key) => `skill.${key}`)]
  if (tierOf(id) === 0) return rows
  for (const key of passive) rows.push({ need: 'bronze', key, ...(key === 'medic' ? { n: healers.get(id) } : {}) })
  if (clans.has(id)) rows.push({ need: 'silver', key: `clan.${clans.get(id)}` })
  for (const key of gold) rows.push({ need: 'gold', key: `skill.${key}` })
  for (const key of [...passive.filter((one) => one !== 'taunt').map((one) => `up.${one}`), ...(gold.length ? ['up.cheap'] : [])]) rows.push({ need: 'legend', key })
  for (const key of mythic) rows.push({ need: 'mythic', key })
  const boss = captains.get(id)
  if (boss) rows.push({ key: 'captain', scope: boss[0], atk: boss[1], hp: boss[2] })
  for (const team of teams) if (team.ids.includes(id)) rows.push({ key: `team.${team.key}`, ids: team.ids, atk: team.atk, hp: team.hp })
  const cry = cries.get(id)
  if (cry) rows.push({ key: 'cry', scope: cry[0], atk: cry[1], hp: cry[2] })
  for (const rule of counters)
    if (rule.by.includes(id))
      rows.push({ key: 'counter', ids: rule.vs.ids, scope: rule.vs.clan ?? (rule.vs.tailed ? 'tailed' : undefined), n: rule.mul, ...(rule.together ? { with: rule.by.filter((one) => one !== id) } : {}), ...(rule.pierce ? { pierce: true } : {}) })
  return rows
}

const SLOTS_OF: Partial<Record<string, number>> = { summon: 1, limbo: 2 }

const callsFor = (side: ArenaSide) => side.summons.length + onBoard(side).reduce((sum, one) => sum + (one.armed ?? []).reduce((all, key) => all + (SLOTS_OF[key] ?? 0), 0), 0)

const guards = (card: ArenaCard) => !!card.ghost || tauntOf(card.id, card.rarity)

const skillView = (id: number, rarity: CardRarity) =>
  skillsOf(id, rarity).map((key) => ({ key, cost: costOf(id, key, rarity), ...(key === 'summon' ? { beast: beastOf(id) } : {}) }))

export const skillsOf = (id: number, rarity: CardRarity) =>
  (skills.get(id) ?? []).filter(([, need]) => rankOf(rarity) >= rankOf(need)).map(([key]) => key)

export const aurasOf = (side: ArenaSide) => {
  const count = new Map<ArenaClan, number>()
  for (const one of side.heroes) {
    const clan = clanOf(one.id)
    if (clan) count.set(clan, (count.get(clan) ?? 0) + 1)
  }
  const out = new Map<string, { clan: ArenaClan; n: number }>()
  for (const one of side.heroes) {
    const clan = clanOf(one.id)
    if (!clan || !reach(one.rarity, SILVER)) continue
    const n = count.get(clan) ?? 0
    if (n < ARENA_CLANS[clan].need) continue
    out.set(one.uid, { clan, n: Math.min(n, ARENA_CLANS[clan].cap) })
  }
  return { count, out }
}

const clanStats = (aura: { clan: ArenaClan; n: number } | undefined, tier = 1) => {
  if (!aura) return { atk: 0, hp: 0 }
  const more = aura.n - 1
  if (aura.clan === 'konoha') return { atk: 0, hp: tier >= 5 ? Math.floor(more * 1.5) : more }
  if (aura.clan === 'akatsuki') return { atk: Math.floor(more / 2), hp: 0 }
  if (aura.clan === 'otsutsuki') return { atk: more, hp: more }
  if (aura.clan === 'uchiha') return { atk: more, hp: 0 }
  if (aura.clan === 'hyuga') return { atk: 1, hp: 1 }
  if (aura.clan === 'ishc') return { atk: 0, hp: more * 2 }
  return { atk: 0, hp: 0 }
}

export const captainOf = (side: ArenaSide) => {
  const mid = side.heroes.length % 2 ? side.heroes[(side.heroes.length - 1) / 2] : undefined
  return mid && captains.has(mid.id) ? mid : undefined
}

const teamsOn = (side: ArenaSide) =>
  teams.map((team) => {
    const found = team.ids.map((id) => side.heroes.findIndex((one) => one.id === id)).filter((at) => at >= 0)
    const on = found.length === team.ids.length && Math.max(...found) - Math.min(...found) + 1 === found.length
    return { ...team, have: found.length, on, uids: on ? found.map((at) => side.heroes[at]!.uid) : [] }
  })

export const liftOf = (side: ArenaSide) => {
  const { out } = aurasOf(side)
  const lift = new Map<string, { atk: number; hp: number }>()
  const add = (uid: string, atk: number, hp: number) => {
    if (!atk && !hp) return
    const was = lift.get(uid) ?? { atk: 0, hp: 0 }
    lift.set(uid, { atk: was.atk + atk, hp: was.hp + hp })
  }
  for (const one of side.heroes) {
    const extra = clanStats(out.get(one.uid), tierOf(one.id))
    add(one.uid, extra.atk, extra.hp)
  }
  const boss = captainOf(side)
  const rule = boss ? captains.get(boss.id) : undefined
  if (rule) {
    const [scope, atk, hp] = rule
    const twice = out.get(boss!.uid)?.clan === 'hokage' ? 2 : 1
    for (const one of side.heroes) if (one !== boss && (scope === 'all' || clanOf(one.id) === scope)) add(one.uid, atk * twice, hp * twice)
  }
  for (const team of teamsOn(side)) for (const uid of team.uids) add(uid, team.atk, team.hp)
  return lift
}

const hits = (rule: Counter, target: ArenaCard) =>
  (rule.vs.ids?.includes(target.id) ?? false) || (!!rule.vs.clan && clanOf(target.id) === rule.vs.clan) || (!!rule.vs.tailed && tailed.has(target.id))

const counterOf = (card: ArenaCard, mates: ArenaCard[], target: ArenaCard) => {
  let mul = 1
  let pierce = false
  for (const rule of counters) {
    if (!rule.by.includes(card.id) || !hits(rule, target)) continue
    if (rule.together && !rule.by.every((id) => mates.some((one) => one.id === id && one.hp > 0))) continue
    mul = Math.max(mul, rule.mul)
    pierce ||= !!rule.pierce
  }
  return { mul, pierce }
}

const DAMAGE_CAPS: [number, number][] = [
  [4, 4],
  [8, 8],
  [12, 12],
]

export const damageCap = (turn: number) => DAMAGE_CAPS.find(([until]) => turn <= until)?.[1] ?? Infinity

const AMATERASU_HIT = 6
const AMATERASU_BURN = 3
const BLAST_HIT = 5
const METEOR_HIT = 3
const CURSE_ATK = 3

export function toggleAbility(doc: ArenaDoc, uid: string, key: string, target?: string) {
  const card = onBoard(doc.board).find((one) => one.uid === uid)
  if (!card || !(key in ARENA_ABILITIES)) return false
  const ability = key as ArenaAbility
  if (!skillsOf(card.id, card.rarity).includes(ability)) return false
  const cost = costOf(card.id, ability, card.rarity)
  const armed = card.armed ?? []
  if (armed.includes(ability)) {
    card.armed = armed.filter((one) => one !== ability)
    if (ability === 'sacrifice') delete card.aim
    doc.chakra = Math.min(doc.chakra + cost, doc.chakraCap)
    return true
  }
  if (doc.chakra < cost) return false
  if (callsFor(doc.board) + (SLOTS_OF[ability] ?? 0) > ARENA_SUMMON_SLOTS) return false
  if (ability === 'sacrifice') {
    if (!target || target === uid || !doc.board.heroes.some((one) => one.uid === target)) return false
    card.aim = target
  }
  card.armed = [...armed, ability]
  doc.chakra -= cost
  return true
}

function botAbilities(doc: ArenaDoc) {
  let left = doc.chakraCap
  for (const card of shuffled(onBoard(doc.foeBoard))) {
    for (const ability of skillsOf(card.id, card.rarity)) {
      const cost = costOf(card.id, ability, card.rarity)
      if (left < cost) continue
      if (callsFor(doc.foeBoard) + (SLOTS_OF[ability] ?? 0) > ARENA_SUMMON_SLOTS) continue
      if (ability === 'sacrifice') {
        const mates = doc.foeBoard.heroes.filter((one) => one.uid !== card.uid)
        if (!mates.length) continue
        card.aim = mates.slice().sort((x, y) => y.atk + y.hp - (x.atk + x.hp))[0]!.uid
      }
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

export const ARENA_HP_MUL = 2

export const statsOf = (id: number, rarity: CardRarity, triple = false, power = 1) => {
  const base = baseOf(id)
  const mul = (triple ? 2 : 1) * (power || 1)
  return { atk: Math.round(base.atk * mul), hp: Math.round(base.hp * mul * ARENA_HP_MUL) }
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

const FIGHT_HOLD_MS: Record<string, number> = { mind: 700, gatesOpen: 600, gates: 300, amaterasu: 600, burn: 300, meteor: 700, seal: 600, blast: 400, raikiri: 400, reaper: 300 }

const holdMs = (step: ArenaStep) => (step.ability ? (FIGHT_HOLD_MS[step.ability] ?? 0) : 0) + (step.swapFrom ? 400 : 0) + (step.dodged?.length ? 300 : 0)

const replayMs = (steps: ArenaStep[]) => {
  let total = FIGHT_LEAD_MS
  let standing = Infinity
  for (const step of steps) {
    const now = step.mine.length + step.theirs.length
    total += FIGHT_STEP_MS + (now < standing && standing !== Infinity ? FIGHT_DEATH_MS : 0) + (step.charm || step.skip ? FIGHT_GEN_MS : 0) + (step.heals ? FIGHT_HEAL_MS : 0) + (step.summoned || step.risen ? FIGHT_CALL_MS : 0) + (step.shot === 'clay' || step.ability === 'blast' || step.ability === 'meteor' || step.ability === 'seal' ? FIGHT_CLAY_MS : 0) + holdMs(step)
    standing = now
  }
  return Math.round(total * FIGHT_SHARE)
}

const turnFrom = (at: number, turn: number) => new Date(at + arenaTurnSec(turn) * 1000)

export const inFight = (doc: ArenaDoc) => !!doc.fightEndsAt && Date.now() < doc.fightEndsAt.getTime()

export function tick(doc: ArenaDoc) {
  if (doc.status !== 'playing' || inFight(doc) || !doc.turnEndsAt) return false
  if (Date.now() < doc.turnEndsAt.getTime() + TURN_GRACE_MS) return false
  endTurn(doc)
  return true
}

export async function arenaOf(userId: ObjectId) {
  const doc = await (await arenas()).findOne({ _id: userId })
  if (doc && !doc.turnEndsAt) doc.turnEndsAt = turnFrom(Date.now(), doc.turn)
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

const ROTATION_FLOOR = 5

const VETERAN_HP = 1

const rotate = (all: number[]) => {
  const fixed = new Set<string>(['konoha'])
  const options = [...new Set(all.map((id) => clanOf(id)).filter((clan): clan is ArenaClan => !!clan && !fixed.has(clan)))]
  for (let attempt = 0; attempt < 60; attempt++) {
    const picked = shuffled(options).slice(0, ARENA_ROTATION)
    const keep = new Set<string>([...fixed, ...picked])
    const ids = all.filter((id) => !clanOf(id) || keep.has(clanOf(id)!))
    const thin = Array.from({ length: ARENA_TIERS }, (_, i) => ids.filter((id) => tierOf(id) === i + 1).length).some((n) => n < ROTATION_FLOOR)
    if (!thin) return { ids, clans: [...keep] }
  }
  return { ids: all, clans: [...fixed, ...options] }
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
  const all = pool.map((one) => one.id).filter((id) => !banned.has(id) && !summons.has(id) && tierOf(id) > 0)
  const { ids: everyone, clans: picked } = rotate(all)
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
    clans: picked,
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
    foePlan: pickOne([...BOT_PLANS]),
    up: arenaUpCost(1),
    steps: [],
    startedAt: new Date(),
    updatedAt: new Date(),
  }
  doc.tavern = roll(doc.pool, 1)
  doc.spellOffer = offerSpell()
  doc.turnEndsAt = turnFrom(Date.now(), 1)
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

export function buyAndPlay(doc: ArenaDoc, at: number, to = -1) {
  const id = doc.tavern[at]
  if (id === undefined) return false
  const summon = doc.summons.includes(id)
  const cost = arenaCost()
  if (doc.coins < cost || !freeSlot(doc.board, summon)) return false
  doc.coins -= cost
  doc.seq += 1
  const card = makeCard(id, rarityOf(doc.ranks, id), summon, doc.seq, false, powerOf(doc.powers, id))
  doc.tavern.splice(at, 1)
  const group = summon ? doc.board.summons : doc.board.heroes
  group.splice(Number.isInteger(to) && to >= 0 ? Math.min(to, group.length) : group.length, 0, card)
  shout(doc, card)
  fuse(doc, id)
  return true
}

export function buyAndCast(doc: ArenaDoc, target: string) {
  const spell = doc.spellOffer
  if (!spell || doc.coins < ARENA_SPELL_COST) return false
  const aim = onBoard(doc.board).find((card) => card.uid === target)
  if (!aim) return false
  if (spell === 'kawarimi') {
    if ((aim.dodge ?? 0) > 0) return false
    aim.dodge = 1
  }
  doc.coins -= ARENA_SPELL_COST
  doc.spellOffer = null
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
  const rarity = CARD_RARITIES[Math.min(rankOf(first.rarity) + 1, CARD_RARITIES.length - 1)]!
  doc.hand.push(makeCard(id, rarity, first.summon, doc.seq, true, powerOf(doc.powers, id)))
}

export function sellCard(doc: ArenaDoc, uid: string) {
  const inHand = doc.hand.findIndex((card) => card.uid === uid)
  if (inHand >= 0) doc.hand.splice(inHand, 1)
  else {
    const line = onBoard(doc.board)
    const sold = line.find((card) => card.uid === uid)
    if (!sold) return false
    for (const ability of sold.armed ?? []) doc.chakra = Math.min(doc.chakra + (ability in ARENA_ABILITIES ? costOf(sold.id, ability as ArenaAbility, sold.rarity) : 0), doc.chakraCap)
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

const shout = (doc: ArenaDoc, card: ArenaCard) => {
  const cry = cries.get(card.id)
  if (!cry || card.summon) return
  const [reach, atk, hp] = cry
  const mates = doc.board.heroes.filter((one) => one.uid !== card.uid)
  const at = doc.board.heroes.indexOf(card)
  const chosen =
    reach === 'near'
      ? [doc.board.heroes[at - 1], doc.board.heroes[at + 1]].filter((one): one is ArenaCard => !!one)
      : reach === 'weakest'
        ? mates.slice().sort((a, b) => a.atk + a.hp - (b.atk + b.hp)).slice(0, 1)
        : mates.length
          ? [pickOne(mates)]
          : []
  for (const one of chosen) {
    one.atk += atk
    one.hp += hp
    one.max += hp
  }
  doc.cried = { from: card.uid, to: chosen.map((one) => one.uid), atk, hp }
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
  shout(doc, card)
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

const ARENA_POWERED = true

const powerOf = (map: Record<number, number> | undefined, id: number) => (ARENA_POWERED ? (map?.[id] ?? 1) : 1)

const BOT_PLANS = ['rush', 'greedy', 'steady'] as const

const RUSH_UP_TURN = [4, 6, 8, 10, 12]

const BOT_NOISE = 0.15
const BOT_CLAN = 4
const BOT_TEAM = 5
const BOT_CAPTAIN = 3
const BOT_COUNTER = 6
const BOT_TAUNT = 4

const permutations = <T>(list: T[]): T[][] =>
  list.length <= 1 ? [list] : list.flatMap((one, at) => permutations([...list.slice(0, at), ...list.slice(at + 1)]).map((rest) => [one, ...rest]))

const liftSum = (side: ArenaSide) => [...liftOf(side).values()].reduce((sum, one) => sum + one.atk * 2 + one.hp, 0)

const arrange = (side: ArenaSide) => {
  let best = side.heroes
  let score = liftSum(side)
  for (const order of permutations(side.heroes)) {
    const value = liftSum({ heroes: order, summons: side.summons })
    if (value > score) {
      score = value
      best = order
    }
  }
  side.heroes = best
  return score
}

const cardValue = (doc: ArenaDoc, card: ArenaCard, side: ArenaSide) => {
  const base = card.atk * 2 + card.hp
  const others = side.heroes.filter((one) => one.uid !== card.uid)
  const clan = clanOf(card.id)
  const kin = clan ? others.filter((one) => clanOf(one.id) === clan).length : 0
  const team = teams.filter((one) => one.ids.includes(card.id)).reduce((sum, one) => sum + one.ids.filter((id) => id !== card.id && others.some((mate) => mate.id === id)).length, 0)
  const captain = captains.has(card.id) ? BOT_CAPTAIN : 0
  const counter = doc.board.heroes.some((foe) => counters.some((rule) => rule.by.includes(card.id) && hits(rule, foe))) ? BOT_COUNTER : 0
  const taunt = guards(card) && others.filter(guards).length < 2 ? BOT_TAUNT : 0
  return base + kin * BOT_CLAN + team * BOT_TEAM + captain + counter + taunt + skillsOf(card.id, card.rarity).length * 3
}

const noisy = (value: number) => value * (1 - BOT_NOISE + Math.random() * BOT_NOISE * 2)

const wantsUp = (doc: ArenaDoc, plan: (typeof BOT_PLANS)[number], tier: number, left: number, up: number) => {
  if (tier >= ARENA_TIERS || left < up) return false
  const cost = arenaCost()
  if (plan === 'greedy') return true
  if (plan === 'rush') return doc.turn >= (RUSH_UP_TURN[tier - 1] ?? 99) && (left - up >= cost || !freeSlot(doc.foeBoard))
  return left - up >= cost || !freeSlot(doc.foeBoard) || up <= 2
}

function botTurn(doc: ArenaDoc) {
  const plan = doc.foePlan ?? 'steady'
  let left = Math.min(ARENA_COIN_START + doc.turn - 1, ARENA_COIN_MAX)
  let tier = doc.foeShop ?? arenaTierAt(doc.turn)
  let up = doc.foeUp ?? arenaUpCost(tier)
  const cost = arenaCost()

  if (wantsUp(doc, plan, tier, left, up)) {
    left -= up
    tier += 1
    up = arenaUpCost(tier)
  } else if (tier < ARENA_TIERS) {
    up = Math.max(ARENA_UP_MIN, up - 1)
  }

  const priced = (id: number) => {
    doc.seq += 1
    const card = makeCard(id, rarityOf(doc.foeRanks, id), doc.summons.includes(id), doc.seq, false, powerOf(doc.foePowers, id))
    return { id, card, value: noisy(cardValue(doc, card, doc.foeBoard)) }
  }
  let offers = roll(doc.pool, tier).map(priced).sort((a, b) => b.value - a.value)
  let rolls = plan === 'rush' ? 3 : 1
  while (left >= cost) {
    const pick = offers.shift()
    const poorest = doc.foeBoard.heroes.slice().sort((a, b) => cardValue(doc, a, doc.foeBoard) - cardValue(doc, b, doc.foeBoard))[0]
    const room = freeSlot(doc.foeBoard)
    if (!pick || (!room && poorest && cardValue(doc, poorest, doc.foeBoard) >= pick.value)) {
      if (!rolls || left < cost + ARENA_ROLL_COST) break
      rolls -= 1
      left -= ARENA_ROLL_COST
      offers = roll(doc.pool, tier).map(priced).sort((a, b) => b.value - a.value)
      continue
    }
    if (!room && poorest) {
      relay(doc.foeBoard, onBoard(doc.foeBoard).filter((card) => card.uid !== poorest.uid))
      left += ARENA_SELL_BACK
    }
    left -= cost
    place(doc.foeBoard, pick.card)
  }

  arrange(doc.foeBoard)
  doc.foeShop = tier
  doc.foeUp = up
}

const copySide = (side: ArenaSide): ArenaSide => ({ heroes: side.heroes.map((one) => ({ ...one })), summons: side.summons.map((one) => ({ ...one })) })

function fight(doc: ArenaDoc) {
  const steps: ArenaStep[] = []
  const ours = copySide(doc.board)
  const foes = copySide(doc.foeBoard)
  const weStart = doc.turn % 2 === 1
  doc.opened = { hp: doc.hp, foeHp: doc.foeHp }

  const snap = () => ({
    hp: doc.hp,
    foeHp: doc.foeHp,
    mine: onBoard(ours).map((one) => ({ ...one })),
    theirs: onBoard(foes).map((one) => ({ ...one })),
  })

  const auras = new Map<string, { clan: ArenaClan; n: number }>()
  for (const side of [ours, foes]) {
    for (const [uid, aura] of aurasOf(side).out) auras.set(uid, aura)
    const lift = liftOf(side)
    for (const one of onBoard(side)) {
      const aura = auras.get(one.uid)
      const extra = lift.get(one.uid) ?? { atk: 0, hp: 0 }
      one.atk += extra.atk
      one.hp += extra.hp
      one.max += extra.hp
      if (aura?.clan === 'kiri') one.mist = true
      if (mythicOf(one.id, one.rarity) === 'kamui') one.dodge = (one.dodge ?? 0) + 2
    }
  }

  const clanOn = (one: ArenaCard, clan: ArenaClan) => (auras.get(one.uid)?.clan === clan ? auras.get(one.uid)!.n : 0)
  const myth = (one: ArenaCard) => mythicOf(one.id, one.rarity)
  const sideOf = (one: ArenaCard) => (onBoard(ours).includes(one) ? ours : foes)
  const across = (side: ArenaSide) => (side === ours ? foes : ours)
  const isFoe = (side: ArenaSide) => side === foes

  const start = new Map([...onBoard(ours), ...onBoard(foes)].map((one) => [one.uid, one.atk]))
  const raisers = new Map<ArenaSide, { by: ArenaCard; left: number }>()
  const pacts = new Map<string, ArenaCard>()
  const killers = new Map<string, ArenaCard>()
  const graves: { side: ArenaSide; card: ArenaCard; at: number; by: ArenaCard; hp: number; kind: string }[] = []
  const echoes: { kind: 'blast' | 'reaper'; card: ArenaCard; side: ArenaSide; killer?: ArenaCard }[] = []

  const bury = () => {
    for (const side of [ours, foes]) {
      for (const card of side.heroes.filter((one) => one.hp <= 0)) {
        const at = side.heroes.slice(0, side.heroes.indexOf(card)).filter((one) => one.hp > 0).length
        const own = myth(card)
        const chiyo = pacts.get(card.uid)
        const raiser = raisers.get(side)
        if ((own === 'rebirth' || own === 'shed') && !card.reborn && !card.stun) {
          card.reborn = true
          graves.push({ side, card, at, by: card, hp: Math.ceil(card.max / 2), kind: own })
          continue
        }
        if (chiyo && chiyo.hp > 0 && !chiyo.stun) {
          pacts.delete(card.uid)
          chiyo.hp = 0
          graves.push({ side, card, at, by: chiyo, hp: card.max, kind: 'sacrifice' })
          continue
        }
        if (raiser && raiser.by !== card && raiser.by.hp > 0 && !raiser.by.stun) {
          raiser.left -= 1
          if (!raiser.left) raisers.delete(side)
          graves.push({ side, card, at, by: raiser.by, hp: card.max, kind: 'revive' })
          continue
        }
        const killer = killers.get(card.uid)
        if (!card.stun && own === 'blast') echoes.push({ kind: 'blast', card, side })
        if (!card.stun && own === 'reaper' && killer && killer.hp > 0) echoes.push({ kind: 'reaper', card, side, killer })
        for (const mate of side.heroes) if (mate.hp > 0 && !mate.stun && clanOn(mate, 'root')) mate.atk += 1
      }
    }
    drop(ours)
    drop(foes)
  }

  const settle = () => {
    for (;;) {
      const grave = graves.shift()
      if (grave) {
        const { side, card, at, by, hp, kind } = grave
        card.hp = hp
        card.atk = start.get(card.uid) ?? card.atk
        card.stun = false
        card.burn = 0
        card.bound = null
        card.link = null
        card.ward = false
        card.dodge = 0
        side.heroes.splice(Math.min(at, side.heroes.length), 0, card)
        steps.push({ from: by.uid, to: card.uid, risen: card.uid, ability: kind, damage: 0, dead: false, foe: isFoe(side), ...snap() })
        continue
      }
      const echo = echoes.shift()
      if (!echo) return
      const foe = isFoe(echo.side)
      if (echo.kind === 'blast') {
        const hit = alive(across(echo.side))
        if (!hit.length) continue
        const warded: string[] = []
        for (const one of hit) {
          if (one.ward) {
            one.ward = false
            warded.push(one.uid)
            continue
          }
          one.hp -= BLAST_HIT
          killers.set(one.uid, echo.card)
        }
        const dead = hit.some((one) => one.hp <= 0)
        bury()
        steps.push({ from: echo.card.uid, to: null, splash: hit.map((one) => one.uid), ...(warded.length ? { warded } : {}), ability: 'blast', damage: BLAST_HIT, dead, foe, ...snap() })
      } else if (echo.killer && echo.killer.hp > 0) {
        const killer = echo.killer
        const blow = killer.hp
        killer.hp = 0
        bury()
        steps.push({ from: echo.card.uid, to: killer.uid, ability: 'reaper', damage: blow, dead: true, foe, ...snap() })
      }
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
      settle()
      if (dead) return
    }
    if (card.bound) {
      if ([...alive(ours), ...alive(foes)].some((one) => one.uid === card.bound)) return
      card.bound = null
    }
    if (card.link && [...alive(ours), ...alive(foes)].some((one) => one.uid === card.link)) return
    if (card.stun) {
      card.stun = false
      steps.push({ from: card.uid, to: null, skip: true, damage: 0, dead: false, foe, ...snap() })
      return
    }
    strike(card, side, foe, false)
    if (furyOf(card.id, card.rarity) >= 2 && card.hp > 0 && doc.hp && doc.foeHp && alive(side).length) strike(card, side, foe, true)
  }

  const strike = (card: ArenaCard, side: ArenaSide, foe: boolean, again: boolean) => {
    const first = !card.opened
    card.opened = true
    const own = myth(card)
    const kumo = clanOn(card, 'kumo')
    let blow = card.atk + (first && kumo ? kumo : 0)
    if (first && own === 'raikiri') blow *= 2
    if (first && card.gated) blow *= 3
    const clay = first && !!card.clay
    card.clay = false
    const targets = alive(side)
    let to: string | null = null
    let dead = false
    const splash: string[] = []
    const dodged: string[] = []
    const sapped: string[] = []
    const warded: string[] = []
    const raged: string[] = []
    const cursed: string[] = []
    const countered: string[] = []
    let venom = false
    let swapFrom: string | undefined
    let swapTo: string | undefined
    const heals: Record<string, number> = {}
    const mend = (one: ArenaCard) => {
      if (one.hp <= 0 || one.hp >= one.max) return
      const medics = alive(sideOf(one)).filter((other) => other !== one && !other.stun && healOf(other.id, other.rarity) > 0)
      if (!medics.length) return
      const before = one.hp
      one.hp = Math.min(one.max, one.hp + medics.reduce((sum, other) => sum + healOf(other.id, other.rarity), 0))
      heals[one.uid] = (heals[one.uid] ?? 0) + one.hp - before
      for (const other of medics) if (biters.has(other.id) && other.hp > 1) other.hp -= 1
    }
    const sap = (one: ArenaCard) => {
      if (one.hp <= 0) return
      one.atk = Math.max(0, one.atk - 1)
      if (soundOf(card.id, card.rarity) >= 2) one.hp = Math.max(1, one.hp - 1)
      sapped.push(one.uid)
    }
    const curse = (one: ArenaCard) => {
      if (!clanOn(one, 'oto') || one.cursed || one.hp <= 0 || one.stun || one.hp * 2 >= one.max) return
      one.cursed = true
      one.atk += CURSE_ATK
      cursed.push(one.uid)
    }
    const armor = (one: ArenaCard, damage: number) => {
      const iwa = clanOn(one, 'iwa')
      return iwa ? Math.max(1, damage - 1) : damage
    }
    const harm = (one: ArenaCard, raw: number) => {
      if (raw <= 0) return
      const edge = counterOf(card, onBoard(sideOf(card)), one)
      const damage = Math.round(raw * edge.mul)
      if (edge.mul > 1) countered.push(one.uid)
      if (one.link) release(one)
      if (one.ward && edge.pierce) one.ward = false
      if (one.ward) {
        one.ward = false
        warded.push(one.uid)
        return
      }
      if (myth(one) === 'mirror' && !one.mirror && !one.stun) {
        one.mirror = true
        card.hp -= damage
        killers.set(card.uid, one)
        swapFrom = one.uid
        swapTo = card.uid
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
      const halved = one.mist ? Math.ceil(damage / 2) : damage
      one.mist = false
      const taken = armor(one, halved)
      one.hp -= taken
      killers.set(one.uid, card)
      if (poisonOf(card.id, card.rarity)) {
        one.hp = 0
        venom = true
      }
      if (myth(one) === 'jashin' && !one.stun) {
        card.hp -= taken
        killers.set(card.uid, one)
      }
      if ((furyOf(one.id, one.rarity) || clanOn(one, 'youth')) && one.hp > 0 && !one.stun) {
        one.atk += 1
        raged.push(one.uid)
      }
      curse(one)
      if (card.sonic) sap(one)
      mend(one)
    }
    if (!targets.length) {
      if (foe) doc.hp = Math.max(0, doc.hp - blow)
      else doc.foeHp = Math.max(0, doc.foeHp - blow)
    } else {
      const walls = targets.filter(guards)
      const target = pickOne(walls.length ? walls : targets)
      const at = targets.indexOf(target)
      const near = [targets[at - 1], targets[at + 1]].filter((one): one is ArenaCard => !!one)
      const wide = first && own === 'rasen' ? targets.filter((one) => one !== target) : cleaveOf(card.id, card.rarity) || clay ? near : own === 'slash' ? near.slice(-1) : []
      const edge = first && own === 'rasen' ? Math.ceil(blow / 3) : Math.ceil(blow / 2)
      for (const one of wide) {
        harm(one, edge)
        splash.push(one.uid)
      }
      harm(target, blow)
      if (!shotOf(card.id) && target.atk > 0 && swapFrom !== target.uid && !target.stun && card.hp > 0) {
        if (card.ward) {
          card.ward = false
          warded.push(card.uid)
        } else {
          const reply = counterOf(target, onBoard(sideOf(target)), card)
          const back = armor(card, Math.round(target.atk * reply.mul))
          if (reply.mul > 1) countered.push(card.uid)
          card.hp -= back
          killers.set(card.uid, target)
          if (poisonOf(target.id, target.rarity) >= 2) {
            card.hp = 0
            venom = true
          }
          if (myth(card) === 'jashin' && !card.stun) {
            target.hp -= back
            killers.set(target.uid, card)
          }
          if ((furyOf(card.id, card.rarity) || clanOn(card, 'youth')) && card.hp > 0) {
            card.atk += 1
            raged.push(card.uid)
          }
          curse(card)
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
      ...(cursed.length ? { cursed } : {}),
      ...(countered.length ? { countered } : {}),
      ...(splash.length ? { splash } : {}),
      ...(to && shotOf(card.id) ? { shot: shotOf(card.id)! } : {}),
      ...(dodged.length ? { dodged } : {}),
      ...(sapped.length ? { sapped } : {}),
      ...(venom ? { venom } : {}),
      ...(swapFrom && swapTo ? { swapFrom, swapTo } : {}),
      ...(Object.keys(heals).length ? { heals } : {}),
      ...(first && own && ['raikiri', 'rasen'].includes(own) ? { ability: own } : first && card.gated ? { ability: 'gates' } : clay ? { ability: 'clay' } : {}),
      damage: blow,
      dead,
      foe,
      ...snap(),
    })
    settle()
  }

  const strongest = (list: ArenaCard[]) => list.slice().sort((a, b) => b.atk + b.hp - (a.atk + a.hp))[0]

  const sides = [
    [ours, foes, false],
    [foes, ours, true],
  ] as const
  const order = weStart ? sides : [sides[1], sides[0]]

  for (const [team, rivals, foe] of order) {
    for (const card of alive(team)) {
      if (card.hp <= 0) continue
      if (soundOf(card.id, card.rarity)) card.sonic = true
      if (myth(card) === 'gates' && !card.gated) {
        card.gated = true
        card.hp = Math.max(1, Math.ceil(card.hp / 2))
        steps.push({ from: card.uid, to: null, ability: 'gatesOpen', damage: 0, dead: false, foe, ...snap() })
      }
      if (myth(card) === 'meteor') {
        const hit = alive(rivals)
        if (hit.length) {
          const warded: string[] = []
          for (const one of hit) {
            if (one.ward) {
              one.ward = false
              warded.push(one.uid)
              continue
            }
            one.hp -= METEOR_HIT
            killers.set(one.uid, card)
          }
          const dead = hit.some((one) => one.hp <= 0)
          bury()
          steps.push({ from: card.uid, to: null, splash: hit.map((one) => one.uid), ...(warded.length ? { warded } : {}), ability: 'meteor', damage: METEOR_HIT, dead, foe, ...snap() })
          settle()
        }
      }
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
          killers.set(target.uid, card)
          const dead = target.hp <= 0
          bury()
          steps.push({ from: card.uid, to: target.uid, ability, damage: AMATERASU_HIT, dead, foe, ...snap() })
          settle()
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
        } else if (ability === 'clay') {
          card.clay = true
        } else if (ability === 'sacrifice') {
          const ward = card.aim ? team.heroes.find((one) => one.uid === card.aim && one.hp > 0) : undefined
          if (ward) pacts.set(ward.uid, card)
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
          raisers.set(team, { by: card, left: myth(card) === 'revive2' ? 2 : 1 })
        }
      }
      if (myth(card) === 'flash' && card.hp > 0 && alive(rivals).length && doc.hp && doc.foeHp) strike(card, rivals, foe, false)
    }
    for (const card of alive(team)) {
      const reach = wardOf(card.id, card.rarity)
      if (!reach) continue
      const at = team.heroes.indexOf(card)
      const covered =
        reach === 'all' ? team.heroes.filter((one) => one.hp > 0 && one !== card) : reach === 'near' ? [card, team.heroes[at - 1], team.heroes[at + 1]].filter((one): one is ArenaCard => !!one && one.hp > 0) : [card]
      const fresh = covered.filter((one) => !one.ward)
      if (!fresh.length) continue
      for (const one of fresh) one.ward = lookOf(card.id)
      steps.push({ from: card.uid, to: null, wards: fresh.map((one) => one.uid), ability: 'ward', damage: 0, dead: false, foe, ...snap() })
    }
    const sandy = alive(team).filter((one) => clanOn(one, 'suna'))
    const sand = sandy.slice(0, sandy.length ? Math.max(0, clanOn(sandy[0]!, 'suna') - 3) : 0).filter((one) => !one.ward)
    if (sand.length) {
      for (const one of sand) one.ward = 'sand'
      steps.push({ from: sand[0]!.uid, to: null, wards: sand.map((one) => one.uid), ability: 'ward', damage: 0, dead: false, foe, ...snap() })
    }
  }

  for (const [team, rivals, foe] of order) {
    const nagato = alive(team).find((one) => myth(one) === 'seal')
    const statue = nagato ? team.summons.find((one) => one.hp > 0 && one.id === beastOf(nagato.id)) : undefined
    if (!statue) continue
    const prey = rivals.summons.filter((one) => one.hp > 0 && tailed.has(one.id))
    if (!prey.length) continue
    for (const one of prey) one.hp = 0
    bury()
    steps.push({ from: statue.uid, to: null, sealed: prey.map((one) => one.uid), ability: 'seal', damage: 0, dead: true, foe, ...snap() })
    settle()
  }

  const asleep = (one: ArenaCard) => {
    const near = [...alive(ours), ...alive(foes)]
    return (!!one.bound && near.some((other) => other.uid === one.bound)) || (!!one.link && near.some((other) => other.uid === one.link))
  }
  const stuck = () => [...alive(ours), ...alive(foes)].every(asleep)
  const empty = () => !alive(ours).length || !alive(foes).length || stuck()
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

  if (!over() && !(alive(ours).length && alive(foes).length)) {
    const ourTurn = alive(ours).length > 0
    const crew = ourTurn ? alive(ours) : alive(foes)
    if (crew.length) {
      const tavern = ourTurn ? tavernOf(doc) : (doc.foeShop ?? arenaTierAt(doc.turn))
      const damage = Math.min(tavern + bash(crew), damageCap(doc.turn))
      if (ourTurn) doc.foeHp = Math.max(0, doc.foeHp - damage)
      else doc.hp = Math.max(0, doc.hp - damage)
      steps.push({
        from: crew[0]!.uid,
        all: crew.map((card) => card.uid),
        to: null,
        damage,
        dead: false,
        foe: !ourTurn,
        ...snap(),
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
    delete card.aim
  }
  const lived = new Set([...(doc.clash?.mine ?? []), ...(doc.clash?.theirs ?? [])].filter((one) => one.hp > 0).map((one) => one.uid))
  for (const card of [...doc.board.heroes, ...doc.foeBoard.heroes])
    if (lived.has(card.uid)) {
      card.hp += VETERAN_HP
      card.max += VETERAN_HP
    }
  doc.cried = null
  const settled = Date.now() + replayMs(doc.steps ?? [])
  doc.fightEndsAt = new Date(settled)
  doc.turnEndsAt = turnFrom(settled, doc.turn + 1)
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

const faceOf = (id: number, rarity: CardRarity) => ({
  tier: tierOf(id),
  cleave: cleaveOf(id, rarity),
  shot: shotOf(id),
  poison: poisonOf(id, rarity) > 0,
  sound: soundOf(id, rarity) > 0,
  medic: healOf(id, rarity) > 0,
  heal: healOf(id, rarity),
  fury: furyOf(id, rarity) > 0,
  guard: wardOf(id, rarity),
  mythic: mythicOf(id, rarity),
  clan: clanOf(id),
  skills: skillView(id, rarity),
})

const ranked = (card: ArenaCard) => ({ ...card, ...faceOf(card.id, card.rarity), taunt: guards(card), armed: card.armed ?? [] })

const rankedSide = (side: ArenaSide) => {
  const lifts = liftOf(side)
  const boss = captainOf(side)
  const lift = (card: ArenaCard) => {
    const extra = lifts.get(card.uid)
    const view = { ...ranked(card), ...(card === boss ? { captain: true } : {}) }
    return extra ? { ...view, atk: card.atk + extra.atk, hp: card.hp + extra.hp, max: card.max + extra.hp, boost: extra } : view
  }
  return { heroes: side.heroes.map(lift), summons: side.summons.map(ranked) }
}

const synergyOf = (side: ArenaSide) => {
  const { count } = aurasOf(side)
  return [...count.entries()]
    .map(([clan, n]) => ({ clan, count: n, need: ARENA_CLANS[clan].need, cap: ARENA_CLANS[clan].cap, ready: side.heroes.filter((one) => clanOf(one.id) === clan && reach(one.rarity, SILVER)).length }))
    .sort((a, b) => Number(b.count >= b.need) - Number(a.count >= a.need) || b.count - a.count)
}

const crewOf = (side: ArenaSide) => {
  const boss = captainOf(side)
  const rule = boss ? captains.get(boss.id) : undefined
  return {
    captain: boss && rule ? { id: boss.id, scope: rule[0], atk: rule[1], hp: rule[2] } : null,
    teams: teamsOn(side)
      .filter((team) => team.have >= Math.min(2, team.ids.length))
      .map(({ key, ids, atk, hp, have, on }) => ({ key, ids, atk, hp, have, on }))
      .sort((a, b) => Number(b.on) - Number(a.on) || b.have - a.have),
  }
}

const kitsOf = (ids: number[]) => Object.fromEntries([...new Set(ids)].map((id) => [id, ladderOf(id)]))

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
  turnEndsAt: doc.turnEndsAt?.getTime() ?? Date.now() + arenaTurnSec(doc.turn) * 1000,
  fightEndsAt: doc.fightEndsAt?.getTime() ?? null,
  armed: doc.armed ?? [],
  upCost: upCostOf(doc),
  rollCost: ARENA_ROLL_COST,
  turnSec: arenaTurnSec(doc.turn),
  hp: doc.hp,
  foeHp: doc.foeHp,
  tavern: doc.tavern.map((id) => {
    const rarity = rarityOf(doc.ranks, id)
    const power = powerOf(doc.powers, id)
    const { atk, hp } = statsOf(id, rarity, false, power)
    return { id, rarity, cost: arenaCost(), atk, hp, summon: doc.summons.includes(id), ...faceOf(id, rarity), taunt: tauntOf(id, rarity), power }
  }),
  hand: doc.hand.map(ranked),
  board: rankedSide(doc.board),
  foeBoard: rankedSide(doc.foeBoard),
  steps: (doc.steps ?? []).map((step) => ({ ...step, mine: step.mine.map(ranked), theirs: step.theirs.map(ranked) })),
  opened: doc.opened ?? null,
  clash: doc.clash ? { mine: doc.clash.mine.map(ranked), theirs: doc.clash.theirs.map(ranked) } : null,
  synergy: synergyOf(doc.board),
  clans: doc.clans ?? [],
  cried: doc.cried ?? null,
  crew: crewOf(doc.board),
  kits: kitsOf([...doc.tavern, ...doc.hand.filter((card) => !card.spell).map((card) => card.id), ...onBoard(doc.board).map((card) => card.id), ...onBoard(doc.foeBoard).map((card) => card.id), ...(doc.steps ?? []).flatMap((step) => [...step.mine, ...step.theirs].map((card) => card.id))]),
})

export const tiersOf = (ranks: Record<number, CardRarity>) =>
  Object.fromEntries(Object.entries(ranks).map(([id, rarity]) => [id, CARD_RARITIES.indexOf(rarity)]))
