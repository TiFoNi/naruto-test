process.env.MONGODB_URI = 'mongodb://127.0.0.1:27999'
process.env.MONGODB_DB = 'awards_probe'
const { MongoClient, ObjectId } = await import('mongodb')
const { ready } = await import('/Users/tifoni/Documents/GitHub/naruto-test/apps/api/dist/packages/core/src/endpoints/awards.js')

const client = new MongoClient(process.env.MONGODB_URI)
await client.connect()
const db = client.db('awards_probe')
await db.dropDatabase()

const id = new ObjectId()
const now = new Date()
const rounds = []
for (let i = 0; i < 3; i++)
  rounds.push({ userId: id, game: 'naruto', mode: 'classic', status: 'won', answerId: i + 1, guessCount: 1, guesses: [{}], daily: false, finishedAt: now, createdAt: new Date(Date.now() - i * 1000) })
await db.collection('rounds').insertMany(rounds)
await db.collection('users').insertOne({ _id: id, username: 'probe@test', usernameLower: 'probe@test', nickname: 'Probe', solvedTotal: 3, createdAt: now })

const first = await ready(await db.collection('users').findOne({ _id: id }))
const doc = await db.collection('users').findOne({ _id: id })
console.log('перший виклик:', first.map((a) => `${a.id}/${a.tier}/+${a.xp}`).join(', ') || '(порожньо)')
console.log('awardsSolved у базі:', doc.awardsSolved, '| awards:', Object.keys(doc.awards ?? {}).join(','), '| claimed:', Object.keys(doc.claimed ?? {}).join(','))

const before = Date.now()
const second = await ready(doc)
console.log('другий виклик (без нових розгадок):', second.length, 'шт, час', Date.now() - before, 'мс — синк пропущено:', doc.awardsSolved === (doc.solvedTotal ?? 0))

await db.collection('users').updateOne({ _id: id }, { $set: { claimed: { ...(doc.awards ?? {}) } } })
const claimedDoc = await db.collection('users').findOne({ _id: id })
console.log('після "забрав усі":', (await ready(claimedDoc)).length, 'шт')

await db.dropDatabase()
await client.close()
