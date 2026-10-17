import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)
const port = Number(process.argv[2]) || 4000

const { stdout } = await run('lsof', ['-nP', '-tiTCP:' + port, '-sTCP:LISTEN']).catch(() => ({ stdout: '' }))
const held = stdout.split('\n').map((line) => Number(line.trim())).filter((pid) => pid && pid !== process.pid)

if (!held.length) {
  console.log(`порт ${port} вільний`)
} else {
  for (const pid of held) {
    try {
      process.kill(pid)
      console.log(`звільнив порт ${port}, зупинив ${pid}`)
    } catch {
      console.warn(`не вдалось зупинити ${pid} на порту ${port}`)
    }
  }
  await new Promise((wait) => setTimeout(wait, 1200))
}
