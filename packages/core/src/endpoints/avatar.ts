import { users, type UserDoc } from '../db'
import { fail, handle, json } from '../http'
import { dropAvatar, keepOwnAvatar, uploadAvatar, wearOwnAvatar } from '../images'
import { currentUser, unauthorized } from '../profile'

const LIMIT = 6 * 1024 * 1024
const KINDS = ['image/webp', 'image/jpeg', 'image/png', 'image/gif', 'image/avif']
const PRESETS = ['frog', 'fox']
const OWN = 'own'

type Upload = { size: number; type: string; arrayBuffer: () => Promise<ArrayBuffer> }

const wearsOldUpload = (doc: UserDoc) => Boolean(doc.avatar && !doc.avatarPreset && !doc.avatarOwn)

async function saveOldUpload(doc: UserDoc, id: string) {
  if (!wearsOldUpload(doc)) return {}
  const kept = await keepOwnAvatar(id).then(() => true).catch(() => false)
  return kept ? { avatarOwn: doc.avatar } : {}
}

export const POST = handle(async (request) => {
  const found = await currentUser(request)
  if (!found) return unauthorized()
  const userId = found.doc._id!
  const id = userId.toHexString()

  const form = await request.formData().catch(() => null)
  if (!form) return fail(400, 'bad_request')

  const collection = await users()
  const action = form.get('action')

  if (action === 'remove') {
    const saved = await saveOldUpload(found.doc, id)
    if (found.doc.avatar) await dropAvatar(id).catch(() => undefined)
    await collection.updateOne({ _id: userId }, { $set: { avatar: null, avatarPreset: null, ...saved } })
    return json({ avatar: null })
  }

  if (action === OWN) {
    if (wearsOldUpload(found.doc)) return json({ avatar: found.doc.avatar, avatarPreset: null })
    if (!found.doc.avatarOwn) return fail(404, 'no_own_avatar')
    const avatar = await wearOwnAvatar(id)
    await collection.updateOne({ _id: userId }, { $set: { avatar, avatarPreset: OWN } })
    return json({ avatar, avatarPreset: OWN })
  }

  const file = form.get('file') as unknown as Upload | null
  if (!file || typeof file === 'string' || !file.size) return fail(400, 'no_file')
  if (file.size > LIMIT) return fail(413, 'too_large')
  if (file.type && !KINDS.includes(file.type)) return fail(415, 'bad_kind')

  const asked = form.get('preset')
  const preset = typeof asked === 'string' && PRESETS.includes(asked) ? asked : null
  const saved = preset ? await saveOldUpload(found.doc, id) : {}
  const avatar = await uploadAvatar(id, Buffer.from(await file.arrayBuffer()), !preset)
  const own = preset ? saved : { avatarOwn: avatar }
  await collection.updateOne({ _id: userId }, { $set: { avatar, avatarPreset: preset ?? OWN, ...own } })
  return json({ avatar, avatarPreset: preset ?? OWN })
})
