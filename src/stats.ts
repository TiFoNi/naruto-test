export type Stats = { solved: number; streak: number; best: number; totalGuesses: number; lastDay?: string | null }

export const kyivToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv' }).format(new Date())

export const emptyStats: Stats = { solved: 0, streak: 0, best: 0, totalGuesses: 0 }

export function applyResult(stats: Stats, won: boolean, guesses: number): Stats {
  if (!won) return { ...stats, streak: 0 }
  const streak = stats.streak + 1
  return { solved: stats.solved + 1, streak, best: Math.max(stats.best, streak), totalGuesses: stats.totalGuesses + guesses }
}

export const average = (stats: Stats) => (stats.solved ? (stats.totalGuesses / stats.solved).toFixed(1) : '–')
