import { handle, json } from '../http'
import { countPulse, freshSince, latestNews, touchPulse, watcherKey } from '../chat'

export const GET = handle(async (request) => {
  const url = new URL(request.url)
  const seen = url.searchParams.get('seen')
  const idle = url.searchParams.get('idle') === '1'
  const [online, fresh, news] = await Promise.all([idle ? countPulse() : touchPulse(await watcherKey(request)), freshSince(seen), latestNews()])
  return json({ online, fresh, news })
})
