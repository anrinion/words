import { describe, it, expect } from 'vitest'
import { selectBatch, isLearned, shuffleDifferentFrom } from './batch'
import type { Word, Settings } from './types'
import { DEFAULT_SETTINGS } from './types'

function makeWord(overrides: Partial<Word> = {}): Word {
  return {
    id: Math.random().toString(36).slice(2),
    deckId: 'deck1',
    term: 'Wort',
    translation: 'word',
    levelTag: null,
    categoryTag: null,
    notes: null,
    example: null,
    exampleTranslation: null,
    createdAt: Date.now(),
    timesSeenInExam: 0,
    timesCorrectInExam: 0,
    timesWrongInExam: 0,
    streak: 0,
    weak: 0,
    lastSeenAt: null,
    ...overrides,
  }
}

const settings: Settings = { ...DEFAULT_SETTINGS, batchSize: 5 }

describe('isLearned', () => {
  it('true when seen and not problematic', () => {
    expect(isLearned(makeWord({ lastSeenAt: 1000, weak: 0 }))).toBe(true)
  })
  it('false when never seen', () => {
    expect(isLearned(makeWord({ lastSeenAt: null, weak: 0 }))).toBe(false)
  })
  it('false when problematic', () => {
    expect(isLearned(makeWord({ lastSeenAt: 1000, weak: 1 }))).toBe(false)
  })
})

describe('selectBatch — normal mode', () => {
  it('prefers never-seen words first', () => {
    const seen = makeWord({ lastSeenAt: 1000, streak: 0, weak: 0 })
    const unseen = makeWord({ lastSeenAt: null })
    const { words } = selectBatch([seen, unseen], 'normal', settings)
    expect(words[0].id).toBe(unseen.id)
  })

  it('includes problematic words, excludes learned', () => {
    const problematic = makeWord({ lastSeenAt: 1000, weak: 1, streak: 0 })
    const learned = makeWord({ lastSeenAt: 1000, weak: 0, streak: 1 })
    const { words } = selectBatch([learned, problematic], 'normal', settings)
    expect(words).toHaveLength(1)
    expect(words[0].id).toBe(problematic.id)
  })

  it('never includes learned words if avoidable', () => {
    const learned = makeWord({ lastSeenAt: 1000, weak: 0 })
    const fresh = makeWord({ lastSeenAt: null })
    const { words } = selectBatch([learned, fresh], 'normal', settings)
    expect(words.find((w) => w.id === learned.id)).toBeUndefined()
  })

  it('respects batchSize', () => {
    const words = Array.from({ length: 20 }, () => makeWord())
    const { words: batch } = selectBatch(words, 'normal', settings)
    expect(batch.length).toBe(5)
  })
})

describe('selectBatch — review mode', () => {
  it('returns only problematic words, worst-first', () => {
    const a = makeWord({ weak: 1, timesWrongInExam: 3, lastSeenAt: 100 })
    const b = makeWord({ weak: 1, timesWrongInExam: 5, lastSeenAt: 200 })
    const c = makeWord({ weak: 0, timesWrongInExam: 10, lastSeenAt: 50 })
    const { words } = selectBatch([a, b, c], 'review', settings)
    expect(words[0].id).toBe(b.id)
    expect(words.find((w) => w.id === c.id)).toBeUndefined()
  })

  it('returns empty with reason when no problematic words', () => {
    const { words, emptyReason } = selectBatch([makeWord()], 'review', settings)
    expect(words).toHaveLength(0)
    expect(emptyReason).toBeTruthy()
  })
})

describe('shuffleDifferentFrom', () => {
  it('produces a different order for arrays longer than 1', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8]
    let differentFound = false
    for (let i = 0; i < 20; i++) {
      const result = shuffleDifferentFrom(arr, arr)
      if (!result.every((v, idx) => v === arr[idx])) {
        differentFound = true
        break
      }
    }
    expect(differentFound).toBe(true)
  })
})
