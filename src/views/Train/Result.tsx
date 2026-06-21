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
    result.scorePct >= 90
      ? 'text-green-600'
      : result.scorePct >= 70
        ? 'text-blue-600'
        : result.scorePct >= 50
          ? 'text-yellow-600'
          : 'text-red-500'

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
        <p className={`text-5xl font-bold mb-1 ${gradeColor}`}>{result.scorePct}%</p>
        <p className={`text-lg font-semibold ${gradeColor}`}>{result.grade}</p>
        <p className="text-slate-500 text-sm mt-1">
          {correct} / {total} correct
          {overrides.size > 0 && <span className="text-slate-400"> (with overrides)</span>}
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

          return (
            <div
              key={answer.wordId}
              className={`rounded-lg px-3 py-2.5 border ${
                isWeak
                  ? 'bg-orange-50 border-orange-200'
                  : isCorrect
                    ? 'bg-green-50 border-green-200'
                    : 'bg-red-50 border-red-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium shrink-0 ${
                  isWeak ? 'text-orange-500' : isCorrect ? 'text-green-700' : 'text-red-700'
                }`}>
                  {isWeak ? '⚑' : isCorrect ? '✓' : '✗'}
                </span>
                <div className="flex-1 grid grid-cols-2 items-center min-w-0">
                  <span className={`text-right text-sm font-medium pr-3 truncate ${
                    isCorrect && !isWeak ? 'text-slate-700' : 'text-slate-500'
                  }`}>{word.term}</span>
                  <span className="text-left text-slate-500 text-sm pl-3 truncate">{word.translation}</span>
                </div>
                {!ov && (
                  answer.matched ? (
                    <button
                      onClick={() => markWeak(answer.wordId)}
                      className="shrink-0 text-xs text-slate-400 hover:text-orange-500 px-1.5 py-0.5 rounded border border-transparent hover:border-orange-200 transition-colors"
                      title="Flag as weak"
                    >
                      ⚑
                    </button>
                  ) : (
                    <button
                      onClick={() => markCorrect(answer.wordId)}
                      className="shrink-0 text-xs text-slate-400 hover:text-green-600 px-1.5 py-0.5 rounded border border-transparent hover:border-green-200 transition-colors"
                      title="Accept as correct"
                    >
                      ✓
                    </button>
                  )
                )}
                {ov && (
                  <span className="shrink-0 text-xs text-slate-400 italic">
                    {ov === 'correct' ? 'accepted' : 'flagged'}
                  </span>
                )}
              </div>
              {!isCorrect && !ov && (
                <div className="mt-1 pl-5 text-xs space-y-0.5">
                  <p className="text-red-500">
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
