import { handle, json } from '../http'
import { dictionary } from '../terms'

export const GET = handle(async () => json({ terms: await dictionary() }))
