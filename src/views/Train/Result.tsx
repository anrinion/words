import type { Word } from '@shared/types'

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
  onDone,
  onAgain,
}: {
  batch: Word[]
  result: ResultData
  onDone: () => void
  onAgain: () => void
}) {
  const wordMap = new Map(batch.map((w) => [w.id, w]))
  const correct = result.answers.filter((a) => a.matched).length
  const total = result.answers.length

  const gradeColor =
    result.scorePct >= 90
      ? 'text-green-600'
      : result.scorePct >= 70
        ? 'text-blue-600'
        : result.scorePct >= 50
          ? 'text-yellow-600'
          : 'text-red-500'

  return (
    <div className="p-4">
      {/* Score summary */}
      <div className="text-center py-6 mb-4">
        <p className={`text-5xl font-bold mb-1 ${gradeColor}`}>{result.scorePct}%</p>
        <p className={`text-lg font-semibold ${gradeColor}`}>{result.grade}</p>
        <p className="text-slate-500 text-sm mt-1">
          {correct} / {total} correct
        </p>
      </div>

      {/* Per-word breakdown */}
      <div className="space-y-2 mb-6">
        {result.answers.map((answer) => {
          const word = wordMap.get(answer.wordId)
          if (!word) return null
          return (
            <div
              key={answer.wordId}
              className={`rounded-lg px-3 py-2.5 border ${
                answer.matched ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium ${answer.matched ? 'text-green-700' : 'text-red-700'}`}>
                  {answer.matched ? '✓' : '✗'}
                </span>
                <span className="text-sm text-slate-700">{word.translation}</span>
              </div>
              {!answer.matched && (
                <div className="mt-1 pl-5 text-xs space-y-0.5">
                  <p className="text-red-500">
                    You wrote: <span className="font-mono">{answer.rawInput || '(blank)'}</span>
                  </p>
                  <p className="text-slate-500">
                    Correct: <span className="font-medium text-slate-700">{word.term}</span>
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
