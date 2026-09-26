process.env.MONGODB_URI = 'mongodb://127.0.0.1:27999'
process.env.MONGODB_DB = 'xpcheck'
const { ObjectId } = await import('mongodb')
const { users, rounds } = await import('../apps/api/dist/packages/core/src/db.js')
const { finishRound } = await import('../apps/api/dist/packages/core/src/rounds.js')

const u = await users()
const r = await rounds()
await u.deleteMany({})
await r.deleteMany({})

const userId = new ObjectId()
await u.insertOne({ _id: userId, username: 'xp@test', xp: 0 })

const play = async (mode, daily) => {
  const doc = {
    userId,
    game: 'dota',
    mode,
    answerId: 1,
    guesses: [1],
    status: 'active',
    createdAt: new Date(),
    ...(daily ? { daily } : {}),
  }
  const { insertedId } = await r.insertOne(doc)
  await finishRound(u, { ...doc, _id: insertedId }, true)
  const after = await u.findOne({ _id: userId })
  return { xp: after.xp, ...after.xpToday }
}

console.log('класика (нескінченний):', await play('classic'))
console.log('за фразою (нескінченний):', await play('phrase'))
console.log('за фразою (щоденна):', await play('phrase', new Date().toISOString().slice(0, 10)))
for (let i = 0; i < 12; i++) await play('phrase')
console.log('після ще 12 нескінченних:', await play('phrase'))
