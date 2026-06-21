import { useState } from 'react'
import type { Word } from '@shared/types'

export default function SelfCheck({
  batch,
  checkNumber,
  onDone,
}: {
  batch: Word[] // always Preview's original order
  checkNumber: number
  onDone: (checkedIds: string[]) => void
}) {
  const [checked, setChecked] = useState<Set<string>>(new Set())

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="p-4">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-slate-800">Self-check {checkNumber}</h2>
        <p className="text-sm text-slate-500">
          Tick the words you recalled correctly. Scan the list yourself — don't rush.
        </p>
      </div>

      <div className="space-y-2 mb-6">
        {batch.map((word) => {
          const isChecked = checked.has(word.id)
          return (
            <button
              key={word.id}
              onClick={() => toggle(word.id)}
              className={`w-full flex gap-3 items-center rounded-lg px-3 py-2.5 border text-left transition-colors ${
                isChecked
                  ? 'bg-green-50 border-green-200'
                  : 'bg-white border-slate-200'
              }`}
            >
              <span
                className={`w-5 h-5 shrink-0 rounded border-2 flex items-center justify-center transition-colors ${
                  isChecked ? 'bg-green-500 border-green-500 text-white' : 'border-slate-300'
                }`}
              >
                {isChecked && '✓'}
              </span>
              <div className="flex-1 grid grid-cols-2 items-center min-w-0">
                <span className="text-right font-medium text-slate-800 text-sm pr-3 truncate">{word.term}</span>
                <span className="text-left text-slate-500 text-sm pl-3 truncate">{word.translation}</span>
              </div>
            </button>
          )
        })}
      </div>

      <p className="text-xs text-slate-400 text-center mb-3">
        {checked.size} of {batch.length} ticked
      </p>

      <button onClick={() => onDone(Array.from(checked))} className="btn-primary w-full py-3">
        Continue →
      </button>
    </div>
  )
}
