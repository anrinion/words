import { api } from './client'
import type { BatchResult } from '@shared/batch'

export const batchApi = {
  get: (deckId: string, mode: 'normal' | 'review') =>
    api.get<BatchResult>(`/api/decks/${deckId}/batch?mode=${mode}`),
}
