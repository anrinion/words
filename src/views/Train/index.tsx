import { useState, useEffect, CSSProperties } from 'react'
import { useOutletContext } from 'react-router-dom'
import type { Deck, Word, Settings, SessionData, RoundRecord } from '@shared/types'
import { shuffleDifferentFrom } from '@shared/batch'
import { batchApi } from '../../api/batch'
import { sessionsApi } from '../../api/sessions'
import { settingsApi } from '../../api/settings'
import { wordsApi } from '../../api/words'
import { useSessionContext } from '../../contexts/SessionContext'
import { useTheme } from '../../contexts/ThemeContext'
import Preview from './Preview'
import RoundView from './RoundView'
import SelfCheck from './SelfCheck'
import Exam, { ExamCheck } from './Exam'
import Result from './Result'

type SimplePhase = 'preview' | 'exam' | 'examRound' | 'examCheck' | 'result'
type IndexedPhase = { type: 'round' | 'selfCheck'; index: number }
type Phase = SimplePhase | IndexedPhase

const isMobile = window.matchMedia('(pointer: coarse)').matches

function isIndexed(p: Phase): p is IndexedPhase {
  return typeof p === 'object'
}

function buildPhaseList(numRounds: number): Phase[] {
  const phases: Phase[] = ['preview']
  for (let i = 0; i < numRounds; i++) {
    phases.push({ type: 'round', index: i })
    phases.push({ type: 'selfCheck', index: i })
  }
  // Mobile: extra "Exam" round + checkbox marking instead of typed exam
  phases.push(...(isMobile ? (['examRound', 'examCheck'] as const) : (['exam'] as const)))
  phases.push('result')
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
  const { setInSession } = useSessionContext()
  const { theme: t } = useTheme()

  useEffect(() => {
    settingsApi.getDeck(deck.id).then(setSettings)
  }, [deck.id])

  useEffect(() => {
    setInSession(state.status === 'running')
  }, [state.status])

  useEffect(() => {
    return () => setInSession(false)
  }, [])

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

      // Pre-populate exam order when entering exam or mobile exam round
      if (nextPhase === 'exam' || nextPhase === 'examRound') {
        const lastRoundOrder = updated.rounds[updated.rounds.length - 1].orderShown.map(
          (id) => session.batch.find((w) => w.id === id)!,
        )
        updated.examOrder = shuffleDifferentFrom(session.batch, lastRoundOrder)
      }

      return { ...prev, session: updated }
    })
  }

  function handleExit() {
    setState({ status: 'idle' })
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
      if (isMobile) {
        setState({ status: 'idle' })
        return
      }
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
    const pad: CSSProperties = { padding: '26px 30px 40px', maxWidth: 880, margin: '0 auto' }
    const kicker: CSSProperties = { fontFamily: t.fontBody, fontSize: 11, fontWeight: 700, letterSpacing: '.11em', textTransform: 'uppercase', color: t.pop, display: 'block', marginBottom: 9 }
    const h2: CSSProperties = { fontFamily: t.fontHead, fontSize: 22, fontWeight: 600, color: t.ink, margin: '0 0 6px', letterSpacing: '-.01em' }
    const lead: CSSProperties = { fontFamily: t.fontBody, fontSize: 14, fontWeight: 500, color: t.inkSoft, margin: '0 0 22px', lineHeight: 1.5 }
    const outlineCard: CSSProperties = { background: t.surface, border: `1px solid ${t.border}`, borderRadius: t.radius, overflow: 'hidden', margin: '18px 0 22px' }
    const outRow = (last: boolean): CSSProperties => ({ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderBottom: last ? 'none' : `1px solid ${t.border}` })
    const outNum = (pop?: boolean): CSSProperties => ({ width: 26, height: 26, flexShrink: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: pop ? t.pop : t.surface2, color: pop ? t.popInk : t.inkSoft, fontFamily: t.fontBody, fontSize: 12, fontWeight: 700 })
    const outLabel: CSSProperties = { flex: 1, fontFamily: t.fontBody, fontSize: 15, fontWeight: 600, color: t.ink }
    const primaryBtn: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '14px 24px', marginTop: 2, border: 'none', borderRadius: t.radius, background: t.pop, color: t.popInk, fontFamily: t.fontBody, fontSize: 15, fontWeight: 600, cursor: 'pointer', transition: 'filter .15s', width: '100%' }
    const secondaryBtn: CSSProperties = { ...primaryBtn, background: t.surface2, color: t.inkSoft, border: `1px solid ${t.border}` }

    if (state.emptyReason) {
      return (
        <div style={{ ...pad, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center' }}>
          <p style={{ fontSize: 36, marginBottom: 12 }}>🔍</p>
          <p style={{ fontFamily: t.fontHead, fontSize: 18, fontWeight: 600, color: t.ink, marginBottom: 6 }}>Nothing to review</p>
          <p style={{ fontFamily: t.fontBody, fontSize: 14, color: t.inkSoft, marginBottom: 24 }}>{state.emptyReason}</p>
          <button onClick={() => setState({ status: 'idle' })} style={secondaryBtn}>Back</button>
        </div>
      )
    }

    return (
      <div style={pad}>
        <span style={kicker}>Train</span>
        <h2 style={h2}>{t.trainTitle}</h2>
        <p style={lead}>{t.trainLead}</p>

        {/* Neutral: "Due today" banner */}
        {t.id === 'neutral' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '18px 20px', marginBottom: 4, background: t.surface, border: `1px solid ${t.border}`, borderLeft: `4px solid ${t.pop}`, borderRadius: t.radius }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontFamily: t.fontBody, fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: t.inkFaint }}>Ready to start</span>
              <span style={{ fontFamily: t.fontHead, fontSize: 22, fontWeight: 700, color: t.ink }}>{deck.name}</span>
            </div>
            <span style={{ fontFamily: t.fontBody, fontSize: 14, color: t.inkSoft, maxWidth: 200 }}>A quick pass keeps them from slipping.</span>
          </div>
        )}

        {/* School: teacher panel */}
        {t.id === 'school' && (
          <div style={{ display: 'flex', gap: 15, padding: '20px 22px', marginBottom: 4, background: '#2b382f', borderRadius: t.radius, color: '#eadfca' }}>
            <span style={{ width: 46, height: 46, flexShrink: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.pop, color: '#fff', fontFamily: t.fontBody, fontSize: 15, fontWeight: 700 }}>FR</span>
            <div style={{ flex: 1 }}>
              <span style={{ fontFamily: t.fontHead, fontSize: 13, color: '#cdbf9c', letterSpacing: '.02em' }}>Frau Richter</span>
              <p style={{ fontFamily: t.fontHead, fontSize: 15, fontStyle: 'italic', color: '#f2ead6', margin: '5px 0 0', lineHeight: 1.5 }}>
                "We review the vocabulary today. I expect all words before the bell — no excuses, bitte."
              </p>
            </div>
          </div>
        )}

        {/* Quest: main quest + side quest */}
        {t.id === 'quest' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 13, marginBottom: 4 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, padding: '18px 20px', background: t.surface, border: `1px solid ${t.border}`, borderRadius: t.radius }}>
              <span style={{ fontFamily: t.fontBody, fontSize: 10, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: t.inkFaint }}>Main Quest</span>
              <span style={{ fontFamily: t.fontHead, fontSize: 17, fontWeight: 700, color: t.ink }}>Master {deck.name}</span>
              <div style={{ height: 7, borderRadius: 999, background: t.border, overflow: 'hidden', marginTop: 4 }}>
                <div style={{ width: '35%', height: '100%', background: t.pop, borderRadius: 999 }} />
              </div>
              <span style={{ fontFamily: t.fontBody, fontSize: 12, fontWeight: 600, color: t.inkFaint }}>Keep training to level up</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '18px 20px', background: t.popSoft, border: `1px solid ${t.pop}`, borderRadius: t.radius }}>
              <span style={{ fontFamily: t.fontBody, fontSize: 10, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: t.pop }}>⚡ Side Quest · live</span>
              <span style={{ fontFamily: t.fontHead, fontSize: 15, fontWeight: 700, color: t.ink, lineHeight: 1.3 }}>Finish this session under 2:00</span>
              <span style={{ fontFamily: t.fontBody, fontSize: 12, fontWeight: 700, color: t.pop }}>Reward +150 XP</span>
            </div>
          </div>
        )}

        {/* Session outline */}
        <div style={outlineCard}>
          <div style={outRow(false)}>
            <span style={outNum()}>1</span>
            <span style={outLabel}>Read-through</span>
            <span style={{ fontFamily: t.fontBody, fontSize: 13, color: t.inkFaint }}>all words</span>
          </div>
          <div style={outRow(false)}>
            <span style={outNum()}>2</span>
            <span style={outLabel}>Practice rounds</span>
            <span style={{ fontFamily: t.fontBody, fontSize: 13, color: t.inkFaint }}>self-check</span>
          </div>
          <div style={outRow(true)}>
            <span style={outNum(true)}>{t.id === 'quest' ? '⚔' : '3'}</span>
            <span style={outLabel}>{t.examLabel}</span>
            <span style={{ fontFamily: t.fontBody, fontSize: 13, color: t.inkFaint }}>final check</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={() => startSession('normal')} style={{ ...primaryBtn, opacity: settings ? 1 : 0.5, pointerEvents: settings ? 'auto' : 'none' }}>
            {t.startCta} →
          </button>
          <button onClick={() => startSession('review')} style={{ ...secondaryBtn, opacity: settings ? 1 : 0.5, pointerEvents: settings ? 'auto' : 'none' }}>
            Review weak words
          </button>
        </div>
      </div>
    )
  }

  if (state.status === 'loading') {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-[var(--ink-faint)]">Preparing session…</p>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center">
        <p className="text-red-500 font-medium mb-2">Something went wrong</p>
        <p className="text-[var(--ink-soft)] text-sm mb-4">{state.message}</p>
        <button onClick={() => setState({ status: 'idle' })} className="btn-secondary">
          Back
        </button>
      </div>
    )
  }

  const { session } = state
  const { phase, batch, rounds, examOrder } = session

  const phaseKey = isIndexed(phase) ? phase.type : (phase as string)
  const phaseInfo: Record<string, { seg: number; label: string }> = {
    preview:   { seg: 0, label: 'Read-through' },
    round:     { seg: 1, label: 'Practice' },
    selfCheck: { seg: 1, label: 'Practice' },
    exam:      { seg: 2, label: t.examLabel },
    examRound: { seg: 2, label: t.examLabel },
    examCheck: { seg: 2, label: t.examLabel },
    result:    { seg: 3, label: 'Results' },
  }
  const { seg: segIdx, label: stepLabel } = phaseInfo[phaseKey] ?? { seg: 0, label: '' }

  return (
    <div className="flex flex-col h-full">
      {/* Session bar */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 14, padding: '13px 20px', background: t.surface, borderBottom: `1px solid ${t.border}` }}>
        <button
          onClick={handleExit}
          style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 9, border: `1px solid ${t.border}`, background: t.surface2, color: t.inkSoft, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title="Exit session"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        </button>
        <div style={{ flex: 1, display: 'flex', gap: 6, alignItems: 'center' }}>
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              style={{
                flex: 1, height: 6, borderRadius: 999, transition: 'all .2s',
                background: idx <= segIdx ? t.pop : t.border,
                boxShadow: idx === segIdx ? `0 0 0 3px ${t.popSoft}` : 'none',
              }}
            />
          ))}
        </div>
        <span style={{ fontFamily: t.fontBody, fontSize: 12.5, fontWeight: 600, color: t.inkSoft, flexShrink: 0 }}>{stepLabel}</span>
      </div>

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
            batch={
              rounds[phase.index]?.orderShown
                .map((id) => batch.find((w) => w.id === id)!)
                .filter(Boolean) ?? batch
            }
            checkNumber={phase.index + 1}
            onDone={() => advance()}
          />
        )}

        {phase === 'exam' && (
          <Exam order={examOrder} onSubmit={submitExam} />
        )}

        {phase === 'examRound' && (
          <RoundView
            order={examOrder}
            roundNumber={0}
            label={t.examLabel}
            onDone={() => advance()}
          />
        )}

        {phase === 'examCheck' && (
          <ExamCheck order={examOrder} onSubmit={submitExam} />
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
