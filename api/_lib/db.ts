import { MongoClient, type Collection, type ObjectId } from 'mongodb'

export type UserDoc = {
  _id?: ObjectId
  username: string
  usernameLower: string
  passwordHash: string
  nickname?: string
  stats?: Record<string, Partial<Stats>>
  createdAt: Date
}

export type Stats = { solved: number; streak: number; best: number; totalGuesses: number }

const cache = globalThis as typeof globalThis & { __mongo?: Promise<MongoClient>; __usersIndexed?: Promise<unknown> }

function client() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI is not set')
  cache.__mongo ??= new MongoClient(uri).connect().catch((error) => {
    cache.__mongo = undefined
    throw error
  })
  return cache.__mongo
}

export async function users(): Promise<Collection<UserDoc>> {
  const collection = (await client()).db(process.env.MONGODB_DB || 'nandaguessr').collection<UserDoc>('users')
  cache.__usersIndexed ??= collection.createIndex({ usernameLower: 1 }, { unique: true })
  await cache.__usersIndexed
  return collection
}
