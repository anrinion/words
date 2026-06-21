import type { ToleranceBand } from './types'

export const DEFAULT_TOLERANCE_BANDS: ToleranceBand[] = [
  { maxLen: 4, tolerance: 0 },
  { maxLen: 7, tolerance: 1 },
  { maxLen: Infinity, tolerance: 2 },
]

export function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  )
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1]
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
      }
    }
  }
  return dp[m][n]
}

export function toleranceFor(len: number, bands: ToleranceBand[] = DEFAULT_TOLERANCE_BANDS): number {
  for (const band of bands) {
    if (len <= band.maxLen) return band.tolerance
  }
  return bands[bands.length - 1].tolerance
}

export function matches(
  input: string,
  term: string,
  bands: ToleranceBand[] = DEFAULT_TOLERANCE_BANDS,
): boolean {
  const a = input.trim().toLowerCase()
  const b = term.trim().toLowerCase()
  if (a === b) return true
  const tol = toleranceFor(b.length, bands)
  if (tol === 0) return false
  return levenshtein(a, b) <= tol
}

// If input is a single word and term contains multiple tokens (e.g. "das Haus, -ä, er"),
// accept if the input fuzzy-matches any individual token.
export function matchesAnyToken(
  input: string,
  term: string,
  bands: ToleranceBand[] = DEFAULT_TOLERANCE_BANDS,
): boolean {
  const trimmed = input.trim()
  if (!trimmed.includes(' ')) {
    const tokens = term.split(/[\s,;]+/).map((t) => t.replace(/^-/, '').trim()).filter(Boolean)
    if (tokens.length > 1) return tokens.some((token) => matches(trimmed, token, bands))
  }
  return matches(trimmed, term, bands)
}

export function gradeLabel(
  scorePct: number,
  gradeBands: { minScore: number; label: string }[],
): string {
  const sorted = [...gradeBands].sort((a, b) => b.minScore - a.minScore)
  for (const band of sorted) {
    if (scorePct >= band.minScore) return band.label
  }
  return sorted[sorted.length - 1].label
}
