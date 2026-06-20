import type { ParsedWord, ParseResult } from './types'

const ANNOTATION_RE = /,\s*-[a-zA-ZäöüÄÖÜß\(\)]+\s*$/

function stripAnnotation(value: string): { clean: string; annotation: string | null } {
  const match = value.match(ANNOTATION_RE)
  if (!match) return { clean: value.trim(), annotation: null }
  return {
    clean: value.slice(0, match.index).trim(),
    annotation: match[0].trim(),
  }
}

function detectDelimiter(sample: string): string {
  const candidates = ['\t', ';', '|', ' - ', ',']
  for (const delim of candidates) {
    if (sample.includes(delim)) return delim
  }
  return '\t'
}

const HEADER_FIELDS = ['term', 'translation', 'leveltag', 'categorytag', 'notes']

function isHeaderRow(parts: string[]): boolean {
  return parts.some((p) => HEADER_FIELDS.includes(p.toLowerCase().trim()))
}

export function parseDelimited(raw: string): ParseResult {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length === 0) return { words: [], rejected: [] }

  const delim = detectDelimiter(lines[0])
  let startIdx = 0

  // Detect and skip header row
  const firstParts = lines[0].split(delim)
  if (isHeaderRow(firstParts)) startIdx = 1

  const words: ParsedWord[] = []
  const rejected: { line: string; reason: string }[] = []

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i]
    const parts = line.split(delim).map((p) => p.trim())

    if (parts.length < 2 || !parts[0] || !parts[1]) {
      rejected.push({ line, reason: 'Missing term or translation' })
      continue
    }

    const { clean: term, annotation } = stripAnnotation(parts[0])
    const translation = parts[1]
    const levelTag = parts[2] || undefined
    const categoryTag = parts[3] || undefined
    const existingNotes = parts[4] || undefined

    const notes = [existingNotes, annotation ? `orig: ${parts[0]}` : undefined]
      .filter(Boolean)
      .join(' | ') || undefined

    words.push({ term, translation, levelTag, categoryTag, notes })
  }

  return { words, rejected }
}
