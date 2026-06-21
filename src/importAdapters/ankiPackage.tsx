import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { ImportAdapter } from './types'
import type { ParseResult, ParsedWord } from '@shared/types'
import { storeAudio } from '../lib/audioStore'

// ── Helpers ───────────────────────────────────────────────────────────────────

function stripAnkiMarkup(s: string): string {
  return s
    .replace(/\[sound:[^\]]*\]/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
}

function extractSoundFilename(fieldValue: string): string | null {
  return fieldValue.match(/\[sound:([^\]]+)\]/)?.[1] ?? null
}

function mimeForFilename(filename: string): string {
  if (filename.endsWith('.mp3')) return 'audio/mpeg'
  if (filename.endsWith('.ogg')) return 'audio/ogg'
  if (filename.endsWith('.m4a')) return 'audio/mp4'
  if (filename.endsWith('.wav')) return 'audio/wav'
  return 'audio/mpeg'
}

// ── Field mapping types ───────────────────────────────────────────────────────

interface FieldInfo {
  name: string
  samples: string[]
  hasAudio: boolean
  sampleAudio?: Blob
}

interface FieldMapping {
  termIndex: number
  translationIndex: number
  exampleIndex: number        // -1 = not mapped
  exampleTranslationIndex: number
  audioWordIndex: number
  audioExampleIndex: number
}

function detectDefaults(fields: FieldInfo[]): FieldMapping {
  const names = fields.map((f) => f.name.toLowerCase())

  const find = (...patterns: string[]): number => {
    for (const p of patterns) {
      const i = names.findIndex((n) => n.includes(p))
      if (i !== -1) return i
    }
    return -1
  }

  const termIndex = Math.max(0, find('term', 'word', 'front', 'de_word', 'vocab', 'german', 'target'))
  const translationIndex = (() => {
    const i = find('translation', 'meaning', 'definition', 'en_word', 'english', 'back', 'native')
    return i !== -1 ? i : termIndex === 0 ? 1 : 0
  })()
  const exampleIndex = find('de_sentence', 'sentence', 'example', 'context', 'usage')
  const exampleTranslationIndex = find('en_sentence', 'english_sentence', 'example_translation', 'sentence_translation')

  const audioFields = fields.map((f, i) => ({ i, name: names[i], isAudio: f.hasAudio })).filter((f) => f.isAudio)
  const audioWordIndex =
    audioFields.find((f) => !f.name.includes('sentence') && !f.name.includes('example'))?.i ??
    audioFields[0]?.i ??
    -1
  const audioExampleIndex =
    audioFields.find((f) => (f.name.includes('sentence') || f.name.includes('example')) && f.i !== audioWordIndex)?.i ??
    audioFields.find((f) => f.i !== audioWordIndex)?.i ??
    -1

  return { termIndex, translationIndex, exampleIndex, exampleTranslationIndex, audioWordIndex, audioExampleIndex }
}

// ── Field mapping modal ───────────────────────────────────────────────────────

const MAPPING_TARGETS = [
  { key: 'termIndex' as const, label: 'Term', required: true },
  { key: 'translationIndex' as const, label: 'Translation', required: true },
  { key: 'exampleIndex' as const, label: 'Example sentence', required: false },
  { key: 'exampleTranslationIndex' as const, label: 'Example translation', required: false },
  { key: 'audioWordIndex' as const, label: 'Word audio', required: false },
  { key: 'audioExampleIndex' as const, label: 'Sentence audio', required: false },
]

function playBlob(blob: Blob) {
  const url = URL.createObjectURL(blob)
  const audio = new Audio(url)
  audio.onended = () => URL.revokeObjectURL(url)
  audio.onerror = () => URL.revokeObjectURL(url)
  audio.play()
}

function FieldMappingModal({
  fields,
  noteCount,
  onConfirm,
  onCancel,
}: {
  fields: FieldInfo[]
  noteCount: number
  onConfirm: (mapping: FieldMapping) => void
  onCancel: () => void
}) {
  const [mapping, setMapping] = useState<FieldMapping>(() => detectDefaults(fields))

  const isValid = mapping.termIndex >= 0 && mapping.translationIndex >= 0

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl flex flex-col max-h-[90vh]">
        <div className="p-5 border-b border-slate-100 shrink-0">
          <h2 className="font-semibold text-slate-800">Map Anki fields</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {noteCount} notes · {fields.length} fields — assign each to a role
          </p>
        </div>

        <div className="overflow-y-auto p-5 space-y-4 flex-1">
          {MAPPING_TARGETS.map(({ key, label, required }) => {
            const selectedIdx = mapping[key]
            const selectedField = selectedIdx >= 0 ? fields[selectedIdx] : null
            return (
              <div key={key}>
                <label className="text-xs font-medium text-slate-600 mb-1 block">
                  {label}
                  {required && <span className="text-red-500 ml-0.5">*</span>}
                </label>
                <select
                  className="input text-sm"
                  value={mapping[key]}
                  onChange={(e) => setMapping((m) => ({ ...m, [key]: Number(e.target.value) }))}
                >
                  {!required && <option value="-1">— None —</option>}
                  {fields.map((f, i) => (
                    <option key={i} value={i}>
                      {f.name}
                      {f.hasAudio ? ' 🔊' : ''}
                    </option>
                  ))}
                </select>
                {selectedField?.sampleAudio && (
                  <button
                    type="button"
                    onClick={() => playBlob(selectedField.sampleAudio!)}
                    className="mt-1 text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1"
                  >
                    ▶ Preview audio
                  </button>
                )}
                {selectedField && !selectedField.sampleAudio && selectedField.samples.length > 0 && (
                  <p className="text-xs text-slate-400 mt-1 truncate">
                    e.g. {selectedField.samples.slice(0, 2).join(' · ')}
                  </p>
                )}
              </div>
            )
          })}
        </div>

        <div className="p-5 border-t border-slate-100 flex gap-3 shrink-0">
          <button onClick={onCancel} className="btn-secondary flex-1">
            Cancel
          </button>
          <button
            onClick={() => isValid && onConfirm(mapping)}
            disabled={!isValid}
            className={`btn-primary flex-1 ${!isValid ? 'opacity-40 pointer-events-none' : ''}`}
          >
            Import →
          </button>
        </div>
      </div>
    </div>
  )
}

function promptFieldMapping(fields: FieldInfo[], noteCount: number): Promise<FieldMapping | null> {
  return new Promise((resolve) => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    const cleanup = (result: FieldMapping | null) => {
      root.unmount()
      container.remove()
      resolve(result)
    }

    root.render(
      <FieldMappingModal
        fields={fields}
        noteCount={noteCount}
        onConfirm={cleanup}
        onCancel={() => cleanup(null)}
      />,
    )
  })
}

// ── Core parsing ──────────────────────────────────────────────────────────────

function pickApkgFile(): Promise<ArrayBuffer | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.apkg'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) { resolve(null); return }
      file.arrayBuffer().then(resolve).catch(() => resolve(null))
    }
    input.oncancel = () => resolve(null)
    input.click()
  })
}

async function parseApkg(buffer: ArrayBuffer): Promise<ParseResult | null> {
  const [{ default: JSZip }, { default: initSqlJs }] = await Promise.all([
    import('jszip'),
    import('sql.js'),
  ])

  const zip = await JSZip.loadAsync(buffer)

  const dbFile = zip.file('collection.anki21') ?? zip.file('collection.anki2')
  if (!dbFile) {
    return {
      words: [],
      rejected: [{ line: '(file)', reason: 'No collection database found in .apkg' }],
    }
  }

  const dbBytes = await dbFile.async('arraybuffer')
  const SQL = await initSqlJs({ locateFile: () => '/sql-wasm.wasm' })
  const sqlDb = new SQL.Database(new Uint8Array(dbBytes))

  // Parse models to get field names per model
  const colResult = sqlDb.exec('SELECT models FROM col LIMIT 1')
  const modelsJson = (colResult[0]?.values[0]?.[0] ?? '{}') as string
  const models = JSON.parse(modelsJson) as Record<string, { name: string; flds: { name: string }[] }>

  // Load notes with their model id
  const notesResult = sqlDb.exec('SELECT id, mid, flds FROM notes LIMIT 2000')
  sqlDb.close()

  if (!notesResult[0] || notesResult[0].values.length === 0) {
    return { words: [], rejected: [] }
  }

  const noteRows = notesResult[0].values as [string | number, string | number, string][]

  // Find the dominant model (most notes share it)
  const midCounts = new Map<string, number>()
  for (const [, mid] of noteRows) {
    const m = String(mid)
    midCounts.set(m, (midCounts.get(m) ?? 0) + 1)
  }
  const primaryMid = [...midCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
  const model = models[primaryMid]
  const fieldNames: string[] = model?.flds.map((f) => f.name) ?? []

  // Collect sample values and detect audio fields from first few notes
  const samples: string[][] = Array.from({ length: fieldNames.length }, () => [])
  const audioFieldIndices = new Set<number>()

  for (const [, , flds] of noteRows.slice(0, 10)) {
    const fields = flds.split('\x1f')
    fields.forEach((val, i) => {
      if (i >= fieldNames.length) return
      if (val.includes('[sound:')) audioFieldIndices.add(i)
      const clean = stripAnkiMarkup(val)
      if (clean && samples[i] && !samples[i].includes(clean)) samples[i].push(clean)
    })
  }

  // Build media reverse-map early so we can play sample audio in the modal
  const mediaJson = await zip.file('media')?.async('text') ?? '{}'
  const mediaMap = JSON.parse(mediaJson) as Record<string, string>
  const reverseMedia: Record<string, string> = {}
  for (const [zipEntry, originalName] of Object.entries(mediaMap)) {
    reverseMedia[originalName] = zipEntry
  }

  // Extract one sample audio blob per audio field (for modal preview)
  const sampleAudioBlobs = new Map<number, Blob>()
  for (const audioIdx of audioFieldIndices) {
    for (const [, , flds] of noteRows.slice(0, 20)) {
      const filename = extractSoundFilename(flds.split('\x1f')[audioIdx] ?? '')
      if (!filename) continue
      const zipEntry = reverseMedia[filename]
      const zipFile = zipEntry ? zip.file(zipEntry) : null
      if (!zipFile) continue
      const bytes = await zipFile.async('uint8array')
      sampleAudioBlobs.set(audioIdx, new Blob([bytes.buffer as ArrayBuffer], { type: mimeForFilename(filename) }))
      break
    }
  }

  const fieldInfos: FieldInfo[] = fieldNames.map((name, i) => ({
    name,
    samples: (samples[i] ?? []).slice(0, 3),
    hasAudio: audioFieldIndices.has(i),
    sampleAudio: sampleAudioBlobs.get(i),
  }))

  // Fall back to positional names if model had no field info
  if (fieldInfos.length === 0) {
    const maxFields = Math.max(...noteRows.slice(0, 5).map(([, , f]) => f.split('\x1f').length))
    for (let i = 0; i < maxFields; i++) {
      fieldInfos.push({ name: `Field ${i + 1}`, samples: [], hasAudio: audioFieldIndices.has(i), sampleAudio: sampleAudioBlobs.get(i) })
    }
  }

  const mapping = await promptFieldMapping(fieldInfos, noteRows.length)
  if (!mapping) return null

  // Process notes
  const words: ParsedWord[] = []
  const rejected: { line: string; reason: string }[] = []

  for (const [, , flds] of noteRows) {
    const fields = flds.split('\x1f')

    const term = stripAnkiMarkup(fields[mapping.termIndex] ?? '')
    const translation = stripAnkiMarkup(fields[mapping.translationIndex] ?? '')

    if (!term || !translation) {
      rejected.push({ line: flds.slice(0, 80), reason: 'Missing term or translation' })
      continue
    }

    const wordId = crypto.randomUUID()

    const example =
      mapping.exampleIndex >= 0 ? stripAnkiMarkup(fields[mapping.exampleIndex] ?? '') || undefined : undefined
    const exampleTranslation =
      mapping.exampleTranslationIndex >= 0
        ? stripAnkiMarkup(fields[mapping.exampleTranslationIndex] ?? '') || undefined
        : undefined

    // Extract and store audio (async, fire-and-forget per word; awaited below)
    const audioJobs: Promise<void>[] = []

    if (mapping.audioWordIndex >= 0) {
      const filename = extractSoundFilename(fields[mapping.audioWordIndex] ?? '')
      if (filename) {
        const zipEntry = reverseMedia[filename]
        const zipFile = zipEntry ? zip.file(zipEntry) : null
        if (zipFile) {
          audioJobs.push(
            zipFile.async('uint8array').then((bytes) =>
              storeAudio(wordId, 'word', new Blob([bytes.buffer as ArrayBuffer], { type: mimeForFilename(filename) })),
            ),
          )
        }
      }
    }

    if (mapping.audioExampleIndex >= 0) {
      const filename = extractSoundFilename(fields[mapping.audioExampleIndex] ?? '')
      if (filename) {
        const zipEntry = reverseMedia[filename]
        const zipFile = zipEntry ? zip.file(zipEntry) : null
        if (zipFile) {
          audioJobs.push(
            zipFile.async('uint8array').then((bytes) =>
              storeAudio(wordId, 'example', new Blob([bytes.buffer as ArrayBuffer], { type: mimeForFilename(filename) })),
            ),
          )
        }
      }
    }

    await Promise.all(audioJobs)

    words.push({ id: wordId, term, translation, example, exampleTranslation })
  }

  return { words, rejected }
}

// ── Adapter ───────────────────────────────────────────────────────────────────

export const ankiPackageAdapter: ImportAdapter = {
  id: 'anki-package',
  name: 'Anki .apkg',
  description: 'Import from an Anki package file (.apkg)',
  run: async () => {
    const buffer = await pickApkgFile()
    if (buffer === null) return null
    return parseApkg(buffer)
  },
}
