import { Outlet, NavLink, useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { decksApi } from '../api/decks'
import type { Deck } from '@shared/types'

export default function DeckLayout() {
  const { deckId } = useParams<{ deckId: string }>()
  const navigate = useNavigate()
  const [deck, setDeck] = useState<Deck | null>(null)

  useEffect(() => {
    decksApi.list().then((decks) => {
      const found = decks.find((d) => d.id === deckId)
      if (!found) navigate('/', { replace: true })
      else setDeck(found)
    })
  }, [deckId, navigate])

  if (!deck) return null

  const tabClass = ({ isActive }: { isActive: boolean }) =>
    `flex flex-col items-center gap-0.5 px-6 py-2 text-xs font-medium transition-colors ${
      isActive ? 'text-blue-500' : 'text-slate-500'
    }`

  return (
    <div className="flex flex-col h-dvh bg-white">
      {/* Header */}
      <header className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 bg-white">
        <button
          onClick={() => navigate('/')}
          className="text-slate-400 hover:text-slate-600 p-1 -ml-1"
          aria-label="Back to decks"
        >
          ←
        </button>
        <div className="min-w-0">
          <p className="font-semibold text-slate-800 truncate">{deck.name}</p>
          <p className="text-xs text-slate-400">
            {deck.targetLanguage} · {deck.nativeLanguage}
          </p>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet context={deck} />
      </main>

      {/* Bottom tab bar */}
      <nav className="flex border-t border-slate-200 bg-white pb-safe">
        <NavLink to={`/deck/${deckId}/words`} className={tabClass}>
          <span className="text-lg">📚</span>
          Words
        </NavLink>
        <NavLink to={`/deck/${deckId}/train`} className={tabClass}>
          <span className="text-lg">🎯</span>
          Train
        </NavLink>
        <NavLink to={`/deck/${deckId}/progress`} className={tabClass}>
          <span className="text-lg">📊</span>
          Progress
        </NavLink>
      </nav>
    </div>
  )
}
