import { useState } from 'react'
import type { Word } from '@shared/types'
import AudioButton from '../../components/AudioButton'

export default function Preview({
  batch,
  onContinue,
  onEditWord,
}: {
  batch: Word[]
  onContinue: () => void
  onEditWord?: (wordId: string, updates: { term: string; translation: string }) => Promise<void>
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTerm, setEditTerm] = useState('')
  const [editTranslation, setEditTranslation] = useState('')
  const [saving, setSaving] = useState(false)

  function startEdit(word: Word) {
    setEditingId(word.id)
    setEditTerm(word.term)
    setEditTranslation(word.translation)
  }

  function cancelEdit() { setEditingId(null) }

  async function saveEdit() {
    if (!editingId || !editTerm.trim() || !editTranslation.trim() || saving) return
    setSaving(true)
    await onEditWord?.(editingId, { term: editTerm.trim(), translation: editTranslation.trim() })
    setEditingId(null)
    setSaving(false)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); saveEdit() }
    if (e.key === 'Escape') cancelEdit()
  }

  return (
    <div className="p-4">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-[var(--ink)]">Preview</h2>
        <p className="text-sm text-[var(--ink-soft)]">
          Read through all {batch.length} words once. No interaction needed.
        </p>
      </div>

      <div className="space-y-1.5 mb-6">
        {batch.map((word) => (
          <div key={word.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2.5">
            {editingId === word.id ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    autoFocus
                    value={editTerm}
                    onChange={(e) => setEditTerm(e.target.value)}
                    onKeyDown={onKeyDown}
                    className="input text-sm text-right"
                    placeholder="Term"
                    autoCapitalize="none"
                    autoCorrect="off"
                  />
                  <input
                    value={editTranslation}
                    onChange={(e) => setEditTranslation(e.target.value)}
                    onKeyDown={onKeyDown}
                    className="input text-sm"
                    placeholder="Translation"
                    autoCapitalize="none"
                    autoCorrect="off"
                  />
                </div>
                <div className="flex gap-2 mt-2">
                  <button onClick={cancelEdit} className="btn-secondary text-xs flex-1 py-1.5">Cancel</button>
                  <button onClick={saveEdit} disabled={saving} className="btn-primary text-xs flex-1 py-1.5">Save</button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1">
                  <div className="flex-1 grid grid-cols-2 items-center min-w-0">
                    <div className="flex items-center justify-end gap-1 pr-3 min-w-0">
                      <AudioButton wordId={word.id} type="word" />
                      <span className="font-medium text-[var(--ink)] text-sm truncate">{word.term}</span>
                    </div>
                    <span className="text-left text-[var(--ink-soft)] text-sm pl-3 truncate">{word.translation}</span>
                  </div>
                  {onEditWord && (
                    <button
                      onClick={() => startEdit(word)}
                      className="shrink-0 text-[var(--ink-faint)] hover:text-[var(--ink)] p-1 text-sm leading-none"
                      title="Edit"
                    >
                      ✎
                    </button>
                  )}
                </div>
                {word.example && (
                  <div className="mt-1.5 border-t border-[var(--border)] pt-1.5">
                    <div className="flex items-center gap-1">
                      <div className="flex-1 grid grid-cols-2 items-center min-w-0">
                        <div className="flex items-center justify-end gap-1 pr-3 min-w-0">
                          <AudioButton wordId={word.id} type="example" />
                          <span className="text-xs italic text-[var(--ink-faint)] truncate">{word.example}</span>
                        </div>
                        <span className="text-left text-xs italic text-[var(--ink-faint)] pl-3 truncate">{word.exampleTranslation ?? ''}</span>
                      </div>
                      {onEditWord && <div className="shrink-0 p-1 text-sm leading-none invisible" aria-hidden>✎</div>}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      <button onClick={onContinue} className="btn-primary w-full py-3">
        Continue →
      </button>
    </div>
  )
}
