import dns from 'node:dns'
import fs from 'node:fs'
import type { IncomingMessage } from 'node:http'
import path from 'node:path'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Node sometimes falls back to a loopback resolver on Windows, which breaks the
// mongodb+srv SRV lookup with ECONNREFUSED. Dev only: point it at real servers.
if (dns.getServers().every((s) => s === '127.0.0.1' || s === '::1')) {
  dns.setServers(['1.1.1.1', '8.8.8.8'])
}

type Handler = (request: Request) => Promise<Response>

const readBody = (req: IncomingMessage) =>
  new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })

function vercelFunctions(): Plugin {
  return {
    name: 'vercel-functions-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url) return next()
        const url = new URL(req.url, `http://${req.headers.host}`)
        if (!url.pathname.startsWith('/api/')) return next()
        const file = path.join(server.config.root, `${url.pathname}.ts`)
        if (url.pathname.includes('/_') || !file.startsWith(path.join(server.config.root, 'api')) || !fs.existsSync(file)) {
          res.statusCode = 404
          return res.end()
        }
        try {
          const handler = (await server.ssrLoadModule(file))[req.method ?? 'GET'] as Handler | undefined
          if (!handler) {
            res.statusCode = 405
            return res.end()
          }
          const headers = new Headers()
          for (const [key, value] of Object.entries(req.headers)) {
            for (const v of [value].flat()) if (v !== undefined) headers.append(key, v)
          }
          const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
          const response = await handler(
            new Request(url, { method: req.method, headers, body: hasBody ? new Uint8Array(await readBody(req)) : undefined }),
          )
          res.statusCode = response.status
          response.headers.forEach((value, key) => key !== 'set-cookie' && res.setHeader(key, value))
          const cookies = response.headers.getSetCookie()
          if (cookies.length) res.setHeader('set-cookie', cookies)
          res.end(Buffer.from(await response.arrayBuffer()))
        } catch (error) {
          server.config.logger.error(String(error))
          res.statusCode = 500
          res.end()
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''))
  return {
    base: './',
    plugins: [react(), vercelFunctions()],
  }
})
