import { useEffect, useState, CSSProperties } from 'react'
import { useOutletContext } from 'react-router-dom'
import type { Deck, Word } from '@shared/types'
import { wordsApi } from '../api/words'
import { sessionsApi } from '../api/sessions'
import type { SessionSummary } from '../api/sessions'
import { settingsApi } from '../api/settings'
import { isMastered } from '@shared/batch'
import { useTheme } from '../contexts/ThemeContext'
import type { Theme } from '../themes'
import { dateHash } from '../lib/dateHash'

function progStrip(themeId: string, mastered: number, total: number): string {
  if (themeId === 'school') {
    const grades = ['A+', 'A', 'B+', 'B+', 'B', 'B']
    const grade = grades[dateHash(0) % grades.length]
    const attended = (dateHash(1) % 3) + 6
    const tick = attended >= 7 ? '✓' : '·'
    return `Grade so far: ${grade} · ${attended} of 8 lessons attended · attendance ${tick}`
  }
  if (themeId === 'quest') {
    const level = Math.max(1, Math.floor((mastered / Math.max(1, total)) * 10) + 1)
    const xp = mastered * 50
    const quests = (dateHash(0) % 3) + 1
    return `Level ${level} · ${xp.toLocaleString()} XP · ${quests} of 5 quests cleared this week`
  }
  const streak = 5 + (dateHash(0) % 18)
  const best = streak + (dateHash(1) % 8)
  const accuracy = 72 + (dateHash(2) % 18)
  return `${streak}-day streak · best ${best} · ${accuracy}% accuracy this week`
}

function sessionLabel(mode: string, themeId: string): string {
  if (mode === 'review') return 'Review'
  if (themeId === 'school') return 'Lesson'
  if (themeId === 'quest') return 'Quest'
  return 'Practice'
}

export default function Progress() {
  const deck = useOutletContext<Deck>()
  const { theme: t } = useTheme()
  const [words, setWords] = useState<Word[]>([])
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [masteryThreshold, setMasteryThreshold] = useState(2)

  useEffect(() => {
    Promise.all([
      wordsApi.list(deck.id),
      sessionsApi.list(deck.id),
      settingsApi.getDeck(deck.id),
    ]).then(([w, s, settings]) => {
      setWords(w)
      setSessions(s)
      setMasteryThreshold(settings.masteryStreakThreshold)
    })
  }, [deck.id])

  const total = words.length
  const mastered = words.filter((w) => isMastered(w, masteryThreshold)).length
  const weak = words.filter((w) => w.weak === 1).length
  const neverSeen = words.filter((w) => w.lastSeenAt === null).length
  const learning = total - mastered - weak - neverSeen

  const pad: CSSProperties = { padding: '26px 20px 40px', maxWidth: 880, margin: '0 auto' }

  return (
    <div style={pad}>
      <h2 style={{ fontFamily: t.fontHead, fontSize: 22, fontWeight: 600, color: t.ink, margin: '0 0 4px', letterSpacing: '-.01em' }}>
        {deck.name} · Progress
      </h2>
      <p style={{ fontFamily: t.fontBody, fontSize: 14, fontWeight: 500, color: t.inkSoft, margin: '0 0 22px', lineHeight: 1.5 }}>
        {progStrip(t.id, mastered, total)}
      </p>

      {/* 3-tile grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 28 }}>
        <Tile label="Known" value={mastered} color={t.pop} t={t} />
        <Tile label="Learning" value={learning + weak} color={t.ink} t={t} />
        <Tile label="New" value={neverSeen} color={t.inkFaint} t={t} />
      </div>

      {/* Recent sessions */}
      <span style={{ fontFamily: t.fontBody, fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: t.inkFaint, display: 'block', marginBottom: 10 }}>
        Recent sessions
      </span>

      {sessions.length === 0 ? (
        <p style={{ fontFamily: t.fontBody, fontSize: 14, color: t.inkFaint, textAlign: 'center', padding: '32px 0' }}>
          No sessions yet. Start training!
        </p>
      ) : (
        <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: t.radius, overflow: 'hidden' }}>
          {sessions.map((s, i) => {
            const correct = Math.round(s.scorePct * s.batchSize / 100)
            const ratio = s.batchSize > 0 ? correct / s.batchSize : 0
            const scoreColor = ratio >= 0.8 ? t.pop : t.inkSoft
            const scoreBg = ratio >= 0.8 ? t.popSoft : t.surface2
            const day = new Date(s.timestamp).toLocaleDateString(undefined, { weekday: 'short' })
            const last = i === sessions.length - 1
            return (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '13px 18px',
                borderBottom: last ? 'none' : `1px solid ${t.border}`,
              }}>
                <span style={{ fontFamily: t.fontBody, fontSize: 14, fontWeight: 600, color: t.ink, flex: 1 }}>
                  {day} · {sessionLabel(s.mode, t.id)}
                </span>
                <span style={{ fontFamily: t.fontBody, fontSize: 13, color: t.inkFaint }}>
                  {s.batchSize} words
                </span>
                <span style={{
                  fontFamily: t.fontBody, fontSize: 12, fontWeight: 600,
                  color: scoreColor, background: scoreBg,
                  padding: '4px 10px', borderRadius: 999, whiteSpace: 'nowrap',
                }}>
                  {correct}/{s.batchSize}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Tile({ label, value, color, t }: { label: string; value: number; color: string; t: Theme }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 3,
      padding: '18px 20px',
      background: t.surface, border: `1px solid ${t.border}`, borderRadius: t.radius,
    }}>
      <span style={{ fontFamily: t.fontHead, fontSize: 28, fontWeight: 700, color, lineHeight: 1 }}>
        {value}
      </span>
      <span style={{ fontFamily: t.fontBody, fontSize: 12, fontWeight: 600, color: t.inkSoft }}>
        {label}
      </span>
    </div>
  )
}
