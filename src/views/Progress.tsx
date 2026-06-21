import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import type { Deck, Word } from '@shared/types'
import { wordsApi } from '../api/words'
import { sessionsApi } from '../api/sessions'
import type { SessionSummary } from '../api/sessions'
import { settingsApi } from '../api/settings'
import { isMastered } from '@shared/batch'

export default function Progress() {
  const deck = useOutletContext<Deck>()
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

  return (
    <div className="p-4">
      {/* Dashboard */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatCard label="Total words" value={total} />
        <StatCard label={`Mastered (${masteryThreshold}× correct)`} value={mastered} color="text-green-600" />
        <StatCard label="Weak" value={weak} color="text-red-500" />
        <StatCard label="Learning" value={learning} color="text-blue-500" />
        <StatCard label="Never seen" value={neverSeen} color="text-slate-400" />
      </div>

      {avgScore !== null && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-center">
          <p className="text-3xl font-bold text-blue-600">{avgScore}%</p>
          <p className="text-sm text-blue-500 mt-0.5">
            Average score across {sessions.length} session{sessions.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}

      {/* Session history */}
      <h3 className="text-sm font-semibold text-slate-700 mb-2">Session history</h3>

      {sessions.length === 0 ? (
        <p className="text-slate-400 text-sm text-center py-8">No sessions yet. Start training!</p>
      ) : (
        <div className="space-y-2">
          {sessions.map((s) => (
            <div
              key={s.id}
              className="bg-white border border-slate-200 rounded-lg px-3 py-2.5 flex items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm font-bold ${
                      s.scorePct >= 90
                        ? 'text-green-600'
                        : s.scorePct >= 70
                          ? 'text-blue-600'
                          : s.scorePct >= 50
                            ? 'text-yellow-600'
                            : 'text-red-500'
                    }`}
                  >
                    {s.scorePct}%
                  </span>
                  <span className="text-xs text-slate-500">{s.grade}</span>
                  <span className="text-xs bg-slate-100 text-slate-500 px-1.5 rounded-full ml-auto">
                    {s.mode}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {new Date(s.timestamp).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  · {s.batchSize} words
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  color = 'text-slate-800',
}: {
  label: string
  value: number
  color?: string
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  )
}
