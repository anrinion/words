import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { decksApi } from '../api/decks'
import type { Deck } from '@shared/types'

type Modal =
  | { type: 'create' }
  | { type: 'rename'; deck: Deck }
  | { type: 'delete'; deck: Deck }
  | null

export default function DeckManager() {
  const navigate = useNavigate()
  const [decks, setDecks] = useState<Deck[]>([])
  const [modal, setModal] = useState<Modal>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    decksApi.list().then((d) => { setDecks(d); setLoading(false) })
  }, [])

  async function handleCreate(name: string, targetLanguage: string, nativeLanguage: string) {
    const deck = await decksApi.create({ name, targetLanguage, nativeLanguage })
    setDecks((prev) => [...prev, deck])
    setModal(null)
    navigate(`/deck/${deck.id}/words`)
  }

  async function handleRename(id: string, name: string) {
    await decksApi.update(id, { name })
    setDecks((prev) => prev.map((d) => (d.id === id ? { ...d, name } : d)))
    setModal(null)
  }

  async function handleDelete(id: string) {
    await decksApi.remove(id)
    setDecks((prev) => prev.filter((d) => d.id !== id))
    setModal(null)
  }

  return (
    <div className="flex flex-col h-dvh bg-slate-50">
      <header className="px-4 pt-12 pb-4 bg-white border-b border-slate-200">
        <h1 className="text-2xl font-bold text-slate-800">Words</h1>
        <p className="text-sm text-slate-500 mt-0.5">Your vocabulary decks</p>
        <p className="text-xs text-slate-400 mt-1 font-mono">
          v0.0.1 · built {new Date(__BUILD_TIME__).toLocaleTimeString()}
        </p>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading && <p className="text-center text-slate-400 py-12">Loading…</p>}

        {!loading && decks.length === 0 && (
          <div className="text-center py-16 text-slate-500">
            <p className="text-4xl mb-3">📖</p>
            <p className="font-medium">No decks yet</p>
            <p className="text-sm mt-1">Create one to get started</p>
          </div>
        )}

        {decks.map((deck) => (
          <div
            key={deck.id}
            className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3"
          >
            <button
              className="flex-1 text-left min-w-0"
              onClick={() => navigate(`/deck/${deck.id}/train`)}
            >
              <p className="font-semibold text-slate-800 truncate">{deck.name}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {deck.targetLanguage} → {deck.nativeLanguage}
              </p>
            </button>
            <button
              onClick={() => setModal({ type: 'rename', deck })}
              className="text-slate-400 hover:text-slate-600 text-sm px-2 py-1"
            >
              Edit
            </button>
            <button
              onClick={() => setModal({ type: 'delete', deck })}
              className="text-red-400 hover:text-red-600 text-sm px-2 py-1"
            >
              Delete
            </button>
          </div>
        ))}
      </main>

      <div className="p-4 pb-safe">
        <button
          onClick={() => setModal({ type: 'create' })}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-xl transition-colors"
        >
          + New deck
        </button>
      </div>

      {modal?.type === 'create' && (
        <CreateDeckModal
          onConfirm={handleCreate}
          onCancel={() => setModal(null)}
        />
      )}
      {modal?.type === 'rename' && (
        <RenameDeckModal
          deck={modal.deck}
          onConfirm={(name) => handleRename(modal.deck.id, name)}
          onCancel={() => setModal(null)}
        />
      )}
      {modal?.type === 'delete' && (
        <DeleteDeckModal
          deck={modal.deck}
          onConfirm={() => handleDelete(modal.deck.id)}
          onCancel={() => setModal(null)}
        />
      )}
    </div>
  )
}

function CreateDeckModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: (name: string, target: string, native: string) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [target, setTarget] = useState('')
  const [native, setNative] = useState('')
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => ref.current?.focus(), [])

  function submit() {
    if (name.trim() && target.trim() && native.trim()) {
      onConfirm(name.trim(), target.trim(), native.trim())
    }
  }

  function onEnter(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); submit() }
  }

  return (
    <Modal title="New deck" onCancel={onCancel}>
      <div className="flex flex-col gap-3">
        <div>
          <label className="block text-sm text-slate-600 mb-1">Deck name</label>
          <input ref={ref} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={onEnter} placeholder="e.g. German B1 exam" className="input" />
        </div>
        <div>
          <label className="block text-sm text-slate-600 mb-1">Language you're learning</label>
          <input value={target} onChange={(e) => setTarget(e.target.value)} onKeyDown={onEnter} placeholder="e.g. de or German" className="input" />
        </div>
        <div>
          <label className="block text-sm text-slate-600 mb-1">Your native language</label>
          <input value={native} onChange={(e) => setNative(e.target.value)} onKeyDown={onEnter} placeholder="e.g. en or English" className="input" />
        </div>
        <button type="button" onClick={submit} className={`btn-primary w-full ${!name.trim() || !target.trim() || !native.trim() ? 'opacity-40 pointer-events-none' : ''}`}>
          Create deck
        </button>
      </div>
    </Modal>
  )
}

function RenameDeckModal({
  deck,
  onConfirm,
  onCancel,
}: {
  deck: Deck
  onConfirm: (name: string) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(deck.name)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { ref.current?.focus(); ref.current?.select() }, [])

  function submit() {
    if (name.trim()) onConfirm(name.trim())
  }

  return (
    <Modal title="Rename deck" onCancel={onCancel}>
      <div className="flex flex-col gap-3">
        <input
          ref={ref}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit() } }}
          className="input"
        />
        <button type="button" onClick={submit} className={`btn-primary w-full ${!name.trim() ? 'opacity-40 pointer-events-none' : ''}`}>
          Save
        </button>
      </div>
    </Modal>
  )
}

function DeleteDeckModal({
  deck,
  onConfirm,
  onCancel,
}: {
  deck: Deck
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Modal title="Delete deck?" onCancel={onCancel}>
      <p className="text-slate-600 mb-4">
        This will permanently delete <strong>{deck.name}</strong> and all its words and session
        history.
      </p>
      <div className="flex gap-2">
        <button onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
        <button onClick={onConfirm} className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex-1">
          Delete
        </button>
      </div>
    </Modal>
  )
}

function Modal({
  title,
  children,
  onCancel,
}: {
  title: string
  children: React.ReactNode
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-800">{title}</h2>
          <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-600 text-xl leading-none">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
