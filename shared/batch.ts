import type { Word, Settings } from './types'

// A word is learned as soon as it's recalled correctly in a test (weak=0, lastSeenAt set).
export function isLearned(word: Word): boolean {
  return word.weak === 0 && word.lastSeenAt !== null
}

export interface BatchResult {
  words: Word[]
  emptyReason?: string // set when review mode has no weak words
}

export function selectBatch(
  words: Word[],
  mode: 'normal' | 'review',
  settings: Settings,
): BatchResult {
  const { batchSize } = settings

  if (mode === 'review') {
    const problematic = words.filter((w) => w.weak === 1)
    if (problematic.length === 0) {
      return {
        words: [],
        emptyReason:
          'No problematic words in this deck yet. Run some normal sessions first, then words you get wrong will appear here.',
      }
    }
    const sorted = [...problematic].sort((a, b) => {
      if (b.timesWrongInExam !== a.timesWrongInExam) {
        return b.timesWrongInExam - a.timesWrongInExam
      }
      const aLast = a.lastSeenAt ?? 0
      const bLast = b.lastSeenAt ?? 0
      return aLast - bLast
    })
    return { words: sorted.slice(0, batchSize) }
  }

  // Normal mode: new words first, then problematic — learned words are never re-shown
  const neverSeen = words.filter((w) => w.lastSeenAt === null)
  const problematic = words.filter((w) => w.lastSeenAt !== null && w.weak === 1)

  const pool = [...neverSeen, ...problematic]
  return { words: pool.slice(0, batchSize) }
}

export function shuffle<T>(arr: T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export function shuffleDifferentFrom<T>(arr: T[], previous: T[]): T[] {
  if (arr.length <= 1) return [...arr]
  let result = shuffle(arr)
  let attempts = 0
  while (result.every((v, i) => v === previous[i]) && attempts < 20) {
    result = shuffle(arr)
    attempts++
  }
  return result
}
