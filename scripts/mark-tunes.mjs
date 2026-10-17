import fs from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const LIST = path.join(ROOT, 'scripts', 'data', 'tunes.json')
const RAW = path.join(ROOT, '.cache', 'tunes')
const PORT = Number(process.env.MARK_PORT) || 4100

const read = async () => JSON.parse(await fs.readFile(LIST, 'utf8'))

const write = async (rows) => {
  await fs.writeFile(LIST, `${JSON.stringify(rows, null, 1)}\n`)
}

async function sourceOf(id) {
  const names = await fs.readdir(RAW).catch(() => [])
  const hit = names.find((name) => name.replace(/\.[^.]+$/, '') === String(id))
  return hit ? path.join(RAW, hit) : null
}

const page = await fs.readFile(path.join(ROOT, 'scripts', 'mark-tunes.html'), 'utf8')

http
  .createServer(async (request, answer) => {
    const url = new URL(request.url, `http://localhost:${PORT}`)

    if (url.pathname === '/') {
      answer.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      return answer.end(page)
    }

    if (url.pathname === '/data') {
      answer.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
      return answer.end(JSON.stringify(await read()))
    }

    if (url.pathname.startsWith('/audio/')) {
      const file = await sourceOf(url.pathname.slice(7))
      if (!file) {
        answer.writeHead(404)
        return answer.end()
      }
      const bytes = await fs.readFile(file)
      answer.writeHead(200, { 'content-type': 'audio/ogg', 'content-length': bytes.length, 'accept-ranges': 'none' })
      return answer.end(bytes)
    }

    if (url.pathname === '/save' && request.method === 'POST') {
      const body = await new Promise((done) => {
        let text = ''
        request.on('data', (chunk) => (text += chunk))
        request.on('end', () => done(text))
      })
      const { id, start, hidden } = JSON.parse(body)
      const rows = await read()
      const row = rows.find((one) => one.id === id)
      if (!row) {
        answer.writeHead(404)
        return answer.end()
      }
      if (start === null) delete row.start
      else if (start !== undefined) row.start = Math.round(Number(start) * 100) / 100
      if (hidden === true) row.hidden = true
      else if (hidden === false) delete row.hidden
      await write(rows)
      answer.writeHead(200, { 'content-type': 'application/json' })
      return answer.end(JSON.stringify({ ok: true, row }))
    }

    answer.writeHead(404)
    answer.end()
  })
  .listen(PORT, () => {
    console.log(`мітки опенінгів → http://localhost:${PORT}`)
    console.log('тягни зону по хвилі · Пробіл слухати · Enter зберегти й далі · D прибрати тайтл')
  })
