import { api } from './client'
import type { Deck } from '@shared/types'

export const decksApi = {
  list: () => api.get<Deck[]>('/api/decks'),
  create: (body: { name: string; targetLanguage: string; nativeLanguage: string }) =>
    api.post<Deck>('/api/decks', body),
  update: (id: string, body: Partial<{ name: string; targetLanguage: string; nativeLanguage: string }>) =>
    api.patch<{ ok: boolean }>(`/api/decks/${id}`, body),
  remove: (id: string) => api.delete<{ ok: boolean }>(`/api/decks/${id}`),
}
