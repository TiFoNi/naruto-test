import type { NextFunction, Request, Response } from 'express'

const REPORT_MS = 15 * 60_000
const TOP = 10

let tally = new Map<string, { bytes: number; hits: number }>()

const routeOf = (path: string) => path.replace(/\/[0-9a-f]{24}(?=\/|$)/gi, '/:id').replace(/\/\d+(?=\/|$)/g, '/:n')

const sizeOf = (chunk: unknown, encoding?: unknown) =>
  !chunk ? 0 : typeof chunk === 'string' ? Buffer.byteLength(chunk, typeof encoding === 'string' ? (encoding as BufferEncoding) : 'utf8') : (chunk as Buffer).length ?? 0

const megabytes = (bytes: number) => (bytes / 1024 / 1024).toFixed(1)

setInterval(() => {
  if (!tally.size) return
  const rows = [...tally].sort((a, b) => b[1].bytes - a[1].bytes)
  const total = rows.reduce((sum, [, row]) => sum + row.bytes, 0)
  tally = new Map()
  const lines = rows
    .slice(0, TOP)
    .map(([route, row]) => `  ${megabytes(row.bytes).padStart(8)} MB  ${String(row.hits).padStart(6)}×  ${route}`)
  console.log(`[egress] ${megabytes(total)} MB за 15 хв\n${lines.join('\n')}`)
}, REPORT_MS).unref()

export function egressMeter(req: Request, res: Response, next: NextFunction) {
  const route = `${req.method} ${routeOf(req.path)}`
  const rowOf = () => {
    const row = tally.get(route) ?? { bytes: 0, hits: 0 }
    tally.set(route, row)
    return row
  }
  rowOf().hits += 1

  const write = res.write.bind(res) as (...args: unknown[]) => boolean
  const end = res.end.bind(res) as (...args: unknown[]) => Response

  res.write = ((chunk: unknown, ...rest: unknown[]) => {
    rowOf().bytes += sizeOf(chunk, rest[0])
    return write(chunk, ...rest)
  }) as Response['write']

  res.end = ((chunk?: unknown, ...rest: unknown[]) => {
    if (typeof chunk !== 'function') rowOf().bytes += sizeOf(chunk, rest[0])
    return end(chunk, ...rest)
  }) as Response['end']

  next()
}
