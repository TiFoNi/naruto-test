const { GAME_SPECS } = await import('./apps/api/dist/packages/game/src/specs.js')
const { planGrid, gridAnswers } = await import('./apps/api/dist/packages/core/src/grid.js')
const { gameData } = await import('./apps/api/dist/packages/core/src/games.js')

const SKIP = new Set(['manga', 'berserk'])
const TRIES = 12
let worst = Infinity

for (const game of Object.keys(GAME_SPECS)) {
  if (SKIP.has(game)) continue
  const { pool } = await gameData(game)
  const mins = []
  let failed = 0
  for (let i = 0; i < TRIES; i++) {
    const plan = await planGrid(game, 5)
    if (!plan) { failed++; continue }
    const cells = await gridAnswers(game, plan.rows, plan.cols)
    mins.push(Math.min(...cells.flat().map((one) => one.length)))
  }
  const min = mins.length ? Math.min(...mins) : 0
  const avg = mins.length ? (mins.reduce((a, b) => a + b, 0) / mins.length).toFixed(1) : '—'
  worst = Math.min(worst, min)
  console.log(
    game.padEnd(9), String(pool.length).padStart(4), 'персів | сіток:', String(mins.length).padStart(2) + '/' + TRIES,
    '| найменша клітинка:', String(min).padStart(2), '| середня найменша:', avg, failed ? `| не зібралось: ${failed}` : '',
  )
}
console.log('\nнайгірша клітинка по всіх світах:', worst)
process.exit(0)
