export const random = (seed: number) => {
  let state = (Math.abs(Math.round(seed)) % 2147483646) + 1
  return () => {
    state = (state * 16807) % 2147483647
    return state / 2147483647
  }
}

export const torn = (seed: number, jag: number, steps = 9) => {
  const next = random(seed)
  const out: string[] = []
  const at = (x: number, y: number) => out.push(`${x.toFixed(1)}% ${y.toFixed(1)}%`)
  for (let i = 0; i < steps; i++) at((i / steps) * 100, next() * jag)
  for (let i = 0; i < steps; i++) at(100 - next() * jag, (i / steps) * 100)
  for (let i = 0; i < steps; i++) at(100 - (i / steps) * 100, 100 - next() * jag)
  for (let i = 0; i < steps; i++) at(next() * jag, 100 - (i / steps) * 100)
  return `polygon(${out.join(',')})`
}
