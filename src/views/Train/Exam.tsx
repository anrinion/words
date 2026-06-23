import { useState } from 'react'
import type { Word } from '@shared/types'
import { useTheme } from '../../contexts/ThemeContext'
import PhaseShell from '../../components/PhaseShell'
import { TrainButton } from '../../components/TrainButton'

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

  function handleSubmit() {
    if (submitted) return
    setSubmitted(true)
    onSubmit(answers)
  }

  return (
    <PhaseShell title="Recall" subtitle="Type what you remember. Unsure about one? Leave it blank and move on — those just become tomorrow's practice.">
      <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 16, overflow: 'hidden' }}>
        {order.map((word, i) => (
          <div
            key={word.id}
            style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              alignItems: 'center', gap: 8, padding: '7px 18px',
              borderTop: i === 0 ? 'none' : `1px solid ${t.border}`,
              background: i % 2 === 1 ? t.surface2 : 'transparent',
            }}
          >
            <span style={{ fontSize: 14, color: t.inkSoft, textAlign: 'right', fontFamily: t.fontBody }}>
              {word.translation}
            </span>
            <input
              disabled={submitted}
              value={answers[word.id] ?? ''}
              onChange={e => setAnswers(prev => ({ ...prev, [word.id]: e.target.value }))}
              placeholder="type the word…"
              className="input" style={{ fontWeight: 600 }}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
        ))}
      </div>

      <TrainButton onClick={handleSubmit} disabled={submitted} style={{ marginTop: 18 }}>
        {submitted ? 'Submitting…' : 'See how I did →'}
      </TrainButton>

      <p style={{ textAlign: 'center', fontSize: 13, color: t.inkFaint, margin: '12px 0 0', fontFamily: t.fontBody }}>
        Blanks just mean we'll revisit those together — that's the point.
      </p>
    </PhaseShell>
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
  const { theme: t } = useTheme()
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [submitted, setSubmitted] = useState(false)

  function toggle(id: string) {
    setChecked(prev => {
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
      answers[word.id] = checked.has(word.id) ? word.term : ''
    }
    onSubmit(answers)
  }

  return (
    <PhaseShell title="Mark your results" subtitle="Tick every word you recalled. Be honest with yourself.">
      <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 16, overflow: 'hidden' }}>
        {order.map((word, i) => {
          const isChecked = checked.has(word.id)
          return (
            <button
              key={word.id}
              disabled={submitted}
              onClick={() => toggle(word.id)}
              style={{
                display: 'grid', gridTemplateColumns: '28px 1fr 1fr',
                alignItems: 'center', gap: 8, width: '100%',
                padding: '10px 18px', textAlign: 'left',
                borderTop: i === 0 ? 'none' : `1px solid ${t.border}`,
                border: 'none',
                background: isChecked ? t.popSoft : (i % 2 === 1 ? t.surface2 : t.surface),
                cursor: 'pointer',
              }}
            >
              <span style={{
                width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isChecked ? t.statusMastered : 'transparent',
                border: `2px solid ${isChecked ? t.statusMastered : t.border}`,
                color: t.popInk, fontSize: 12, fontWeight: 700,
              }}>
                {isChecked && '✓'}
              </span>
              <span style={{ fontSize: 14.5, fontWeight: 600, color: t.ink, textAlign: 'right', fontFamily: t.fontBody }}>
                {word.term}
              </span>
              <span style={{ fontSize: 14, color: t.inkSoft, fontFamily: t.fontBody }}>
                {word.translation}
              </span>
            </button>
          )
        })}
      </div>

      <p style={{ textAlign: 'center', fontSize: 13, color: t.inkFaint, margin: '14px 0 0', fontFamily: t.fontBody }}>
        {checked.size} of {order.length} recalled
      </p>

      <TrainButton onClick={handleSubmit} disabled={submitted} style={{ marginTop: 10 }}>
        {submitted ? 'Submitting…' : 'Done'}
      </TrainButton>
    </PhaseShell>
  )
}
