import type { ParseResult } from '@shared/types'

export interface ImportAdapter {
  id: string
  name: string
  description: string
  run(): Promise<ParseResult | null> // null = user cancelled
}
