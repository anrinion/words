import { vi } from 'vitest'

// Node 26 ships a broken built-in localStorage (requires --localstorage-file).
// Stub it out before any component renders so ThemeContext can call getItem safely.
const store: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value },
  removeItem: (key: string) => { delete store[key] },
  clear: () => { Object.keys(store).forEach((k) => delete store[k]) },
})
