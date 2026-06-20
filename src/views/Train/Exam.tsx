import { useState } from 'react'
import type { Word } from '@shared/types'

export default function Exam({
  order,
  onSubmit,
}: {
  order: Word[]
  onSubmit: (answers: Record<string, string>) => void
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit() {
    if (submitted) return
    setSubmitted(true)
    onSubmit(answers)
  }

  const allFilled = order.every((w) => (answers[w.id] ?? '').trim().length > 0)

  return (
    <div className="p-4">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-slate-800">Exam</h2>
        <p className="text-sm text-slate-500">
          Type the term for each translation. Fill all {order.length} rows, then submit.
        </p>
      </div>

      <div className="space-y-2 mb-6">
        {order.map((word, i) => (
          <div key={word.id} className="bg-white border border-slate-200 rounded-lg px-3 py-2.5">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs text-slate-400 w-5 text-right shrink-0">{i + 1}</span>
              <span className="text-sm text-slate-600">{word.translation}</span>
            </div>
            <input
              disabled={submitted}
              value={answers[word.id] ?? ''}
              onChange={(e) =>
                setAnswers((prev) => ({ ...prev, [word.id]: e.target.value }))
              }
              placeholder="Type the term…"
              className="input text-sm"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
        ))}
      </div>

      <button
        onClick={handleSubmit}
        disabled={submitted || !allFilled}
        className="btn-primary w-full py-3"
      >
        {submitted ? 'Submitting…' : `Submit all ${order.length} answers`}
      </button>

      {!allFilled && !submitted && (
        <p className="text-xs text-slate-400 text-center mt-2">
          Fill in all answers before submitting
        </p>
      )}
    </div>
  )
}
