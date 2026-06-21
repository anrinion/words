export interface Deck {
  id: string
  userId: string
  name: string
  targetLanguage: string
  nativeLanguage: string
  createdAt: number
}

export interface Word {
  id: string
  deckId: string
  term: string
  translation: string
  levelTag: string | null
  categoryTag: string | null
  notes: string | null
  example: string | null
  exampleTranslation: string | null
  createdAt: number
  timesSeenInExam: number
  timesCorrectInExam: number
  timesWrongInExam: number
  streak: number
  weak: number // 0 | 1 (D1 has no bool)
  lastSeenAt: number | null
}

export interface RoundRecord {
  orderShown: string[] // wordIds
  selfCheckedIds: string[]
}

export interface ExamAnswer {
  wordId: string
  rawInput: string
  matched: boolean
}

export interface SessionData {
  batchWordIds: string[]
  rounds: RoundRecord[]
  exam: {
    orderShown: string[]
    answers: ExamAnswer[]
    scorePct: number
    grade: string
  }
}

export interface Session {
  id: string
  deckId: string
  userId: string
  timestamp: number
  mode: 'normal' | 'review'
  data: SessionData
}

export interface ToleranceBand {
  maxLen: number
  tolerance: number
}

export interface GradeBand {
  minScore: number
  label: string
}

export interface Settings {
  batchSize: number
  numRounds: number
  masteryStreakThreshold: number
  fuzzyToleranceBands: ToleranceBand[]
  gradeBands: GradeBand[]
}

export const DEFAULT_SETTINGS: Settings = {
  batchSize: 15,
  numRounds: 2,
  masteryStreakThreshold: 2,
  fuzzyToleranceBands: [
    { maxLen: 4, tolerance: 0 },
    { maxLen: 7, tolerance: 1 },
    { maxLen: Infinity, tolerance: 2 },
  ],
  gradeBands: [
    { minScore: 90, label: 'Excellent' },
    { minScore: 70, label: 'Good' },
    { minScore: 50, label: 'Shaky pass' },
    { minScore: 0, label: 'Fail' },
  ],
}

export interface DeckStats {
  total: number
  mastered: number
  weak: number
  neverSeen: number
}

export interface ParsedWord {
  id?: string // client-generated UUID; used by Anki adapter for audio indexing
  term: string
  translation: string
  levelTag?: string
  categoryTag?: string
  notes?: string
  example?: string
  exampleTranslation?: string
}

export interface ParseResult {
  words: ParsedWord[]
  rejected: { line: string; reason: string }[]
}

export interface ImportResult {
  imported: number
  duplicates: number
  skippedDuplicates: string[]
  rejected: { line: string; reason: string }[]
}
