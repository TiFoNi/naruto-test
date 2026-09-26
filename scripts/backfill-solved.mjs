import { MongoClient } from 'mongodb'
import { STAT_KEYS } from '../packages/game/src/specs.ts'

const uri = process.env.MONGODB_URI
if (!uri) throw new Error('MONGODB_URI не задано')

const client = new MongoClient(uri)
await client.connect()
const db = client.db(process.env.MONGODB_DB || 'nandaguessr')
const users = db.collection('users')

await users.createIndex({ solvedTotal: -1 })

const sum = { $sum: STAT_KEYS.map((key) => ({ $ifNull: [`$stats.${key}.solved`, 0] })) }
const { modifiedCount, matchedCount } = await users.updateMany({}, [{ $set: { solvedTotal: sum } }])

const players = await users.countDocuments({ solvedTotal: { $gte: 1 } })
console.log(`оновлено ${modifiedCount} з ${matchedCount}, гравців зі вгаданими: ${players}`)

await client.close()
