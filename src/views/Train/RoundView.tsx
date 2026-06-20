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
        <h2 className="text-lg font-bold text-slate-800">Round {roundNumber}</h2>
        <p className="text-sm text-slate-500">
          Say the term out loud for each translation. All {order.length} words shown below.
        </p>
      </div>

      <div className="space-y-2 mb-6">
        {order.map((word, i) => (
          <div key={word.id} className="flex gap-3 bg-white border border-slate-200 rounded-lg px-3 py-2.5 items-center">
            <span className="text-xs text-slate-400 w-5 shrink-0 text-right">{i + 1}</span>
            <span className="text-slate-700 text-sm">{word.translation}</span>
          </div>
        ))}
      </div>

      <button onClick={onDone} className="btn-primary w-full py-3">
        Done, check myself →
      </button>
    </div>
  )
}
