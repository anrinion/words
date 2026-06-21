import { useState } from 'react'
import type { Word } from '@shared/types'
import { wordsApi } from '../../api/words'

interface ExamAnswer {
  wordId: string
  rawInput: string
  matched: boolean
}

interface ResultData {
  scorePct: number
  grade: string
  answers: ExamAnswer[]
}

export default function Result({
  batch,
  result,
  deckId,
  onDone,
  onAgain,
}: {
  batch: Word[]
  result: ResultData
  deckId: string
  onDone: () => void
  onAgain: () => void
}) {
  const wordMap = new Map(batch.map((w) => [w.id, w]))
  const [overrides, setOverrides] = useState<Map<string, 'correct' | 'weak'>>(new Map())

  const correct = result.answers.filter((a) => {
    const ov = overrides.get(a.wordId)
    return ov === 'correct' || (a.matched && ov !== 'weak')
  }).length
  const total = result.answers.length

  const gradeColor =
    result.scorePct >= 90 ? '#16a34a'
    : result.scorePct >= 70 ? '#2563eb'
    : result.scorePct >= 50 ? '#d97706'
    : '#ef4444'

  async function markCorrect(wordId: string) {
    await wordsApi.update(deckId, wordId, { weak: 0, streak: 1 })
    setOverrides((m) => new Map(m).set(wordId, 'correct'))
  }

  async function markWeak(wordId: string) {
    await wordsApi.update(deckId, wordId, { weak: 1, streak: 0 })
    setOverrides((m) => new Map(m).set(wordId, 'weak'))
  }

  return (
    <div className="p-4">
      {/* Score summary */}
      <div className="text-center py-6 mb-4">
        <p className="text-5xl font-bold mb-1" style={{ color: gradeColor }}>{result.scorePct}%</p>
        <p className="text-lg font-semibold" style={{ color: gradeColor }}>{result.grade}</p>
        <p className="text-sm mt-1 text-[var(--ink-soft)]">
          {correct} / {total} correct
          {overrides.size > 0 && <span className="text-[var(--ink-faint)]"> (with overrides)</span>}
        </p>
      </div>

      {/* Per-word breakdown */}
      <div className="space-y-2 mb-6">
        {result.answers.map((answer) => {
          const word = wordMap.get(answer.wordId)
          if (!word) return null
          const ov = overrides.get(answer.wordId)
          const isCorrect = ov === 'correct' || (answer.matched && ov !== 'weak')
          const isWeak = ov === 'weak'

          const bgColor = isWeak
            ? 'rgba(249,115,22,.1)' : isCorrect
            ? 'rgba(34,197,94,.1)' : 'rgba(239,68,68,.1)'
          const borderColor = isWeak
            ? 'rgba(249,115,22,.3)' : isCorrect
            ? 'rgba(34,197,94,.3)' : 'rgba(239,68,68,.3)'
          const iconColor = isWeak ? '#f97316' : isCorrect ? '#16a34a' : '#ef4444'

          return (
            <div
              key={answer.wordId}
              className="rounded-lg px-3 py-2.5"
              style={{ background: bgColor, border: `1px solid ${borderColor}` }}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium shrink-0" style={{ color: iconColor }}>
                  {isWeak ? '⚑' : isCorrect ? '✓' : '✗'}
                </span>
                <div className="flex-1 grid grid-cols-2 items-center min-w-0">
                  <span className="text-right text-sm font-medium pr-3 truncate text-[var(--ink-soft)]">{word.term}</span>
                  <span className="text-left text-[var(--ink-soft)] text-sm pl-3 truncate">{word.translation}</span>
                </div>
                {!ov && (
                  answer.matched ? (
                    <button
                      onClick={() => markWeak(answer.wordId)}
                      className="shrink-0 text-xs text-[var(--ink-faint)] hover:text-orange-500 px-1.5 py-0.5 rounded border border-transparent hover:border-orange-300 transition-colors"
                      title="Flag as weak"
                    >
                      ⚑
                    </button>
                  ) : (
                    <button
                      onClick={() => markCorrect(answer.wordId)}
                      className="shrink-0 text-xs text-[var(--ink-faint)] hover:text-green-600 px-1.5 py-0.5 rounded border border-transparent hover:border-green-300 transition-colors"
                      title="Accept as correct"
                    >
                      ✓
                    </button>
                  )
                )}
                {ov && (
                  <span className="shrink-0 text-xs text-[var(--ink-faint)] italic">
                    {ov === 'correct' ? 'accepted' : 'flagged'}
                  </span>
                )}
              </div>
              {!isCorrect && !ov && (
                <div className="mt-1 pl-5 text-xs space-y-0.5">
                  <p style={{ color: '#ef4444' }}>
                    You wrote: <span className="font-mono">{answer.rawInput || '(blank)'}</span>
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex gap-2">
        <button onClick={onDone} className="btn-secondary flex-1">Done</button>
        <button onClick={onAgain} className="btn-primary flex-1">Again</button>
      </div>
    </div>
  )
}
