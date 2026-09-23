import type { Request as ExpressRequest, Response as ExpressResponse } from 'express'

type WebHandler = (request: Request) => Promise<Response>

function toWebRequest(req: ExpressRequest): Request {
  const url = `${req.protocol}://${req.get('host') ?? 'localhost'}${req.originalUrl}`
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) value.forEach((v) => headers.append(key, v))
    else if (value) headers.set(key, value)
  }
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
  const body = hasBody ? (Buffer.isBuffer(req.body) ? req.body : JSON.stringify(req.body ?? {})) : undefined
  return new Request(url, { method: req.method, headers, body })
}

async function send(res: ExpressResponse, webResponse: Response) {
  res.status(webResponse.status)
  webResponse.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') res.append('set-cookie', value)
    else res.setHeader(key, value)
  })
  const buffer = Buffer.from(await webResponse.arrayBuffer())
  res.end(buffer)
}

export async function bridge(handler: WebHandler, req: ExpressRequest, res: ExpressResponse) {
  await send(res, await handler(toWebRequest(req)))
}
