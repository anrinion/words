import { useState, CSSProperties } from 'react'
import type { Word } from '@shared/types'
import { useTheme } from '../../contexts/ThemeContext'
import PhaseShell from '../../components/PhaseShell'
import { TrainButton } from '../../components/TrainButton'

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
}: {
  batch: Word[]
  result: ResultData
  deckId: string
  onDone: () => void
  onAgain: () => void
}) {
  const { theme: t } = useTheme()
  const wordMap = new Map(batch.map(w => [w.id, w]))
  const [solidShown, setSolidShown] = useState(false)

  const solidWords = result.answers
    .filter(a => a.matched)
    .map(a => wordMap.get(a.wordId))
    .filter((w): w is Word => !!w)

  const revisitWords = result.answers
    .filter(a => !a.matched)
    .map(a => wordMap.get(a.wordId))
    .filter((w): w is Word => !!w)

  const total = result.answers.length
  const solidCount = solidWords.length
  const revisitCount = revisitWords.length

  const wordRow = (i: number, tint?: string): CSSProperties => ({
    display: 'grid', gridTemplateColumns: '1fr 1fr',
    alignItems: 'center', gap: 12, padding: '12px 16px',
    borderTop: i === 0 ? 'none' : `1px solid ${tint ? tint + '33' : t.border}`,
  })

  return (
    <PhaseShell topPadding={26}>

      {/* Hero */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <div style={{
          width: 66, height: 66, borderRadius: '50%',
          background: `${t.statusMastered}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: t.statusMastered,
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <p style={{ fontSize: 15, color: t.inkSoft, margin: '18px 0 0', fontFamily: t.fontBody }}>
          You reviewed <strong style={{ color: t.ink }}>{total} words</strong> today.
        </p>

        {/* Stat pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 16 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 14, fontWeight: 600, color: t.ink, fontFamily: t.fontBody }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: t.statusMastered, flexShrink: 0 }} />
            {solidCount} correct
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 14, fontWeight: 600, color: t.ink, fontFamily: t.fontBody }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: t.statusWeak, flexShrink: 0 }} />
            {revisitCount} wrong
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ width: '100%', maxWidth: 320, height: 8, borderRadius: 99, background: t.surface2, marginTop: 16, overflow: 'hidden' }}>
          <div style={{
            width: `${total > 0 ? Math.round(solidCount / total * 100) : 0}%`,
            height: '100%', borderRadius: 99, background: t.statusMastered,
            transition: 'width .5s ease',
          }} />
        </div>
      </div>

      {/* Worth another look */}
      {revisitCount > 0 && (
        <div style={{ marginTop: 30 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: t.statusWeak, flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.03em', color: t.ink, fontFamily: t.fontBody }}>WRONG</span>
          </div>
          <div style={{
            background: `${t.statusWeak}0d`, border: `1px solid ${t.statusWeak}2e`,
            borderRadius: 14, overflow: 'hidden',
          }}>
            {revisitWords.map((word, i) => (
              <div key={word.id} style={wordRow(i, t.statusWeak)}>
                <span style={{ fontSize: 14.5, fontWeight: 600, color: t.ink, fontFamily: t.fontBody }}>{word.term}</span>
                <span style={{ fontSize: 14, color: t.inkSoft, fontFamily: t.fontBody }}>{word.translation}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feels solid (collapsible) */}
      {solidCount > 0 && (
        <div style={{ marginTop: 22 }}>
          <button
            onClick={() => setSolidShown(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', background: 'none', border: 'none', padding: '0 0 10px',
              cursor: 'pointer',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: t.statusMastered, flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.03em', color: t.ink, fontFamily: t.fontBody }}>
                CORRECT · {solidCount}
              </span>
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, color: t.pop, fontFamily: t.fontBody }}>
              {solidShown ? 'Hide' : 'View'}
            </span>
          </button>
          {solidShown && (
            <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 14, overflow: 'hidden' }}>
              {solidWords.map((word, i) => (
                <div key={word.id} style={wordRow(i)}>
                  <span style={{ fontSize: 14.5, fontWeight: 600, color: t.ink, fontFamily: t.fontBody }}>{word.term}</span>
                  <span style={{ fontSize: 14, color: t.inkSoft, fontFamily: t.fontBody }}>{word.translation}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <TrainButton onClick={onDone} style={{ marginTop: 28 }}>Done</TrainButton>
    </PhaseShell>
  )
}
