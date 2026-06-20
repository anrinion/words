import { useState, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import type { ImportAdapter } from './types'
import type { ParseResult, ParsedWord } from '@shared/types'

function CameraDialog({
  photoSrc,
  onDone,
  onCancel,
}: {
  photoSrc: string
  onDone: (result: ParseResult) => void
  onCancel: () => void
}) {
  const [term, setTerm] = useState('')
  const [translation, setTranslation] = useState('')
  const [words, setWords] = useState<ParsedWord[]>([])
  const termRef = useRef<HTMLInputElement>(null)

  function addWord() {
    if (!term.trim() || !translation.trim()) return
    setWords((prev) => [...prev, { term: term.trim(), translation: translation.trim() }])
    setTerm('')
    setTranslation('')
    termRef.current?.focus()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg p-5 shadow-xl max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-slate-800">Add from photo</h2>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
        </div>

        {/* Photo reference */}
        <img src={photoSrc} alt="Captured" className="w-full rounded-lg mb-4 max-h-48 object-contain bg-slate-100" />

        <p className="text-xs text-slate-500 mb-3">
          Type the words you see in the photo. Add as many as you like, then tap "Done".
        </p>

        {/* Captured words so far */}
        {words.length > 0 && (
          <div className="mb-3 space-y-1">
            {words.map((w, i) => (
              <div key={i} className="flex items-center gap-2 text-sm bg-slate-50 rounded px-2 py-1">
                <span className="font-medium text-slate-700">{w.term}</span>
                <span className="text-slate-400">→</span>
                <span className="text-slate-600">{w.translation}</span>
                <button
                  onClick={() => setWords((prev) => prev.filter((_, j) => j !== i))}
                  className="ml-auto text-slate-300 hover:text-red-400"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input row */}
        <div className="flex gap-2 mb-2">
          <input
            ref={termRef}
            autoFocus
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Term"
            className="input flex-1"
          />
          <input
            value={translation}
            onChange={(e) => setTranslation(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addWord()}
            placeholder="Translation"
            className="input flex-1"
          />
          <button onClick={addWord} className="btn-primary px-3">+</button>
        </div>

        <div className="flex gap-2 mt-4">
          <button onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
          <button
            disabled={words.length === 0}
            onClick={() => onDone({ words, rejected: [] })}
            className="btn-primary flex-1"
          >
            Done ({words.length})
          </button>
        </div>
      </div>
    </div>
  )
}

function capturePhoto(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.setAttribute('capture', 'environment')
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) { resolve(null); return }
      const url = URL.createObjectURL(file)
      resolve(url)
    }
    input.oncancel = () => resolve(null)
    input.click()
  })
}

export const cameraAdapter: ImportAdapter = {
  id: 'camera',
  name: 'Scan with camera',
  description: 'Take a photo and manually enter the words you see',
  run: async () => {
    const photoSrc = await capturePhoto()
    if (!photoSrc) return null
    const resolvedSrc: string = photoSrc

    return new Promise<ParseResult | null>((resolve) => {
      const container = document.createElement('div')
      document.body.appendChild(container)
      const root = createRoot(container)

      function cleanup(result: ParseResult | null) {
        root.unmount()
        container.remove()
        URL.revokeObjectURL(resolvedSrc)
        resolve(result)
      }

      root.render(
        <CameraDialog
          photoSrc={resolvedSrc}
          onDone={(r) => cleanup(r)}
          onCancel={() => cleanup(null)}
        />,
      )
    })
  },
}
