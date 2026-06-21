import type { Word } from '@shared/types'

export default function RoundView({
  order,
  roundNumber,
  onDone,
}: {
  order: Word[]
  roundNumber: number
  onDone: () => void
}) {
  return (
    <div className="p-4">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-[var(--ink)]">Round {roundNumber}</h2>
        <p className="text-sm text-[var(--ink-soft)]">
          Say the term out loud for each translation. All {order.length} words shown below.
        </p>
      </div>

      <div className="space-y-2 mb-6">
        {order.map((word, i) => (
          <div key={word.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2.5">
            <div className="grid grid-cols-2 items-center min-w-0">
              <span className="text-xs text-[var(--ink-faint)] text-right pr-3">{i + 1}</span>
              <span className="text-[var(--ink-soft)] text-sm pl-3">{word.translation}</span>
            </div>
          </div>
        ))}
      </div>

      <button onClick={onDone} className="btn-primary w-full py-3">
        Done, check myself →
      </button>
    </div>
  )
}
