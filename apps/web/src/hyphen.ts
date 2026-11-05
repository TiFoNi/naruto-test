const VOWELS = new Set('аеёиоуыэюяіїє')
const GLUE = new Set('ьъй')
const WORD = /[а-яёіїєґ]{6,}/giu
const SOFT = '­'

const vowel = (letter = '') => VOWELS.has(letter.toLowerCase())

const splits = (word: string) => {
  const letters = [...word]
  return letters
    .map((letter, index) => {
      const left = letters.slice(0, index)
      const right = letters.slice(index)
      const before = letters[index - 1]
      const after = letters[index + 1]
      const roomy = index >= 2 && right.length >= 2 && left.some((one) => vowel(one)) && right.some((one) => vowel(one))
      const open = vowel(before) && !vowel(letter) && vowel(after)
      const cluster = !vowel(before) && !vowel(letter)
      const split = roomy && !GLUE.has(letter.toLowerCase()) && (open || cluster)
      return split ? SOFT + letter : letter
    })
    .join('')
}

export const hyphenate = (text: string) => text.replace(WORD, splits)
