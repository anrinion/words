import { useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import type { ImportAdapter } from './types'
import type { ParseResult, ParsedWord } from '@shared/types'
import { parseDelimited } from '@shared/parser'

// ── Column-aware TSV parsing ──────────────────────────────────────────────────

interface TsvWord {
  left: number
  top: number
  text: string
  lineKey: string
  conf: number
}

function parseTsvWords(tsv: string): TsvWord[] {
  return tsv
    .split('\n')
    .slice(1) // skip header row
    .flatMap((line) => {
      const p = line.split('\t')
      if (p[0] !== '5') return [] // level 5 = word
      const conf = parseInt(p[10])
      const text = (p[11] ?? '').trim()
      if (!text || conf <= 15) return []
      return [{
        left: parseInt(p[6]),
        top: parseInt(p[7]),
        text,
        lineKey: `${p[2]}-${p[3]}-${p[4]}`, // block-par-line
        conf,
      }]
    })
}

function extractPairsFromTsv(tsv: string): ParsedWord[] {
  const words = parseTsvWords(tsv)
  if (words.length < 4) return []

  // Find the largest horizontal gap between distinct left-edge x positions.
  // For a two-column table this gap sits between the two columns.
  const xs = [...new Set(words.map((w) => w.left))].sort((a, b) => a - b)
  const textSpan = (xs[xs.length - 1] ?? 0) - (xs[0] ?? 0)

  let maxGap = 0
  let splitX = 0
  for (let i = 1; i < xs.length; i++) {
    const gap = xs[i] - xs[i - 1]
    if (gap > maxGap) {
      maxGap = gap
      splitX = (xs[i] + xs[i - 1]) / 2
    }
  }

  // Require the gap to be at least 10% of total text span to rule out noise
  if (splitX === 0 || maxGap < textSpan * 0.1) return []

  // Group words into lines, splitting each line into left/right columns
  const lines = new Map<string, { left: TsvWord[]; right: TsvWord[]; top: number }>()
  for (const w of words) {
    if (!lines.has(w.lineKey)) lines.set(w.lineKey, { left: [], right: [], top: w.top })
    const ln = lines.get(w.lineKey)!
    ;(w.left < splitX ? ln.left : ln.right).push(w)
  }

  return [...lines.values()]
    .sort((a, b) => a.top - b.top)
    .filter((ln) => ln.left.length > 0 && ln.right.length > 0)
    .map((ln) => ({
      term: ln.left.sort((a, b) => a.left - b.left).map((w) => w.text).join(' '),
      translation: ln.right.sort((a, b) => a.left - b.left).map((w) => w.text).join(' '),
    }))
}

// ── OCR runner ────────────────────────────────────────────────────────────────

async function runOCR(
  src: string,
  onProgress: (msg: string, pct: number) => void,
): Promise<{ pairs: ParsedWord[]; rawText: string }> {
  // Dynamic import keeps tesseract.js out of the initial bundle (~10MB)
  const { default: Tesseract } = await import('tesseract.js')

  const result = await Tesseract.recognize(src, 'eng', {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'loading tesseract core') onProgress('Loading OCR engine…', m.progress * 25)
      else if (m.status === 'loading language traineddata') onProgress('Loading language data…', 25 + m.progress * 25)
      else if (m.status === 'recognizing text') onProgress('Recognizing text…', 50 + m.progress * 50)
    },
  })

  const rawText: string = result.data.text ?? ''
  const tsv: string = (result.data as any).tsv ?? ''

  // Try TSV column detection first (works best for two-column tables)
  const pairs = extractPairsFromTsv(tsv)
  if (pairs.length > 0) return { pairs, rawText }

  // Fall back to delimiter-aware text parsing
  return { pairs: parseDelimited(rawText).words, rawText }
}

// ── Dialog ────────────────────────────────────────────────────────────────────

type Phase =
  | { name: 'scanning'; msg: string; pct: number }
  | { name: 'review'; rawText: string }
  | { name: 'error'; message: string }

function CameraDialog({
  photoSrc,
  onDone,
  onCancel,
}: {
  photoSrc: string
  onDone: (result: ParseResult) => void
  onCancel: () => void
}) {
  const [phase, setPhase] = useState<Phase>({ name: 'scanning', msg: 'Starting…', pct: 0 })
  const [pairs, setPairs] = useState<ParsedWord[]>([])
  const [showRaw, setShowRaw] = useState(false)

  useEffect(() => {
    runOCR(
      photoSrc,
      (msg, pct) => setPhase({ name: 'scanning', msg, pct }),
    )
      .then(({ pairs, rawText }) => {
        setPairs(pairs)
        setPhase({ name: 'review', rawText })
      })
      .catch((e) => setPhase({ name: 'error', message: String(e) }))
  }, [photoSrc])

  function removePair(i: number) {
    setPairs((prev) => prev.filter((_, j) => j !== i))
  }

  function updatePair(i: number, field: 'term' | 'translation', value: string) {
    setPairs((prev) => prev.map((p, j) => (j === i ? { ...p, [field]: value } : p)))
  }

  function addPair() {
    setPairs((prev) => [...prev, { term: '', translation: '' }])
  }

  const validPairs = pairs.filter((p) => p.term.trim() && p.translation.trim())

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
      <div
        className="bg-[var(--surface)] rounded-2xl w-full max-w-lg shadow-xl max-h-[90dvh] flex flex-col"
        style={{ border: '1px solid var(--border)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="font-semibold text-[var(--ink)]">Scan word list</h2>
          <button onClick={onCancel} className="text-[var(--ink-faint)] hover:text-[var(--ink)] text-xl leading-none">×</button>
        </div>

        {/* Photo thumbnail */}
        <div className="px-5 pt-4 shrink-0">
          <img
            src={photoSrc}
            alt="Captured"
            className="w-full rounded-lg max-h-32 object-contain bg-[var(--surface2)]"
          />
        </div>

        {/* Scanning state */}
        {phase.name === 'scanning' && (
          <div className="flex flex-col items-center p-8 gap-4">
            <div className="w-full bg-[var(--surface2)] rounded-full h-2 overflow-hidden">
              <div
                className="h-2 rounded-full transition-all duration-300"
                style={{ width: `${phase.pct}%`, background: 'var(--pop)' }}
              />
            </div>
            <p className="text-sm text-[var(--ink-soft)]">{phase.msg}</p>
          </div>
        )}

        {/* Error state */}
        {phase.name === 'error' && (
          <div className="p-6 text-center">
            <p className="text-red-500 text-sm mb-4">Recognition failed: {phase.message}</p>
            <button onClick={onCancel} className="btn-secondary">Close</button>
          </div>
        )}

        {/* Review state */}
        {phase.name === 'review' && (
          <>
            <div className="overflow-y-auto flex-1 px-5 py-3">
              {pairs.length === 0 ? (
                <p className="text-sm text-[var(--ink-faint)] text-center py-6">
                  No word pairs detected. The photo may not contain a clear two-column list — try better lighting or a closer shot.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {pairs.map((pair, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="flex-1 grid grid-cols-2 gap-1.5 min-w-0">
                        <input
                          value={pair.term}
                          onChange={(e) => updatePair(i, 'term', e.target.value)}
                          className="input text-sm text-right"
                          placeholder="Term"
                          autoCapitalize="none"
                          autoCorrect="off"
                        />
                        <input
                          value={pair.translation}
                          onChange={(e) => updatePair(i, 'translation', e.target.value)}
                          className="input text-sm"
                          placeholder="Translation"
                          autoCapitalize="none"
                          autoCorrect="off"
                        />
                      </div>
                      <button
                        onClick={() => removePair(i)}
                        className="shrink-0 text-[var(--ink-faint)] hover:text-red-400 text-sm leading-none"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={addPair}
                className="mt-3 text-xs text-[var(--ink-soft)] hover:text-[var(--ink)]"
              >
                + Add row
              </button>

              {/* Raw OCR text toggle (escape hatch) */}
              {phase.rawText && (
                <div className="mt-4">
                  <button
                    onClick={() => setShowRaw((v) => !v)}
                    className="text-xs text-[var(--ink-faint)] hover:text-[var(--ink-soft)]"
                  >
                    {showRaw ? '▲' : '▼'} Raw OCR text
                  </button>
                  {showRaw && (
                    <pre className="mt-2 text-xs text-[var(--ink-soft)] bg-[var(--surface2)] rounded p-3 overflow-x-auto whitespace-pre-wrap font-mono" style={{ border: '1px solid var(--border)' }}>
                      {phase.rawText}
                    </pre>
                  )}
                </div>
              )}
            </div>

            <div className="p-5 flex gap-2 shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
              <button onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
              <button
                disabled={validPairs.length === 0}
                onClick={() => onDone({ words: validPairs, rejected: [] })}
                className="btn-primary flex-1"
              >
                Import {validPairs.length} word{validPairs.length !== 1 ? 's' : ''}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Photo capture ─────────────────────────────────────────────────────────────

function capturePhoto(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.setAttribute('capture', 'environment')
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) { resolve(null); return }
      resolve(URL.createObjectURL(file))
    }
    input.oncancel = () => resolve(null)
    input.click()
  })
}

// ── Adapter ───────────────────────────────────────────────────────────────────

export const cameraAdapter: ImportAdapter = {
  id: 'camera',
  name: 'Scan with camera',
  description: 'Photograph a word list — OCR extracts the pairs automatically',
  run: async () => {
    const photoSrc = await capturePhoto()
    if (!photoSrc) return null

    return new Promise<ParseResult | null>((resolve) => {
      const container = document.createElement('div')
      document.body.appendChild(container)
      const root = createRoot(container)

      function cleanup(result: ParseResult | null) {
        root.unmount()
        container.remove()
        URL.revokeObjectURL(photoSrc!)
        resolve(result)
      }

      root.render(
        <CameraDialog
          photoSrc={photoSrc}
          onDone={(r) => cleanup(r)}
          onCancel={() => cleanup(null)}
        />,
      )
    })
  },
}
