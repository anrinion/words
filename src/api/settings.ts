import { api } from './client'
import type { Settings } from '@shared/types'

export const settingsApi = {
  getDeck: (deckId: string) => api.get<Settings>(`/api/decks/${deckId}/settings`),
  updateDeck: (deckId: string, body: Partial<Settings>) =>
    api.patch<Settings>(`/api/decks/${deckId}/settings`, body),
  getGlobal: () => api.get<Settings>('/api/settings'),
  updateGlobal: (body: Partial<Settings>) => api.patch<Settings>('/api/settings', body),
}
