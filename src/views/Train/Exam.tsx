import { useState } from 'react'
import type { Word } from '@shared/types'
import { useTheme } from '../../contexts/ThemeContext'

export default function Exam({
  order,
  onSubmit,
}: {
  order: Word[]
  onSubmit: (answers: Record<string, string>) => void
}) {
  const { theme: t } = useTheme()
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)

  const emptyCount = order.filter((w) => !(answers[w.id] ?? '').trim()).length

  function handleSubmit() {
    if (submitted) return
    setSubmitted(true)
    onSubmit(answers)
  }

  return (
    <div className="p-4">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-[var(--ink)]">{t.examLabel}</h2>
        <p className="text-sm text-[var(--ink-soft)]">
          Type the term for each translation. Submit when ready.
        </p>
      </div>

      <div className="space-y-1.5 mb-6">
        {order.map((word, i) => (
          <div key={word.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--ink-faint)] w-4 text-right shrink-0">{i + 1}</span>
              <div className="flex-1 grid grid-cols-2 gap-2 items-center min-w-0">
                <input
                  disabled={submitted}
                  value={answers[word.id] ?? ''}
                  onChange={(e) => setAnswers((prev) => ({ ...prev, [word.id]: e.target.value }))}
                  placeholder="your answer"
                  className="input text-sm text-right"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <span className="text-sm text-[var(--ink-soft)] pl-3 truncate">{word.translation}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={handleSubmit}
        disabled={submitted}
        className="btn-primary w-full py-3"
      >
        {submitted ? 'Submitting…' : `Submit ${order.length} answers`}
      </button>

      {emptyCount > 0 && !submitted && (
        <p className="text-xs text-[var(--ink-faint)] text-center mt-2">
          {emptyCount} answer{emptyCount !== 1 ? 's' : ''} missing — will count as wrong
        </p>
      )}
    </div>
  )
}
