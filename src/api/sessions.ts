import { api } from './client'
import type { Session, SessionData } from '@shared/types'

export interface SessionSummary {
  id: string
  timestamp: number
  mode: 'normal' | 'review'
  scorePct: number
  grade: string
  batchSize: number
}

export const sessionsApi = {
  list: (deckId: string) =>
    api.get<SessionSummary[]>(`/api/decks/${deckId}/sessions`),
  get: (deckId: string, id: string) =>
    api.get<Session>(`/api/decks/${deckId}/sessions/${id}`),
  create: (deckId: string, body: { mode: 'normal' | 'review'; data: SessionData }) =>
    api.post<Session>(`/api/decks/${deckId}/sessions`, body),
}
