import fs from 'node:fs/promises'
import path from 'node:path'
import { PUBLIC } from './lib.mjs'

export async function collectPics(only) {
  const games = await fs.readdir(PUBLIC, { withFileTypes: true })
  const files = []

  for (const game of games) {
    if (!game.isDirectory() || (only && game.name !== only)) continue

    for (const kind of ['full', 'card', 'mini']) {
      const dir = path.join(PUBLIC, game.name, kind)
      for (const file of await fs.readdir(dir).catch(() => [])) {
        if (file.endsWith('.webp')) files.push({ key: `${game.name}/${kind}/${file}`, path: path.join(dir, file) })
      }
    }

    const atlas = path.join(PUBLIC, game.name, 'thumbs.webp')
    if (await fs.stat(atlas).catch(() => null)) files.push({ key: `${game.name}/thumbs.webp`, path: atlas })

    for (const [folder, ext] of [['voice', '.mp3'], ['pages', '.webp']]) {
      const root = path.join(PUBLIC, game.name, folder)
      for (const entry of await fs.readdir(root, { withFileTypes: true }).catch(() => [])) {
        if (!entry.isDirectory()) continue
        const dir = path.join(root, entry.name)
        for (const file of await fs.readdir(dir).catch(() => [])) {
          if (file.endsWith(ext)) files.push({ key: `${game.name}/${folder}/${entry.name}/${file}`, path: path.join(dir, file) })
        }
      }
    }
  }

  return files
}
