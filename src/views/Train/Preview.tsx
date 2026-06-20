import type { Word } from '@shared/types'

export default function Preview({ batch, onContinue }: { batch: Word[]; onContinue: () => void }) {
  return (
    <div className="p-4">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-slate-800">Preview</h2>
        <p className="text-sm text-slate-500">
          Read through all {batch.length} words once. No interaction needed.
        </p>
      </div>

      <div className="space-y-2 mb-6">
        {batch.map((word) => (
          <div key={word.id} className="flex gap-3 bg-white border border-slate-200 rounded-lg px-3 py-2.5">
            <span className="font-medium text-slate-800 text-sm min-w-0 flex-1">{word.term}</span>
            <span className="text-slate-400 text-sm">—</span>
            <span className="text-slate-600 text-sm min-w-0 flex-1 text-right">{word.translation}</span>
          </div>
        ))}
      </div>

      <button onClick={onContinue} className="btn-primary w-full py-3">
        Continue →
      </button>
    </div>
  )
}
