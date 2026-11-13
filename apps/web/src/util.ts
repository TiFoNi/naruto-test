export const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

export const tight = (s: string) => normalize(s).replace(/[^\p{L}\p{N}]+/gu, '')

export const dimHex = (hex: string) => {
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) return false
  const full = hex.length === 4 ? `#${[...hex.slice(1)].map((one) => one + one).join('')}` : hex
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(full.slice(at, at + 2), 16) / 255)
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b! < 0.28
}
