import type { Word } from '@shared/types'
import AudioButton from '../../components/AudioButton'

export default function Preview({ batch, onContinue }: { batch: Word[]; onContinue: () => void }) {
  return (
    <div className="p-4">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-slate-800">Preview</h2>
        <p className="text-sm text-slate-500">
          Read through all {batch.length} words once. No interaction needed.
        </p>
      </div>

      <div className="space-y-1.5 mb-6">
        {batch.map((word) => (
          <div key={word.id} className="bg-white border border-slate-200 rounded-lg px-3 py-2.5">
            <div className="flex items-center gap-1.5">
              <AudioButton wordId={word.id} type="word" />
              <p className="font-medium text-slate-800 text-sm">{word.term}</p>
            </div>
            <p className="text-slate-500 text-sm mt-0.5">{word.translation}</p>
            {word.example && (
              <div className="mt-1.5 border-t border-slate-100 pt-1.5">
                <div className="flex items-center gap-1.5">
                  <AudioButton wordId={word.id} type="example" />
                  <p className="text-slate-500 text-xs italic">{word.example}</p>
                </div>
                {word.exampleTranslation && (
                  <p className="text-slate-400 text-xs mt-0.5 ml-4">{word.exampleTranslation}</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <button onClick={onContinue} className="btn-primary w-full py-3">
        Continue →
      </button>
    </div>
  )
}
