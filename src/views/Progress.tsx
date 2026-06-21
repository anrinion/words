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

  const avgScore =
    sessions.length > 0
      ? Math.round(sessions.reduce((sum, s) => sum + s.scorePct, 0) / sessions.length)
      : null

  const pad: CSSProperties = { padding: '26px 30px 40px', maxWidth: 880, margin: '0 auto' }

  const scoreColor =
    avgScore === null ? t.ink
    : avgScore >= 90 ? '#16a34a'
    : avgScore >= 70 ? t.pop
    : avgScore >= 50 ? '#d97706'
    : '#ef4444'

  return (
    <div style={pad}>
      {/* Compact stat strip */}
      <div style={{
        display: 'flex', background: t.surface, border: `1px solid ${t.border}`,
        borderRadius: t.radius, overflow: 'hidden', marginBottom: 16,
      }}>
        <StatChip label="Total" value={total} t={t} />
        <StatChip label="Mastered" value={mastered} t={t} accent={t.pop} />
        <StatChip label="Weak" value={weak} t={t} accent="#ef4444" />
        <StatChip label="Learning" value={learning} t={t} />
        <StatChip label="New" value={neverSeen} t={t} accent={t.inkFaint} last />
      </div>

      {/* Visual breakdown bar */}
      {total > 0 && (
        <div style={{ height: 6, borderRadius: 999, overflow: 'hidden', display: 'flex', gap: 2, marginBottom: 20 }}>
          {mastered > 0 && <div style={{ flex: mastered, background: t.pop, transition: 'flex .4s' }} />}
          {learning > 0 && <div style={{ flex: learning, background: t.popSoft, border: `1px solid ${t.pop}`, borderRadius: 0, transition: 'flex .4s' }} />}
          {weak > 0 && <div style={{ flex: weak, background: '#ef4444', transition: 'flex .4s' }} />}
          {neverSeen > 0 && <div style={{ flex: neverSeen, background: t.border, transition: 'flex .4s' }} />}
        </div>
      )}

      {/* Average score card */}
      {avgScore !== null && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', marginBottom: 20,
          background: t.surface, border: `1px solid ${t.border}`, borderRadius: t.radius,
        }}>
          <div>
            <span style={{ fontFamily: t.fontBody, fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: t.inkFaint }}>
              Average score
            </span>
            <p style={{ fontFamily: t.fontHead, fontSize: 32, fontWeight: 700, color: scoreColor, margin: 0, lineHeight: 1.1 }}>
              {avgScore}%
            </p>
          </div>
          <span style={{ fontFamily: t.fontBody, fontSize: 13, color: t.inkSoft }}>
            {sessions.length} session{sessions.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Session history */}
      <div style={{ fontFamily: t.fontBody, fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: t.inkFaint, marginBottom: 8 }}>
        Session history
      </div>

      {sessions.length === 0 ? (
        <p style={{ fontFamily: t.fontBody, fontSize: 14, color: t.inkFaint, textAlign: 'center', padding: '32px 0' }}>
          No sessions yet. Start training!
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {sessions.map((s) => {
            const c = s.scorePct >= 90 ? '#16a34a' : s.scorePct >= 70 ? t.pop : s.scorePct >= 50 ? '#d97706' : '#ef4444'
            return (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                background: t.surface, border: `1px solid ${t.border}`,
                borderRadius: t.radiusSm, padding: '10px 14px',
              }}>
                <span style={{ fontFamily: t.fontHead, fontSize: 18, fontWeight: 700, color: c, flexShrink: 0, minWidth: 48 }}>
                  {s.scorePct}%
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontFamily: t.fontBody, fontSize: 13, fontWeight: 600, color: t.ink }}>{s.grade}</span>
                  <span style={{ fontFamily: t.fontBody, fontSize: 12, color: t.inkFaint, marginLeft: 8 }}>{s.batchSize} words</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <span style={{
                    fontFamily: t.fontBody, fontSize: 11, fontWeight: 600, color: t.inkSoft,
                    padding: '2px 7px', background: t.surface2, border: `1px solid ${t.border}`, borderRadius: t.radiusSm,
                  }}>
                    {s.mode}
                  </span>
                  <span style={{ fontFamily: t.fontBody, fontSize: 11, color: t.inkFaint }}>
                    {new Date(s.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function StatChip({
  label, value, t, accent, last = false,
}: {
  label: string; value: number; t: Theme; accent?: string; last?: boolean
}) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '14px 8px',
      borderRight: last ? 'none' : `1px solid ${t.border}`,
    }}>
      <span style={{ fontFamily: t.fontHead, fontSize: 22, fontWeight: 700, color: accent ?? t.ink, lineHeight: 1 }}>
        {value}
      </span>
      <span style={{ fontFamily: t.fontBody, fontSize: 10, fontWeight: 600, color: t.inkFaint, letterSpacing: '.06em', textTransform: 'uppercase', marginTop: 4, textAlign: 'center' }}>
        {label}
      </span>
    </div>
  )
}
