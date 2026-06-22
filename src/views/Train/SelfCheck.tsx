import { useEffect, useRef } from 'react'
import type { Word } from '@shared/types'

// Self-check is merged into RoundView (reveal-all mechanic).
// This component auto-advances. Guard against React Strict Mode double-fire.
export default function SelfCheck({
  batch: _batch,
  checkNumber: _checkNumber,
  onDone,
}: {
  batch: Word[]
  checkNumber: number
  onDone: () => void
}) {
  const done = useRef(false)
  useEffect(() => {
    if (!done.current) {
      done.current = true
      onDone()
    }
  }, [])
  return null
}
