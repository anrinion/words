import { useState } from 'react'
import type { Word } from '@shared/types'

export default function SelfCheck({
  batch,
  checkNumber,
  onDone,
  onEditWord,
}: {
  batch: Word[]
  checkNumber: number
  onDone: (checkedIds: string[]) => void
  onEditWord?: (wordId: string, updates: { term: string; translation: string }) => Promise<void>
}) {
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTerm, setEditTerm] = useState('')
  const [editTranslation, setEditTranslation] = useState('')
  const [saving, setSaving] = useState(false)

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

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
        <h2 className="text-lg font-bold text-[var(--ink)]">Self-check {checkNumber}</h2>
        <p className="text-sm text-[var(--ink-soft)]">
          Tick the words you recalled correctly. Scan the list yourself — don't rush.
        </p>
      </div>

      <div className="space-y-2 mb-6">
        {batch.map((word) => {
          const isChecked = checked.has(word.id)
          const isEditing = editingId === word.id

          if (isEditing) {
            return (
              <div key={word.id} className="bg-[var(--surface)] rounded-lg px-3 py-2.5" style={{ border: '2px solid var(--pop)' }}>
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
              </div>
            )
          }

          return (
            <div key={word.id} className="flex items-center gap-1.5">
              <button
                onClick={() => toggle(word.id)}
                className={`flex-1 flex gap-3 items-center rounded-lg px-3 py-2.5 border text-left transition-colors ${
                  isChecked
                    ? 'bg-[var(--pop-soft)] border-[var(--pop)]'
                    : 'bg-[var(--surface)] border-[var(--border)] hover:bg-[var(--surface2)]'
                }`}
              >
                <span
                  className={`w-5 h-5 shrink-0 rounded border-2 flex items-center justify-center transition-colors ${
                    isChecked ? 'bg-green-500 border-green-500 text-white' : 'border-[var(--border)]'
                  }`}
                >
                  {isChecked && '✓'}
                </span>
                <div className="flex-1 grid grid-cols-2 items-center min-w-0">
                  <span className="text-right font-medium text-[var(--ink)] text-sm pr-3 truncate">{word.term}</span>
                  <span className="text-left text-[var(--ink-soft)] text-sm pl-3 truncate">{word.translation}</span>
                </div>
              </button>
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
          )
        })}
      </div>

      <p className="text-xs text-[var(--ink-faint)] text-center mb-3">
        {checked.size} of {batch.length} ticked
      </p>

      <button onClick={() => onDone(Array.from(checked))} className="btn-primary w-full py-3">
        Continue →
      </button>
    </div>
  )
}
