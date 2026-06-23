import { api } from './client'
import type { Word, ParsedWord, ImportResult } from '@shared/types'

export const wordsApi = {
  list: (deckId: string, params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : ''
    return api.get<Word[]>(`/api/decks/${deckId}/words${q}`)
  },
  create: (deckId: string, body: ParsedWord) =>
    api.post<Word>(`/api/decks/${deckId}/words`, body),
  update: (deckId: string, id: string, body: Partial<ParsedWord> & { weak?: number; streak?: number; lastSeenAt?: number | null }) =>
    api.patch<{ ok: boolean }>(`/api/decks/${deckId}/words/${id}`, body),
  remove: (deckId: string, id: string) =>
    api.delete<{ ok: boolean }>(`/api/decks/${deckId}/words/${id}`),
  deleteAll: (deckId: string) =>
    api.delete<{ ok: boolean }>(`/api/decks/${deckId}/words`),
  import: (
    deckId: string,
    body: { words: ParsedWord[]; rejected?: { line: string; reason: string }[] },
  ) => api.post<ImportResult>(`/api/decks/${deckId}/words/import`, body),
}
