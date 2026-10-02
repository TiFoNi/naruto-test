import { users } from '../db'
import { fail, handle, json } from '../http'
import { dropAvatar, uploadAvatar } from '../images'
import { currentUser, unauthorized } from '../profile'

const LIMIT = 6 * 1024 * 1024
const KINDS = ['image/webp', 'image/jpeg', 'image/png', 'image/gif', 'image/avif']

type Upload = { size: number; type: string; arrayBuffer: () => Promise<ArrayBuffer> }

export const POST = handle(async (request) => {
  const found = await currentUser(request)
  if (!found) return unauthorized()
  const userId = found.doc._id!
  const id = userId.toHexString()

  const form = await request.formData().catch(() => null)
  if (!form) return fail(400, 'bad_request')

  const collection = await users()

  if (form.get('action') === 'remove') {
    if (found.doc.avatar) await dropAvatar(id).catch(() => undefined)
    await collection.updateOne({ _id: userId }, { $set: { avatar: null } })
    return json({ avatar: null })
  }

  const file = form.get('file') as unknown as Upload | null
  if (!file || typeof file === 'string' || !file.size) return fail(400, 'no_file')
  if (file.size > LIMIT) return fail(413, 'too_large')
  if (file.type && !KINDS.includes(file.type)) return fail(415, 'bad_kind')

  const avatar = await uploadAvatar(id, Buffer.from(await file.arrayBuffer()))
  await collection.updateOne({ _id: userId }, { $set: { avatar } })
  return json({ avatar })
})
