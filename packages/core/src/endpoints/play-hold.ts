import { ObjectId } from 'mongodb'
import { hasMode } from '@nanda/game'
import { authSession } from '../auth'
import { plays } from '../db'
import { isGame, isMode } from '../games'
import { fail, handle, json, readJson } from '../http'
import { readDevice, readDeviceName } from '../rounds'
import { ringPlay } from '../stream'

const FRESH_MS = 100_000

export const POST = handle(async (request) => {
  const session = await authSession(request)
  if (!session || !ObjectId.isValid(session.id)) return json({ state: 'held' })
  const userId = new ObjectId(session.id)
  const body = await readJson(request)
  const device = readDevice(body.device)
  if (!device) return json({ state: 'held' })
  const collection = await plays()

  if (body.leave === true) {
    const gone = await collection.deleteOne({ _id: userId, device })
    if (gone.deletedCount) ringPlay(userId, { device: null })
    return json({ state: 'free' })
  }

  const { game, mode } = body
  if (!isGame(game) || !isMode(mode) || !hasMode(game, mode)) return fail(400, 'bad_request')
  const daily = body.daily === true
  const now = new Date()
  const other = await collection.findOne({ _id: userId })
  const busy = other && other.device !== device && now.getTime() - other.seenAt.getTime() < FRESH_MS

  if (busy && body.take !== true) {
    return json({ state: 'blocked', other: { game: other.game, mode: other.mode, daily: other.daily, name: other.name } })
  }

  await collection.updateOne(
    { _id: userId },
    { $set: { device, name: readDeviceName(body.deviceName), game, mode, daily, seenAt: now } },
    { upsert: true },
  )
  if (other && other.device !== device) ringPlay(userId, { device })
  return json({ state: 'held' })
})
