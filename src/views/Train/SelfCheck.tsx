import type { Word } from '@shared/types'

export default function SelfCheck({
  batch,
  checkNumber,
  onDone,
}: {
  batch: Word[]
  checkNumber: number
  onDone: () => void
}) {
  return (
    <div className="p-4">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-[var(--ink)]">Check {checkNumber}</h2>
        <p className="text-sm text-[var(--ink-soft)]">
          Review the pairs. Make sure you know them before continuing.
        </p>
      </div>

      <div className="space-y-1.5 mb-6">
        {batch.map((word) => (
          <div
            key={word.id}
            className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2.5"
          >
            <div className="grid grid-cols-2 items-start min-w-0">
              <span className="text-right font-medium text-[var(--ink)] text-sm pr-3 break-words">
                {word.term}
              </span>
              <span className="text-left text-[var(--ink-soft)] text-sm pl-3 break-words">
                {word.translation}
              </span>
            </div>
          </div>
        ))}
      </div>

      <button onClick={onDone} className="btn-primary w-full py-3">
        Continue →
      </button>
    </div>
  )
}
