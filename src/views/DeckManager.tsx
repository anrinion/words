import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { decksApi } from '../api/decks'

export default function DeckManager() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    decksApi.list().then((decks) => {
      if (decks.length > 0) {
        navigate(`/deck/${decks[0].id}/train`, { replace: true })
      } else {
        setReady(true)
      }
    })
  }, [navigate])

  if (!ready) return null

  async function handleCreate(name: string, targetLanguage: string, nativeLanguage: string) {
    const deck = await decksApi.create({ name, targetLanguage, nativeLanguage })
    navigate(`/deck/${deck.id}/train`)
  }

  return (
    <div className="flex flex-col h-dvh bg-white items-center justify-center p-8 text-center">
      <p className="text-5xl mb-4">📖</p>
      <h1 className="text-2xl font-bold text-slate-800 mb-2">Vocabulary Trainer</h1>
      <p className="text-slate-500 mb-8 text-sm">Create your first deck to get started.</p>
      <button onClick={() => setShowModal(true)} className="btn-primary px-8 py-3">
        Create deck
      </button>
      {showModal && (
        <CreateDeckModal onConfirm={handleCreate} onCancel={() => setShowModal(false)} />
      )}
    </div>
  )
}

function CreateDeckModal({ onConfirm, onCancel }: { onConfirm: (name: string, target: string, native: string) => void; onCancel: () => void }) {
  const [name, setName] = useState('')
  const [target, setTarget] = useState('')
  const [native, setNative] = useState('')
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => ref.current?.focus(), [])

  function submit() {
    if (name.trim() && target.trim() && native.trim()) onConfirm(name.trim(), target.trim(), native.trim())
  }
  function onEnter(e: React.KeyboardEvent) { if (e.key === 'Enter') { e.preventDefault(); submit() } }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-800">New deck</h2>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>
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
          <button onClick={submit} className={`btn-primary w-full ${!name.trim() || !target.trim() || !native.trim() ? 'opacity-40 pointer-events-none' : ''}`}>
            Create deck
          </button>
        </div>
      </div>
    </div>
  )
}
