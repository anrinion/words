import type { Word, Settings } from './types'

export function isMastered(word: Word, threshold: number): boolean {
  return word.streak >= threshold
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
  const { batchSize, masteryStreakThreshold } = settings

  if (mode === 'review') {
    const weak = words.filter((w) => w.weak === 1)
    if (weak.length === 0) {
      return {
        words: [],
        emptyReason:
          'No weak words in this deck yet. Run some normal sessions first, then words you get wrong will appear here.',
      }
    }
    const sorted = [...weak].sort((a, b) => {
      if (b.timesWrongInExam !== a.timesWrongInExam) {
        return b.timesWrongInExam - a.timesWrongInExam
      }
      const aLast = a.lastSeenAt ?? 0
      const bLast = b.lastSeenAt ?? 0
      return aLast - bLast
    })
    return { words: sorted.slice(0, batchSize) }
  }

  // Normal mode: never-seen → weak → lowest-streak non-mastered
  const neverSeen = words.filter((w) => w.lastSeenAt === null)
  const weak = words.filter((w) => w.lastSeenAt !== null && w.weak === 1)
  const nonMastered = words.filter(
    (w) => w.lastSeenAt !== null && w.weak === 0 && !isMastered(w, masteryStreakThreshold),
  )
  nonMastered.sort((a, b) => a.streak - b.streak)

  const pool = [...neverSeen, ...weak, ...nonMastered]
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
