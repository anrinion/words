import { describe, it, expect } from 'vitest'
import { levenshtein, toleranceFor, matches, gradeLabel } from './fuzzy'

describe('levenshtein', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshtein('cat', 'cat')).toBe(0)
  })
  it('returns 1 for single insertion', () => {
    expect(levenshtein('cat', 'cats')).toBe(1)
  })
  it('returns 1 for single deletion', () => {
    expect(levenshtein('cats', 'cat')).toBe(1)
  })
  it('returns 1 for single substitution', () => {
    expect(levenshtein('cat', 'bat')).toBe(1)
  })
  it('handles empty strings', () => {
    expect(levenshtein('', 'abc')).toBe(3)
    expect(levenshtein('abc', '')).toBe(3)
    expect(levenshtein('', '')).toBe(0)
  })
})

describe('toleranceFor', () => {
  it('returns 0 for short words (≤4)', () => {
    expect(toleranceFor(1)).toBe(0)
    expect(toleranceFor(4)).toBe(0)
  })
  it('returns 1 for medium words (5–7)', () => {
    expect(toleranceFor(5)).toBe(1)
    expect(toleranceFor(7)).toBe(1)
  })
  it('returns 2 for long words (8+)', () => {
    expect(toleranceFor(8)).toBe(2)
    expect(toleranceFor(20)).toBe(2)
  })
})

describe('matches', () => {
  it('exact match (case-insensitive, trimmed)', () => {
    expect(matches('Hallo', 'hallo')).toBe(true)
    expect(matches('  hallo  ', 'hallo')).toBe(true)
  })
  it('rejects wrong short word (tolerance=0)', () => {
    expect(matches('bat', 'cat')).toBe(false) // len 3 → tol 0
  })
  it('accepts 1 typo in medium word', () => {
    expect(matches('helfen', 'hElfen')).toBe(true) // exact after lowercase
    expect(matches('helfan', 'helfen')).toBe(true) // 1 substitution, len 6 → tol 1
  })
  it('rejects transposition in medium word (2 edits in standard Levenshtein)', () => {
    expect(matches('helfne', 'helfen')).toBe(false) // swap n↔e = 2 edits, tol 1
  })
  it('accepts 1 deletion in 7-char word (tol=1)', () => {
    expect(matches('Sprche', 'Sprache')).toBe(true) // 1 deletion, len 7 → tol 1
    expect(matches('verstehen', 'versttehen')).toBe(true) // 1 insert, len 9 → tol 2
  })
})

describe('gradeLabel', () => {
  const bands = [
    { minScore: 90, label: 'Excellent' },
    { minScore: 70, label: 'Good' },
    { minScore: 50, label: 'Shaky pass' },
    { minScore: 0, label: 'Fail' },
  ]
  it('labels 100% as Excellent', () => expect(gradeLabel(100, bands)).toBe('Excellent'))
  it('labels 90% as Excellent', () => expect(gradeLabel(90, bands)).toBe('Excellent'))
  it('labels 70% as Good', () => expect(gradeLabel(70, bands)).toBe('Good'))
  it('labels 50% as Shaky pass', () => expect(gradeLabel(50, bands)).toBe('Shaky pass'))
  it('labels 49% as Fail', () => expect(gradeLabel(49, bands)).toBe('Fail'))
  it('labels 0% as Fail', () => expect(gradeLabel(0, bands)).toBe('Fail'))
})
