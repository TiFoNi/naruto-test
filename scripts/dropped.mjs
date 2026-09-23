export const DROPPED = {
  naruto: [282, 124, 199, 35, 653, 24, 774, 724, 863, 1196, 1232, 916, 1320, 971, 1000, 1418, 457, 736, 1077, 855],
  aot: [],
  bleach: [5404, 72724, 11866, 2601, 3659, 4420, 3209, 3221, 2928, 126388, 2954, 43827, 2765, 2896, 6396, 11506, 11507, 3640],
  tg: [2669, 14024, 14791, 165334],
  berserk: [],
  kny: [],
  onepiece: [],
  mk: [],
  hxh: [],
  bc: [],
  jojo: [],
  se: [18647, 18648, 2738, 5448, 2128, 7087],
  ff: [4094, 3922, 3920, 3667, 2997, 4524, 5147, 2827],
  dn: [],
  avatar: [],
  manga: [],
}

export function onlyAnswers(list) {
  for (let i = list.length - 1; i >= 0; i--) if (!list[i].answer) list.splice(i, 1)
  return list
}

export function dropDeleted(list, game) {
  const drop = new Set(DROPPED[game] ?? [])
  if (!drop.size) return list
  for (let i = list.length - 1; i >= 0; i--) if (drop.has(list[i].id)) list.splice(i, 1)
  return list
}
