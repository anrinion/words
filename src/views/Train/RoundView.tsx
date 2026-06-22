import { useState, CSSProperties } from 'react'
import type { Word } from '@shared/types'
import { useTheme } from '../../contexts/ThemeContext'

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

  const primaryBtn: CSSProperties = {
    width: '100%', padding: 15, borderRadius: 14, border: 'none',
    background: t.pop, color: t.popInk, fontSize: 15, fontWeight: 700,
    cursor: 'pointer', fontFamily: t.fontBody, marginTop: 12,
    boxShadow: `0 2px 8px ${t.pop}46`,
  }
  const secondaryBtn: CSSProperties = {
    ...primaryBtn, background: t.surface, color: t.ink,
    border: `1px solid ${t.border}`, boxShadow: 'none',
  }

  const title = isExam ? label! : `Practice`
  const subtitle = isExam
    ? `Read through at your own pace.`
    : `Read each translation, recall the ${roundNumber === 1 ? 'word' : 'word again'}, then reveal all at once.`
  const roundLabel = !isExam && `round ${roundNumber} of 2`

  return (
    <div style={{ padding: '18px 22px 80px', maxWidth: 680, margin: '0 auto', width: '100%' }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <h2 style={{ fontSize: 23, fontWeight: 700, color: t.ink, margin: 0, fontFamily: t.fontHead }}>{title}</h2>
          {roundLabel && <span style={{ fontSize: 13.5, fontWeight: 500, color: t.inkSoft, fontFamily: t.fontBody }}>{roundLabel}</span>}
        </div>
        <p style={{ fontSize: 14.5, color: t.inkSoft, margin: '6px 0 0', fontFamily: t.fontBody }}>{subtitle}</p>
      </div>

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
        <button onClick={() => setRevealed(true)} style={secondaryBtn}>
          Reveal all words
        </button>
      ) : (
        <button onClick={onDone} style={primaryBtn}>
          {isExam ? 'Mark results →' : roundNumber === 1 ? 'Continue to round 2 →' : 'Continue →'}
        </button>
      )}
    </div>
  )
}
