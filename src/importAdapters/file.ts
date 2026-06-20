import { parseDelimited } from '@shared/parser'
import type { ImportAdapter } from './types'

function pickFile(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.txt,.csv,.tsv'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) { resolve(null); return }
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => resolve(null)
      reader.readAsText(file, 'utf-8')
    }
    input.oncancel = () => resolve(null)
    input.click()
  })
}

export const fileAdapter: ImportAdapter = {
  id: 'file',
  name: 'Upload file',
  description: 'Upload a CSV, TSV, or plain text file',
  run: async () => {
    const text = await pickFile()
    if (text === null) return null
    return parseDelimited(text)
  },
}
