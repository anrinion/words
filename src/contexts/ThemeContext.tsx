import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { THEMES, Theme, ThemeId } from '../themes'

interface ThemeContextType {
  theme: Theme
  setTheme: (id: ThemeId) => void
}

const ThemeContext = createContext<ThemeContextType>({
  theme: THEMES.neutral,
  setTheme: () => {},
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeId] = useState<ThemeId>(() => {
    const stored = localStorage.getItem('theme')
    return (stored && stored in THEMES) ? (stored as ThemeId) : 'neutral'
  })

  function setTheme(id: ThemeId) {
    setThemeId(id)
    localStorage.setItem('theme', id)
  }

  const theme = THEMES[themeId] ?? THEMES.neutral

  useEffect(() => {
    const r = document.documentElement.style
    r.setProperty('--app-bg', theme.appBg)
    r.setProperty('--surface', theme.surface)
    r.setProperty('--surface2', theme.surface2)
    r.setProperty('--ink', theme.ink)
    r.setProperty('--ink-soft', theme.inkSoft)
    r.setProperty('--ink-faint', theme.inkFaint)
    r.setProperty('--border', theme.border)
    r.setProperty('--pop', theme.pop)
    r.setProperty('--pop-ink', theme.popInk)
    r.setProperty('--pop-soft', theme.popSoft)
    r.setProperty('--radius', theme.radius)
    r.setProperty('--radius-sm', theme.radiusSm)
    r.setProperty('--font-head', theme.fontHead)
    r.setProperty('--font-body', theme.fontBody)
    r.setProperty('--danger', theme.danger)
    r.setProperty('--danger-soft', theme.dangerSoft)
    r.setProperty('--status-new', theme.statusNew)
    r.setProperty('--status-weak', theme.statusWeak)
    r.setProperty('--status-mastered', theme.statusMastered)
    r.setProperty('--toast-bg', theme.toastBg)
    r.setProperty('--toast-action', theme.toastAction)
    document.body.style.background = theme.appBg
    document.body.style.color = theme.ink
    document.body.style.fontFamily = theme.fontBody
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
