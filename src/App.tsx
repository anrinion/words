import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import DeckManager from './views/DeckManager'
import DeckLayout from './views/DeckLayout'
import WordBank from './views/WordBank'
import Train from './views/Train'
import Progress from './views/Progress'

export default function App() {
  return (
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
  )
}
