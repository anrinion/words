import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { parseDelimited } from '@shared/parser'
import type { ImportAdapter } from './types'
import type { ParseResult } from '@shared/types'

function TextPasteDialog({
  onDone,
  onCancel,
}: {
  onDone: (result: ParseResult) => void
  onCancel: () => void
}) {
  const [text, setText] = useState('')

  function handleSubmit() {
    const result = parseDelimited(text)
    onDone(result)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-[var(--surface)] rounded-2xl w-full max-w-lg p-5 shadow-xl" style={{ border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-[var(--ink)]">Paste word list</h2>
          <button type="button" onClick={onCancel} className="text-[var(--ink-faint)] hover:text-[var(--ink)] text-xl">×</button>
        </div>
        <p className="text-xs text-[var(--ink-soft)] mb-2">
          One word per line. Separate term and translation with a tab, semicolon, pipe, or " - ".
          Optional columns: levelTag, categoryTag.
        </p>
        <form onSubmit={(e) => { e.preventDefault(); handleSubmit() }}>
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"Haus\thouse\nAuto\tcar"}
            rows={10}
            className="input font-mono text-xs mb-4 resize-none"
            onKeyDown={(e) => {
              // Ctrl/Cmd+Enter submits; plain Enter adds a newline (normal textarea behaviour)
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && text.trim()) handleSubmit()
            }}
          />
          <div className="flex gap-2">
            <button type="button" onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={!text.trim()} className="btn-primary flex-1">
              Import
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function mountDialog(): Promise<ParseResult | null> {
  return new Promise((resolve) => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    function cleanup(result: ParseResult | null) {
      root.unmount()
      container.remove()
      resolve(result)
    }

    root.render(
      <TextPasteDialog onDone={(r) => cleanup(r)} onCancel={() => cleanup(null)} />,
    )
  })
}

export const textPasteAdapter: ImportAdapter = {
  id: 'text-paste',
  name: 'Paste text',
  description: 'Paste a list of words separated by tabs, semicolons, pipes, or dashes',
  run: mountDialog,
}
