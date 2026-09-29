import { MongoClient } from 'mongodb'

const write = process.argv.includes('--write')
const uri = process.env.MONGODB_URI
if (!uri) throw new Error('MONGODB_URI не задано')

const { collectFacts, syncAwards, syncSeasonAwards, LIFE, SEASON, progressOf } = await import('../apps/api/dist/packages/core/src/achievements.js')
const { seasonAt } = await import('../apps/api/dist/packages/core/src/season.js')

const client = await MongoClient.connect(uri)
const db = client.db(process.env.MONGODB_DB || 'nandaguessr')
const people = await db.collection('users').find({}, { projection: { nickname: 1, awards: 1, claimed: 1, resetAt: 1 } }).toArray()
const season = seasonAt()

let added = 0
for (const person of people) {
  const facts = await collectFacts(person._id, 1, person.resetAt)
  const running = await collectFacts(person._id, 1, season.from)
  const doc = await db.collection('seasons').findOne({ _id: `${season.id}:${person._id.toHexString()}` })
  running.days = doc?.days?.length ?? 0
  running.duelWins = doc?.duelWins ?? 0

  const owned = person.awards ?? {}
  const freshLife = LIFE.filter((a) => !a.awarded && !owned[a.id] && progressOf(a.id, facts) >= a.target)
  const ownedSeason = doc?.awards ?? {}
  const freshSeason = SEASON.filter((a) => !ownedSeason[a.id] && progressOf(a.id, running) >= a.target)

  if (freshLife.length || freshSeason.length) {
    added += freshLife.length + freshSeason.length
    console.log(`${person.nickname ?? person._id}: +${freshLife.length + freshSeason.length} → ${[...freshLife, ...freshSeason].map((a) => a.id).join(', ')}`)
  }

  if (write) {
    await syncAwards(person._id, facts, owned, person.claimed)
    await syncSeasonAwards(person._id, running, { awards: owned })
  }
}

console.log(`\n${write ? 'записано' : 'було б додано'} нових ачівок: ${added} у ${people.length} гравців`)
await client.close()
