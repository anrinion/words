import { useState } from 'react'
import type { Word } from '@shared/types'
import { useTheme } from '../../contexts/ThemeContext'
import PhaseShell from '../../components/PhaseShell'
import { TrainButton } from '../../components/TrainButton'

export default function RoundView({
  order,
  roundNumber,
  label,
  onDone,
}: {
  order: Word[]
  roundNumber: number
  label?: string
  onDone: () => void
}) {
  const { theme: t } = useTheme()
  const [revealed, setRevealed] = useState(false)
  const isExam = !!label

  const title = isExam ? label! : `Practice`
  const roundLabel = !isExam && `round ${roundNumber} of 2`

  return (
    <PhaseShell title={title} badge={roundLabel || undefined}>
      <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 16, overflow: 'hidden' }}>
        {order.map((word, i) => (
          <div
            key={word.id}
            style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              alignItems: 'center', gap: 8, padding: '8px 18px',
              borderTop: i === 0 ? 'none' : `1px solid ${t.border}`,
              background: i % 2 === 1 ? t.surface2 : 'transparent',
            }}
          >
            {/* Translation (right-aligned left column) */}
            <span style={{ fontSize: 14.5, color: t.inkSoft, textAlign: 'right', fontFamily: t.fontBody }}>
              {word.translation}
            </span>
            {/* Term or dots — identical font-size keeps row height stable */}
            <span style={{
              fontSize: 15, fontFamily: t.fontBody,
              fontWeight: revealed ? 700 : 400,
              color: revealed ? t.ink : t.inkFaint,
              letterSpacing: revealed ? 'normal' : '3px',
            }}>
              {revealed ? word.term : '· · ·'}
            </span>
          </div>
        ))}
      </div>

      {!revealed ? (
        <TrainButton variant="secondary" onClick={() => setRevealed(true)} style={{ marginTop: 12 }}>
          Reveal all words
        </TrainButton>
      ) : (
        <TrainButton onClick={onDone} style={{ marginTop: 12 }}>
          {isExam ? 'Mark results →' : roundNumber === 1 ? 'Continue to round 2 →' : 'Continue →'}
        </TrainButton>
      )}
    </PhaseShell>
  )
}
