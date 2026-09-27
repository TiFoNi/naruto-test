export const pluralIndex = (count: number, lang: string) => {
  if (lang === 'en') return count === 1 ? 0 : 1
  const ten = count % 10
  const hundred = count % 100
  if (ten === 1 && hundred !== 11) return 0
  if (ten >= 2 && ten <= 4 && (hundred < 12 || hundred > 14)) return 1
  return 2
}
