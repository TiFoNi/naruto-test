import { ObjectId } from 'mongodb'
import { TITLES, isTitle } from '@nanda/game'
import { users } from '../db'
import { fail, handle, json, readJson } from '../http'
import { adminSession } from '../admin'
import { defaultNickname, parseTag } from '../profile'

const missing = () => fail(404, 'not_found')

export const GET = handle(async (request) => {
  if (!(await adminSession(request))) return missing()

  const raw = (new URL(request.url).searchParams.get('q') ?? '').trim().slice(0, 32)
  const [namePart, tagPart] = raw.split('#')
  const name = namePart.trim().toLowerCase()
  const tag = tagPart === undefined ? parseTag(namePart) : parseTag(tagPart)

  const or = []
  if (name.length >= 2) or.push({ nicknameLower: { $gte: name, $lt: `${name}￿` } })
  if (tag) or.push({ tag })

  const list = or.length
    ? await (await users())
        .find(
          or.length === 1 ? or[0] : { $or: or },
          { projection: { nickname: 1, username: 1, tag: 1, avatar: 1, frame: 1, titles: 1, title: 1 }, sort: { nicknameLower: 1 } },
        )
        .limit(12)
        .toArray()
    : []

  return json({
    titles: TITLES,
    players: list.map((doc) => ({
      id: doc._id!.toHexString(),
      nickname: doc.nickname ?? defaultNickname(doc.username),
      tag: doc.tag ?? null,
      avatar: doc.avatar ?? null,
      frame: doc.frame ?? null,
      titles: (doc.titles ?? []).filter(isTitle),
      title: doc.title ?? null,
    })),
  })
})

export const POST = handle(async (request) => {
  if (!(await adminSession(request))) return missing()

  const { id, title, give } = (await readJson(request)) as { id?: unknown; title?: unknown; give?: unknown }
  if (typeof id !== 'string' || !ObjectId.isValid(id) || !isTitle(title)) return fail(400, 'bad_request')

  const collection = await users()
  const doc = await collection.findOne({ _id: new ObjectId(id) }, { projection: { _id: 1, titles: 1, title: 1 } })
  if (!doc) return missing()

  const owned = new Set((doc.titles ?? []).filter(isTitle))
  if (give === false) owned.delete(title)
  else owned.add(title)

  const titles = [...owned]
  const worn = doc.title && titles.includes(doc.title as never) ? doc.title : null

  await collection.updateOne(
    { _id: doc._id },
    worn ? { $set: { titles, title: worn } } : { $set: { titles }, $unset: { title: '' } },
  )

  return json({ id, titles, title: worn })
})
