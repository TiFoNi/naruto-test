export const random = (seed: number) => {
  let state = (Math.abs(Math.round(seed)) % 2147483646) + 1
  return () => {
    state = (state * 16807) % 2147483647
    return state / 2147483647
  }
}

export const tornPoints = (seed: number, jag: number, steps = 9) => {
  const next = random(seed)
  const out: [number, number][] = []
  for (let i = 0; i < steps; i++) out.push([(i / steps) * 100, next() * jag])
  for (let i = 0; i < steps; i++) out.push([100 - next() * jag, (i / steps) * 100])
  for (let i = 0; i < steps; i++) out.push([100 - (i / steps) * 100, 100 - next() * jag])
  for (let i = 0; i < steps; i++) out.push([next() * jag, 100 - (i / steps) * 100])
  return out
}

export const torn = (seed: number, jag: number, steps = 9) =>
  `polygon(${tornPoints(seed, jag, steps)
    .map(([x, y]) => `${x.toFixed(1)}% ${y.toFixed(1)}%`)
    .join(',')})`
