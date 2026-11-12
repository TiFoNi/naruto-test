import { handle, json } from '../http'
import { countPulse, freshSince, latestNews, seenOf, touchPulse, watcherKey } from '../chat'

export const GET = handle(async (request) => {
  const url = new URL(request.url)
  const idle = url.searchParams.get('idle') === '1'
  const seen = await seenOf(request, url.searchParams.get('seen'))
  const [online, fresh, news] = await Promise.all([idle ? countPulse() : touchPulse(await watcherKey(request)), freshSince(seen.chat), latestNews()])
  return json({ online, fresh, news, seen })
})
