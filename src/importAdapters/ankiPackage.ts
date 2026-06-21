import type { ImportAdapter } from './types'
import type { ParseResult, ParsedWord } from '@shared/types'

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

async function parseApkg(buffer: ArrayBuffer): Promise<ParseResult> {
  // Lazy-load heavy dependencies
  const [{ default: JSZip }, { default: initSqlJs }] = await Promise.all([
    import('jszip'),
    import('sql.js'),
  ])

  const zip = await JSZip.loadAsync(buffer)

  // Anki packages contain collection.anki2 or collection.anki21
  const dbFile =
    zip.file('collection.anki21') ?? zip.file('collection.anki2')

  if (!dbFile) {
    return {
      words: [],
      rejected: [{ line: '(file)', reason: 'No collection database found in .apkg' }],
    }
  }

  const dbBytes = await dbFile.async('arraybuffer')
  const SQL = await initSqlJs({
    locateFile: () => '/sql-wasm.wasm',
  })

  const db = new SQL.Database(new Uint8Array(dbBytes))

  // Query notes: flds column is fields separated by \x1f (unit separator)
  const result = db.exec('SELECT flds FROM notes LIMIT 2000')
  db.close()

  if (!result[0]) return { words: [], rejected: [] }

  const words: ParsedWord[] = []
  const rejected: { line: string; reason: string }[] = []

  for (const row of result[0].values) {
    const flds = row[0] as string
    const fields = flds.split('\x1f')
    const term = fields[0]?.trim()
    const translation = fields[1]?.trim()

    if (!term || !translation) {
      rejected.push({ line: flds, reason: 'Missing term or translation field' })
      continue
    }
    words.push({ term, translation })
  }

  return { words, rejected }
}

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
