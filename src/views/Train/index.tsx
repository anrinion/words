import { useState, useEffect } from 'react'
import { useOutletContext } from 'react-router-dom'
import type { Deck, Word, Settings, SessionData, RoundRecord } from '@shared/types'
import { shuffleDifferentFrom } from '@shared/batch'
import { batchApi } from '../../api/batch'
import { sessionsApi } from '../../api/sessions'
import { settingsApi } from '../../api/settings'
import { wordsApi } from '../../api/words'
import Preview from './Preview'
import RoundView from './RoundView'
import SelfCheck from './SelfCheck'
import Exam from './Exam'
import Result from './Result'

type SimplePhase = 'preview' | 'exam' | 'result'
type IndexedPhase = { type: 'round' | 'selfCheck'; index: number }
type Phase = SimplePhase | IndexedPhase

function isIndexed(p: Phase): p is IndexedPhase {
  return typeof p === 'object'
}

function buildPhaseList(numRounds: number): Phase[] {
  const phases: Phase[] = ['preview']
  for (let i = 0; i < numRounds; i++) {
    phases.push({ type: 'round', index: i })
    phases.push({ type: 'selfCheck', index: i })
  }
  phases.push('exam', 'result')
  return phases
}

export interface SessionState {
  phase: Phase
  phaseList: Phase[]
  batch: Word[] // fixed original order
  rounds: RoundRecord[]
  examOrder: Word[]
  examAnswers: Record<string, string>
  result?: { scorePct: number; grade: string; answers: { wordId: string; rawInput: string; matched: boolean }[] }
}

type AppState =
  | { status: 'idle'; emptyReason?: string }
  | { status: 'loading' }
  | { status: 'running'; mode: 'normal' | 'review'; session: SessionState }
  | { status: 'error'; message: string }

export default function Train() {
  const deck = useOutletContext<Deck>()
  const [state, setState] = useState<AppState>({ status: 'idle' })
  const [settings, setSettings] = useState<Settings | null>(null)

  useEffect(() => {
    settingsApi.getDeck(deck.id).then(setSettings)
  }, [deck.id])

  async function startSession(mode: 'normal' | 'review') {
    if (!settings) return
    setState({ status: 'loading' })
    try {
      const batchResult = await batchApi.get(deck.id, mode)
      if (batchResult.words.length === 0) {
        setState({ status: 'idle', emptyReason: batchResult.emptyReason })
        return
      }
      const batch = batchResult.words
      const phaseList = buildPhaseList(settings.numRounds)
      const firstRoundOrder = shuffleDifferentFrom(batch, batch)

      setState({
        status: 'running',
        mode,
        session: {
          phase: 'preview',
          phaseList,
          batch,
          rounds: [{ orderShown: firstRoundOrder.map((w) => w.id), selfCheckedIds: [] }],
          examOrder: [],
          examAnswers: {},
        },
      })
    } catch (e) {
      setState({ status: 'error', message: String(e) })
    }
  }

  function advance(updates?: Partial<SessionState>) {
    setState((prev) => {
      if (prev.status !== 'running') return prev
      const { session } = prev
      const { phaseList, phase } = session
      const currentIdx = phaseList.findIndex((p) =>
        isIndexed(p) && isIndexed(phase)
          ? p.type === phase.type && p.index === phase.index
          : p === phase,
      )
      const nextPhase = phaseList[currentIdx + 1]
      if (!nextPhase) return prev

      const updated: SessionState = { ...session, ...updates, phase: nextPhase }

      // Pre-populate next round's order when entering a round phase
      if (isIndexed(nextPhase) && nextPhase.type === 'round') {
        const prevOrder = updated.rounds[nextPhase.index - 1]?.orderShown.map(
          (id) => session.batch.find((w) => w.id === id)!,
        ) ?? session.batch
        const newOrder = shuffleDifferentFrom(session.batch, prevOrder)
        const rounds = [...updated.rounds]
        rounds[nextPhase.index] = { orderShown: newOrder.map((w) => w.id), selfCheckedIds: [] }
        updated.rounds = rounds
      }

      // Pre-populate exam order when entering exam phase
      if (nextPhase === 'exam') {
        const lastRoundOrder = updated.rounds[updated.rounds.length - 1].orderShown.map(
          (id) => session.batch.find((w) => w.id === id)!,
        )
        updated.examOrder = shuffleDifferentFrom(session.batch, lastRoundOrder)
      }

      return { ...prev, session: updated }
    })
  }

  async function handleEditWord(wordId: string, updates: { term: string; translation: string }) {
    await wordsApi.update(deck.id, wordId, updates)
    setState((prev) => {
      if (prev.status !== 'running') return prev
      return {
        ...prev,
        session: {
          ...prev.session,
          batch: prev.session.batch.map((w) => w.id === wordId ? { ...w, ...updates } : w),
        },
      }
    })
  }

  async function submitExam(answers: Record<string, string>) {
    if (state.status !== 'running') return
    const { session, mode } = state

    const data: SessionData = {
      batchWordIds: session.batch.map((w) => w.id),
      rounds: session.rounds,
      exam: {
        orderShown: session.examOrder.map((w) => w.id),
        answers: session.examOrder.map((w) => ({
          wordId: w.id,
          rawInput: answers[w.id] ?? '',
          matched: false, // server will re-grade
        })),
        scorePct: 0,
        grade: '',
      },
    }

    try {
      const saved = await sessionsApi.create(deck.id, { mode, data })
      const savedData = saved.data as SessionData
      setState((prev) => {
        if (prev.status !== 'running') return prev
        return {
          ...prev,
          session: {
            ...prev.session,
            examAnswers: answers,
            phase: 'result',
            result: {
              scorePct: savedData.exam.scorePct,
              grade: savedData.exam.grade,
              answers: savedData.exam.answers,
            },
          },
        }
      })
    } catch (e) {
      setState({ status: 'error', message: String(e) })
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (state.status === 'idle') {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 py-12 text-center">
        {state.emptyReason ? (
          <>
            <p className="text-4xl mb-3">🔍</p>
            <p className="text-slate-700 font-medium mb-2">Nothing to review</p>
            <p className="text-slate-500 text-sm">{state.emptyReason}</p>
            <button onClick={() => setState({ status: 'idle' })} className="btn-secondary mt-6">
              Back
            </button>
          </>
        ) : (
          <>
            <p className="text-4xl mb-4">🎯</p>
            <h2 className="text-xl font-bold text-slate-800 mb-1">Ready to train?</h2>
            <p className="text-slate-500 text-sm mb-8">
              Choose a mode to start a session for <strong>{deck.name}</strong>
            </p>
            <div className="w-full max-w-xs space-y-3">
              <button
                onClick={() => startSession('normal')}
                className="btn-primary w-full py-3"
                disabled={!settings}
              >
                Normal session
              </button>
              <button
                onClick={() => startSession('review')}
                className="btn-secondary w-full py-3"
                disabled={!settings}
              >
                Review weak words
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  if (state.status === 'loading') {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-400">Preparing session…</p>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center">
        <p className="text-red-500 font-medium mb-2">Something went wrong</p>
        <p className="text-slate-500 text-sm mb-4">{state.message}</p>
        <button onClick={() => setState({ status: 'idle' })} className="btn-secondary">
          Back
        </button>
      </div>
    )
  }

  const { session } = state
  const { phase, batch, rounds, examOrder } = session

  const totalPhases = session.phaseList.length
  const currentIdx = session.phaseList.findIndex((p) =>
    isIndexed(p) && isIndexed(phase)
      ? p.type === phase.type && p.index === phase.index
      : p === phase,
  )

  // Progress bar (exclude 'result' phase from the count)
  const progressPct = Math.round((currentIdx / (totalPhases - 1)) * 100)

  return (
    <div className="flex flex-col h-full">
      {/* Progress bar */}
      {phase !== 'result' && (
        <div className="h-1 bg-slate-100">
          <div
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {phase === 'preview' && (
          <Preview batch={batch} onContinue={() => advance()} onEditWord={handleEditWord} />
        )}

        {isIndexed(phase) && phase.type === 'round' && (
          <RoundView
            order={rounds[phase.index]?.orderShown.map((id) => batch.find((w) => w.id === id)!).filter(Boolean) ?? []}
            roundNumber={phase.index + 1}
            onDone={() => advance()}
          />
        )}

        {isIndexed(phase) && phase.type === 'selfCheck' && (
          <SelfCheck
            batch={batch}
            checkNumber={phase.index + 1}
            onEditWord={handleEditWord}
            onDone={(checkedIds) => {
              const rounds = [...session.rounds]
              rounds[phase.index] = { ...rounds[phase.index], selfCheckedIds: checkedIds }
              advance({ rounds })
            }}
          />
        )}

        {phase === 'exam' && (
          <Exam
            order={examOrder}
            onSubmit={submitExam}
          />
        )}

        {phase === 'result' && session.result && (
          <Result
            batch={batch}
            result={session.result}
            deckId={deck.id}
            onDone={() => setState({ status: 'idle' })}
            onAgain={() => startSession(state.mode)}
          />
        )}
      </div>
    </div>
  )
}
