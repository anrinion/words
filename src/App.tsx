import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import DeckManager from './views/DeckManager'
import DeckLayout from './views/DeckLayout'
import WordBank from './views/WordBank'
import Train from './views/Train'
import Progress from './views/Progress'
import Login from './views/Login'
import { authApi } from './api/auth'
import { ThemeProvider } from './contexts/ThemeContext'

export default function App() {
  // undefined = loading, null = not logged in, string = email
  const [user, setUser] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    authApi.me()
      .then(({ email }) => setUser(email))
      .catch(() => setUser(null))
  }, [])

  if (user === undefined) return null

  if (user === null) return <ThemeProvider><Login onLogin={setUser} /></ThemeProvider>

  return (
    <ThemeProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DeckManager />} />
        <Route path="/deck/:deckId" element={<DeckLayout />}>
          <Route index element={<Navigate to="train" replace />} />
          <Route path="words" element={<WordBank />} />
          <Route path="train" element={<Train />} />
          <Route path="progress" element={<Progress />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    </ThemeProvider>
  )
}
