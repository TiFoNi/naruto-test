const USERNAME = /^[\p{L}\p{N}_.@+-]{3,64}$/u

export type Credentials = { username: string; password: string }

export function parseCredentials(body: Record<string, unknown>): Credentials | string {
  const username = typeof body.username === 'string' ? body.username.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  if (!USERNAME.test(username)) return 'invalid_username'
  if (password.length < 6 || password.length > 100) return 'invalid_password'
  return { username, password }
}
