import { useEffect, useState } from 'react'
import { hasAudio, getAudioBlob } from '../lib/audioStore'

export default function AudioButton({
  wordId,
  type,
}: {
  wordId: string
  type: 'word' | 'example'
}) {
  const [available, setAvailable] = useState(false)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    hasAudio(wordId, type).then(setAvailable)
  }, [wordId, type])

  if (!available) return null

  async function play() {
    if (playing) return
    const blob = await getAudioBlob(wordId, type)
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    setPlaying(true)
    audio.onended = () => { URL.revokeObjectURL(url); setPlaying(false) }
    audio.onerror = () => { URL.revokeObjectURL(url); setPlaying(false) }
    audio.play()
  }

  return (
    <button
      onClick={play}
      className={`hover:text-[var(--pop)] transition-colors text-xs leading-none p-0.5 ${playing ? 'text-[var(--pop)]' : 'text-[var(--ink-faint)]'}`}
      title="Play audio"
    >
      {playing ? '◼' : '▶'}
    </button>
  )
}
