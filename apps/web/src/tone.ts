let shown: string | null = null
const fans = new Set<() => void>()

export const showTone = (next: string | null) => {
  if (shown === next) return
  shown = next
  for (const call of fans) call()
}

export const shownTone = () => shown

export const watchTone = (call: () => void) => {
  fans.add(call)
  return () => {
    fans.delete(call)
  }
}
