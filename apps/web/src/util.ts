export const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

export const tight = (s: string) => normalize(s).replace(/[^\p{L}\p{N}]+/gu, '')
