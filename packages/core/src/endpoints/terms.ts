import { cached, handle } from '../http'
import { dictionary } from '../terms'

export const GET = handle(async () => cached({ terms: await dictionary() }, 300))
