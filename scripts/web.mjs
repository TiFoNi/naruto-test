import fs from 'node:fs'
import path from 'node:path'
import { parseEnv } from 'node:util'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const file = path.join(root, '.env.local')

if (fs.existsSync(file)) {
  for (const [key, value] of Object.entries(parseEnv(fs.readFileSync(file, 'utf8')))) process.env[key] ??= value
}

process.argv = [process.argv[0], 'next', ...process.argv.slice(2)]
await import('next/dist/bin/next')
