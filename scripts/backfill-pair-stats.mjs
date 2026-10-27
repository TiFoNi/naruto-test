import { MongoClient } from 'mongodb'

const uri = process.env.MONGODB_URI
if (!uri) throw new Error('MONGODB_URI не задано')

const client = new MongoClient(uri)
await client.connect()
const db = client.db(process.env.MONGODB_DB || 'nandaguessr')
const users = db.collection('users')

const wins = await db
  .collection('rounds')
  .aggregate([
    { $match: { mode: 'pair', status: 'won' } },
    { $group: { _id: { userId: '$userId', game: '$game' }, solved: { $sum: 1 } } },
  ])
  .toArray()

const bests = await db
  .collection('streaks')
  .find({ best: { $gt: 0 }, guest: { $ne: true } }, { projection: { userId: 1, game: 1, best: 1 } })
  .toArray()

const rows = new Map()
const slot = (userId, game) => {
  const key = `${userId}:${game}`
  if (!rows.has(key)) rows.set(key, { userId, game, solved: 0, best: 0 })
  return rows.get(key)
}
for (const one of wins) slot(one._id.userId, one._id.game).solved = one.solved
for (const one of bests) slot(one.userId, one.game).best = one.best

const writes = [...rows.values()].map(({ userId, game, solved, best }) => {
  const path = `stats.${game}_pair`
  return {
    updateOne: {
      filter: { _id: userId },
      update: { $max: { [`${path}.solved`]: solved, [`${path}.totalGuesses`]: solved, [`${path}.best`]: Math.max(best, solved ? 1 : 0) } },
    },
  }
})

if (writes.length) {
  const { modifiedCount } = await users.bulkWrite(writes, { ordered: false })
  console.log(`гравців/всесвітів: ${writes.length}, оновлено: ${modifiedCount}`)
} else {
  console.log('нічого оновлювати')
}

await client.close()
