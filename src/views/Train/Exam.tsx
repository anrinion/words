import { useState } from 'react'
import type { Word } from '@shared/types'
import { useTheme } from '../../contexts/ThemeContext'

// ── Desktop: typed input ──────────────────────────────────────────────────────

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
                <span className="text-sm text-[var(--ink-soft)] pl-3 break-words">{word.translation}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button onClick={handleSubmit} disabled={submitted} className="btn-primary w-full py-3">
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

// ── Mobile: self-assessment checkboxes ───────────────────────────────────────

export function ExamCheck({
  order,
  onSubmit,
}: {
  order: Word[]
  onSubmit: (answers: Record<string, string>) => void
}) {
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [submitted, setSubmitted] = useState(false)

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function handleSubmit() {
    if (submitted) return
    setSubmitted(true)
    const answers: Record<string, string> = {}
    for (const word of order) {
      // checked = recalled correctly → supply exact term so fuzzy match passes
      answers[word.id] = checked.has(word.id) ? word.term : ''
    }
    onSubmit(answers)
  }

  return (
    <div className="p-4">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-[var(--ink)]">Mark your results</h2>
        <p className="text-sm text-[var(--ink-soft)]">
          Tick every term you recalled correctly. Be honest.
        </p>
      </div>

      <div className="space-y-2 mb-4">
        {order.map((word) => {
          const isChecked = checked.has(word.id)
          return (
            <button
              key={word.id}
              disabled={submitted}
              onClick={() => toggle(word.id)}
              className={`w-full flex gap-3 items-start rounded-lg px-3 py-2.5 border text-left transition-colors ${
                isChecked
                  ? 'bg-[var(--pop-soft)] border-[var(--pop)]'
                  : 'bg-[var(--surface)] border-[var(--border)] hover:bg-[var(--surface2)]'
              }`}
            >
              <span
                className={`w-5 h-5 shrink-0 rounded border-2 flex items-center justify-center transition-colors mt-0.5 ${
                  isChecked ? 'bg-green-500 border-green-500 text-white' : 'border-[var(--border)]'
                }`}
              >
                {isChecked && '✓'}
              </span>
              <div className="flex-1 grid grid-cols-2 items-start min-w-0">
                <span className="text-right font-medium text-[var(--ink)] text-sm pr-3 break-words">
                  {word.term}
                </span>
                <span className="text-left text-[var(--ink-soft)] text-sm pl-3 break-words">
                  {word.translation}
                </span>
              </div>
            </button>
          )
        })}
      </div>

      <p className="text-xs text-[var(--ink-faint)] text-center mb-3">
        {checked.size} of {order.length} recalled
      </p>

      <button onClick={handleSubmit} disabled={submitted} className="btn-primary w-full py-3">
        {submitted ? 'Submitting…' : `Submit — ${order.length - checked.size} wrong`}
      </button>
    </div>
  )
}
