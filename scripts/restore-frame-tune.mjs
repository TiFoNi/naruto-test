import fs from 'node:fs/promises'
import path from 'node:path'
import { MongoClient } from 'mongodb'
import { ROOT } from './lib.mjs'

const tune = JSON.parse(await fs.readFile(path.join(ROOT, 'apps', 'web', 'src', 'frames-tune.json'), 'utf8'))
const client = new MongoClient(process.env.MONGODB_URI)
await client.connect()
const settings = client.db(process.env.MONGODB_DB || 'nandaguessr').collection('settings')
await settings.updateOne({ game: 'frames' }, { $set: { tune } }, { upsert: true })
console.log(`відновлено налаштування ${Object.keys(tune).length} рамок`)
await client.close()
