import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

const KEY_LENGTH = 64

const derive = (password: string, salt: Buffer, length: number) =>
  new Promise<Buffer>((resolve, reject) =>
    scrypt(password, salt, length, (error, key) => (error ? reject(error) : resolve(key))),
  )

export async function hashPassword(password: string) {
  const salt = randomBytes(16)
  const hash = await derive(password, salt, KEY_LENGTH)
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`
}

export async function verifyPassword(password: string, stored: string | undefined) {
  const [scheme, salt, hash] = (stored ?? `scrypt$${randomBytes(16).toString('base64')}$`).split('$')
  const expected = hash ? Buffer.from(hash, 'base64') : randomBytes(KEY_LENGTH)
  const actual = await derive(password, Buffer.from(salt, 'base64'), expected.length)
  return scheme === 'scrypt' && stored !== undefined && timingSafeEqual(actual, expected)
}
