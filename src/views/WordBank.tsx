import { useEffect, useState, useRef } from 'react'
import { useOutletContext } from 'react-router-dom'
import { wordsApi } from '../api/words'
import type { Deck, Word, ParsedWord, ImportResult } from '@shared/types'
import AudioButton from '../components/AudioButton'
import { textPasteAdapter } from '../importAdapters/textPaste'
import { fileAdapter } from '../importAdapters/file'
import { ankiPackageAdapter } from '../importAdapters/ankiPackage'
import { cameraAdapter } from '../importAdapters/camera'
import type { ImportAdapter } from '../importAdapters/types'

const ADAPTERS: ImportAdapter[] = [
  textPasteAdapter,
  fileAdapter,
  ankiPackageAdapter,
  cameraAdapter,
]

type Filter = { search: string; levelTag: string; categoryTag: string; status: '' | 'weak' | 'mastered' }

export default function WordBank() {
  const deck = useOutletContext<Deck>()
  const [words, setWords] = useState<Word[]>([])
  const [filter, setFilter] = useState<Filter>({ search: '', levelTag: '', categoryTag: '', status: '' })
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [editWord, setEditWord] = useState<Word | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [loading, setLoading] = useState(true)

  async function load() {
    const params: Record<string, string> = {}
    if (filter.search) params.search = filter.search
    if (filter.levelTag) params.levelTag = filter.levelTag
    if (filter.categoryTag) params.categoryTag = filter.categoryTag
    if (filter.status === 'weak') params.weak = '1'
    if (filter.status === 'mastered') params.mastered = '1'
    const data = await wordsApi.list(deck.id, params)
    setWords(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [deck.id, filter])

  async function runAdapter(adapter: ImportAdapter) {
    setShowImport(false)
    const result = await adapter.run()
    if (!result) return
    const importRes = await wordsApi.import(deck.id, { words: result.words, rejected: result.rejected })
    setImportResult(importRes)
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this word?')) return
    await wordsApi.remove(deck.id, id)
    setWords((prev) => prev.filter((w) => w.id !== id))
  }

  async function handleDeleteAll() {
    if (!confirm(`Delete all ${words.length} words? This cannot be undone.`)) return
    await wordsApi.deleteAll(deck.id)
    setWords([])
  }

  async function handleClearWeak(id: string) {
    await wordsApi.update(deck.id, id, { weak: 0 })
    setWords((prev) => prev.map((w) => w.id === id ? { ...w, weak: 0 } : w))
  }

  async function handleSave(id: string, body: Partial<ParsedWord>) {
    await wordsApi.update(deck.id, id, body)
    setEditWord(null)
    load()
  }

  return (
    <div className="p-4">
      {/* Search + filter bar */}
      <div className="flex gap-2 mb-3">
        <input
          value={filter.search}
          onChange={(e) => setFilter((f) => ({ ...f, search: e.target.value }))}
          placeholder="Search words…"
          className="input flex-1"
        />
        <select
          value={filter.status}
          onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value as Filter['status'] }))}
          className="input w-auto"
        >
          <option value="">All</option>
          <option value="weak">Weak</option>
          <option value="mastered">Mastered</option>
        </select>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setShowImport(true)} className="btn-primary text-sm flex-1">
          Import
        </button>
        <button
          onClick={() => setEditWord({ id: '', deckId: deck.id, term: '', translation: '', levelTag: null, categoryTag: null, notes: null, example: null, exampleTranslation: null, createdAt: 0, timesSeenInExam: 0, timesCorrectInExam: 0, timesWrongInExam: 0, streak: 0, weak: 0, lastSeenAt: null })}
          className="btn-secondary text-sm flex-1"
        >
          + Add word
        </button>
        {words.length > 0 && (
          <button onClick={handleDeleteAll} className="text-red-400 hover:text-red-600 text-sm px-2">
            Delete all
          </button>
        )}
      </div>

      {/* Import result banner */}
      {importResult && (
        <ImportResultBanner result={importResult} onDismiss={() => setImportResult(null)} />
      )}

      {/* Empty states */}
      {!loading && words.length === 0 && (
        <div className="text-center py-16 text-slate-500">
          <p className="text-4xl mb-3">📝</p>
          <p className="font-medium">No words yet</p>
          <p className="text-sm mt-1">Import a word list or add words manually to get started.</p>
        </div>
      )}

      {/* Word list */}
      <div className="space-y-2">
        {words.map((word) => (
          <div
            key={word.id}
            className="bg-white border border-slate-200 rounded-lg px-3 py-2.5 flex items-start gap-2"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <AudioButton wordId={word.id} type="word" />
                <span className="font-medium text-slate-800 text-sm">{word.term}</span>
                {word.weak === 1 && (
                  <span className="text-xs bg-red-100 text-red-600 px-1.5 rounded-full">weak</span>
                )}
                {word.streak >= 2 && (
                  <span className="text-xs bg-green-100 text-green-600 px-1.5 rounded-full">
                    ✓{word.streak}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{word.translation}</p>
              {word.example && (
                <div className="flex items-center gap-1 mt-0.5">
                  <AudioButton wordId={word.id} type="example" />
                  <p className="text-xs text-slate-400 italic truncate">{word.example}</p>
                </div>
              )}
              {(word.levelTag || word.categoryTag) && (
                <div className="flex gap-1 mt-1 flex-wrap">
                  {word.levelTag && (
                    <span className="text-xs bg-slate-100 text-slate-500 px-1.5 rounded">{word.levelTag}</span>
                  )}
                  {word.categoryTag && (
                    <span className="text-xs bg-slate-100 text-slate-500 px-1.5 rounded">{word.categoryTag}</span>
                  )}
                </div>
              )}
            </div>
            <div className="flex gap-1 shrink-0">
              {word.weak === 1 && (
                <button onClick={() => handleClearWeak(word.id)} className="text-orange-400 hover:text-orange-600 text-xs p-1" title="Remove from weak">
                  ✓
                </button>
              )}
              <button onClick={() => setEditWord(word)} className="text-slate-400 hover:text-slate-600 text-xs p-1">
                Edit
              </button>
              <button onClick={() => handleDelete(word.id)} className="text-red-300 hover:text-red-500 text-xs p-1">
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Import picker modal */}
      {showImport && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-800">Import words</h2>
              <button onClick={() => setShowImport(false)} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
            </div>
            <div className="space-y-2">
              {ADAPTERS.map((adapter) => (
                <button
                  key={adapter.id}
                  onClick={() => runAdapter(adapter)}
                  className="w-full text-left bg-slate-50 hover:bg-slate-100 rounded-lg px-4 py-3 transition-colors"
                >
                  <p className="font-medium text-slate-800 text-sm">{adapter.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{adapter.description}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Edit/add word modal */}
      {editWord !== null && (
        <EditWordModal
          word={editWord}
          isNew={editWord.id === ''}
          onSave={async (body) => {
            if (editWord.id === '') {
              await wordsApi.create(deck.id, body as ParsedWord)
              setEditWord(null)
              load()
            } else {
              handleSave(editWord.id, body)
            }
          }}
          onCancel={() => setEditWord(null)}
        />
      )}
    </div>
  )
}

function ImportResultBanner({ result, onDismiss }: { result: ImportResult; onDismiss: () => void }) {
  const [showDuplicates, setShowDuplicates] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3 text-sm text-green-800">
      <p>
        Imported <strong>{result.imported}</strong> words
        {result.duplicates > 0 && (
          <>
            {', '}
            <button
              onClick={() => setShowDuplicates((v) => !v)}
              className="underline font-medium"
            >
              {result.duplicates} duplicates skipped {showDuplicates ? '▲' : '▼'}
            </button>
          </>
        )}
        {result.rejected.length > 0 && `, ${result.rejected.length} lines rejected`}
      </p>

      {showDuplicates && (
        <div
          ref={listRef}
          className="mt-2 max-h-40 overflow-y-auto bg-white border border-green-100 rounded p-2 space-y-0.5"
        >
          {result.skippedDuplicates.map((term, i) => (
            <p key={i} className="text-xs text-slate-500 font-mono truncate">{term}</p>
          ))}
        </div>
      )}

      <button onClick={onDismiss} className="text-green-600 underline text-xs mt-1.5 block">
        Dismiss
      </button>
    </div>
  )
}

function EditWordModal({
  word,
  isNew,
  onSave,
  onCancel,
}: {
  word: Word
  isNew: boolean
  onSave: (body: Partial<ParsedWord>) => void
  onCancel: () => void
}) {
  const [term, setTerm] = useState(word.term)
  const [translation, setTranslation] = useState(word.translation)
  const [example, setExample] = useState(word.example ?? '')
  const [exampleTranslation, setExampleTranslation] = useState(word.exampleTranslation ?? '')
  const [levelTag, setLevelTag] = useState(word.levelTag ?? '')
  const [categoryTag, setCategoryTag] = useState(word.categoryTag ?? '')
  const [notes, setNotes] = useState(word.notes ?? '')

  function submit() {
    if (term.trim() && translation.trim()) {
      onSave({
        term,
        translation,
        example: example || undefined,
        exampleTranslation: exampleTranslation || undefined,
        levelTag: levelTag || undefined,
        categoryTag: categoryTag || undefined,
        notes: notes || undefined,
      })
    }
  }

  function onEnter(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); submit() }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 shrink-0">
          <h2 className="font-semibold text-slate-800">{isNew ? 'Add word' : 'Edit word'}</h2>
          <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
        </div>
        <div className="overflow-y-auto p-5 space-y-3 flex-1">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Term</label>
            <input autoFocus value={term} onChange={(e) => setTerm(e.target.value)} onKeyDown={onEnter} className="input" />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Translation</label>
            <input value={translation} onChange={(e) => setTranslation(e.target.value)} onKeyDown={onEnter} className="input" />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Example sentence</label>
            <input value={example} onChange={(e) => setExample(e.target.value)} onKeyDown={onEnter} className="input" placeholder="Optional" />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Example translation</label>
            <input value={exampleTranslation} onChange={(e) => setExampleTranslation(e.target.value)} onKeyDown={onEnter} className="input" placeholder="Optional" />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-slate-500 mb-1 block">Level tag</label>
              <input value={levelTag} onChange={(e) => setLevelTag(e.target.value)} onKeyDown={onEnter} placeholder="e.g. B1" className="input" />
            </div>
            <div className="flex-1">
              <label className="text-xs text-slate-500 mb-1 block">Category</label>
              <input value={categoryTag} onChange={(e) => setCategoryTag(e.target.value)} onKeyDown={onEnter} placeholder="e.g. work" className="input" />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Notes</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} onKeyDown={onEnter} className="input" />
          </div>
        </div>
        <div className="p-5 border-t border-slate-100 shrink-0">
          <button type="button" onClick={submit} className={`btn-primary w-full ${!term.trim() || !translation.trim() ? 'opacity-40 pointer-events-none' : ''}`}>
            {isNew ? 'Add' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
