const bins = new Set<() => void>()

export function keepPerUser(clear: () => void) {
  bins.add(clear)
}

export function forgetUser() {
  for (const clear of bins) clear()
}
