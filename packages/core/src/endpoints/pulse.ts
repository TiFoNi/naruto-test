import { handle, json } from '../http'
import { freshSince, touchPulse, watcherKey } from '../chat'

export const GET = handle(async (request) => {
  const url = new URL(request.url)
  const seen = url.searchParams.get('seen')
  const [online, fresh] = await Promise.all([touchPulse(await watcherKey(request)), freshSince(seen)])
  return json({ online, fresh })
})
