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
import { TrainButton } from '../../components/TrainButton'
import { PreviewPanel, StorySidebar } from '../../storyPanels'
import type { SidebarStage } from '../../storyPanels'
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
  phases.push(...(isMobile ? (['examRound', 'examCheck'] as const) : (['exam'] as const)))
  phases.push('result')
  return phases
}

export interface SessionState {
  phase: Phase
  phaseList: Phase[]
  batch: Word[]
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

type ModeTab = 'guided' | 'flashcards' | 'speed'

export default function Train() {
  const deck = useOutletContext<Deck>()
  const [state, setState] = useState<AppState>({ status: 'idle' })
  const [settings, setSettings] = useState<Settings | null>(null)
  const [modeTab, setModeTab] = useState<ModeTab>('guided')
  const { setInSession } = useSessionContext()
  const { theme: t } = useTheme()

  useEffect(() => {
    settingsApi.getDeck(deck.id).then(setSettings)
  }, [deck.id])

  useEffect(() => {
    setInSession(state.status === 'running')
  }, [state.status, setInSession])

  useEffect(() => {
    return () => setInSession(false)
  }, [setInSession])

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

      if (isIndexed(nextPhase) && nextPhase.type === 'round') {
        const prevOrder = updated.rounds[nextPhase.index - 1]?.orderShown.map(
          (id) => session.batch.find((w) => w.id === id)!,
        ) ?? session.batch
        const newOrder = shuffleDifferentFrom(session.batch, prevOrder)
        const rounds = [...updated.rounds]
        rounds[nextPhase.index] = { orderShown: newOrder.map((w) => w.id), selfCheckedIds: [] }
        updated.rounds = rounds
      }

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
          matched: false,
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

  // ── Idle / Home ──────────────────────────────────────────────────────────────

  if (state.status === 'idle') {
    const pad: CSSProperties = { padding: '26px 22px 60px', maxWidth: 680, margin: '0 auto', width: '100%' }

    if (state.emptyReason) {
      return (
        <div style={{ ...pad, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center' }}>
          <p style={{ fontSize: 36, marginBottom: 12 }}>🔍</p>
          <p style={{ fontFamily: t.fontHead, fontSize: 18, fontWeight: 600, color: t.ink, marginBottom: 6 }}>Nothing to review</p>
          <p style={{ fontFamily: t.fontBody, fontSize: 14, color: t.inkSoft, marginBottom: 24 }}>{state.emptyReason}</p>
          <TrainButton variant="secondary" onClick={() => setState({ status: 'idle' })} style={{ marginTop: 10 }}>Back</TrainButton>
        </div>
      )
    }

    const steps = [
      { label: 'First look', desc: 'getting familiar' },
      { label: 'Recall', desc: 'active learning' },
      { label: 'Test', desc: 'checking the progress' },
    ]

    type TileConfig = { id: ModeTab; label: string; tagline: string; soon?: true; icon: JSX.Element }
    const tiles: TileConfig[] = [
      {
        id: 'guided', label: 'Batch learning', tagline: 'Learn, recall, and test — the full loop.',
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 6h16M4 12h16M4 18h10" />
          </svg>
        ),
      },
      {
        id: 'flashcards', label: 'Flashcards', tagline: 'Flip through at your own pace.', soon: true,
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="14" height="14" rx="2" />
            <path d="M7 5V3.5A1.5 1.5 0 0 1 8.5 2H20a1 1 0 0 1 1 1v12a1.5 1.5 0 0 1-1.5 1.5H18" />
          </svg>
        ),
      },
      {
        id: 'speed', label: 'Speed match', tagline: 'Match pairs against the clock.', soon: true,
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 2L4.5 13.5H11l-1 8.5L19.5 10H13z" />
          </svg>
        ),
      },
    ]

    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '0 22px' }}>
        <div style={{ display: 'flex', gap: 32, maxWidth: 940, width: '100%', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0, padding: '26px 0 60px' }}>
        <span style={{ fontFamily: t.fontBody, fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: t.pop, display: 'block', marginBottom: 9 }}>
          STUDY
        </span>
        <h2 style={{ fontFamily: t.fontHead, fontSize: 28, fontWeight: 700, color: t.ink, margin: '0 0 6px', letterSpacing: '-.01em' }}>
          {t.trainTitle}
        </h2>
        <p style={{ fontFamily: t.fontBody, fontSize: 15, color: t.inkSoft, margin: '0 0 26px', lineHeight: 1.5 }}>
          {t.trainLead}
        </p>

        {isMobile && <PreviewPanel deck={deck} t={t} />}

        {/* Mode picker label */}
        <div style={{ fontFamily: t.fontBody, fontSize: 11.5, fontWeight: 700, letterSpacing: '.06em', color: t.inkSoft, marginBottom: 11 }}>
          CHOOSE A MODE
        </div>

        {/* Mode tile cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 11, marginBottom: 22 }}>
          {tiles.map(tile => {
            const active = modeTab === tile.id
            return (
              <button
                key={tile.id}
                onClick={() => !tile.soon && setModeTab(tile.id)}
                style={{
                  textAlign: 'left', cursor: tile.soon ? 'default' : 'pointer',
                  padding: 15, borderRadius: 15, background: t.surface,
                  border: `1.5px solid ${active ? t.pop : t.border}`,
                  boxShadow: active ? `0 0 0 3px ${t.pop}1f` : 'none',
                  transition: 'all .14s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 11, flexShrink: 0,
                    background: tile.id === 'guided' ? `${t.pop}17` : t.surface2,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: tile.id === 'guided' ? t.pop : t.ink,
                  }}>
                    {tile.icon}
                  </div>
                  {tile.soon && (
                    <span style={{ fontFamily: t.fontBody, fontSize: 10, fontWeight: 700, letterSpacing: '.04em', color: t.inkFaint, background: t.surface2, padding: '3px 7px', borderRadius: 6 }}>
                      Soon
                    </span>
                  )}
                </div>
                <div style={{ fontFamily: t.fontBody, fontSize: 14.5, fontWeight: 700, color: tile.soon ? t.inkSoft : t.ink, marginTop: 12 }}>
                  {tile.label}
                </div>
                <div style={{ fontFamily: t.fontBody, fontSize: 12.5, color: t.inkFaint, lineHeight: 1.4, marginTop: 3 }}>
                  {tile.tagline}
                </div>
              </button>
            )
          })}
        </div>

        {/* Guided mode detail */}
        {modeTab === 'guided' && (
          <>
            <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 16, overflow: 'hidden', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: `1px solid ${t.border}` }}>
                <div style={{ fontFamily: t.fontHead, fontSize: 16, fontWeight: 700, color: t.ink }}>
                  {tiles.find(tile => tile.id === modeTab)!.label}
                </div>
              </div>
              <div style={{ padding: '6px 8px' }}>
                {steps.map((step, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '12px 12px' }}>
                    <span style={{
                      width: 26, height: 26, flexShrink: 0, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: i === 0 ? `${t.pop}17` : t.surface2,
                      color: i === 0 ? t.pop : t.inkSoft,
                      fontFamily: t.fontBody, fontSize: 12, fontWeight: 700,
                    }}>
                      {i + 1}
                    </span>
                    <span style={{ flex: 1, fontFamily: t.fontBody, fontSize: 14.5, fontWeight: 600, color: t.ink }}>{step.label}</span>
                    <span style={{ fontFamily: t.fontBody, fontSize: 13, color: t.inkSoft }}>{step.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            <TrainButton
              onClick={() => startSession('normal')}
              disabled={!settings}
              style={{ marginTop: 10 }}
            >
              {t.startCta} →
            </TrainButton>
          </>
        )}

        {/* Coming soon panel */}
        {modeTab !== 'guided' && (
          <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 16, padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontFamily: t.fontHead, fontSize: 16, fontWeight: 700, color: t.ink }}>
                {modeTab === 'flashcards' ? 'Flashcards' : 'Speed match'}
              </span>
              <span style={{ fontFamily: t.fontBody, fontSize: 11, fontWeight: 700, letterSpacing: '.04em', color: t.inkSoft, background: t.surface2, padding: '4px 9px', borderRadius: 7 }}>
                COMING SOON
              </span>
            </div>
            <p style={{ fontFamily: t.fontBody, fontSize: 14, color: t.inkSoft, lineHeight: 1.6, margin: '12px 0 0' }}>
              {modeTab === 'flashcards'
                ? 'Flip a card to reveal its translation, then mark whether it stuck. A relaxed, tappable way to drill a deck.'
                : 'Pairs of words and translations appear on a timer — tap the matches as fast as you can.'}
            </p>
            <button disabled style={{ width: '100%', marginTop: 20, padding: 14, borderRadius: 13, border: 'none', background: t.surface2, color: t.inkSoft, fontSize: 14.5, fontWeight: 600, cursor: 'not-allowed', fontFamily: t.fontBody }}>
              We&apos;re still building this mode
            </button>
          </div>
        )}
        </div>
        {!isMobile && (
          <div style={{ width: 240, flexShrink: 0, paddingTop: 26, position: 'sticky', top: 20 }}>
            <StorySidebar stage="idle" deck={deck} t={t} />
          </div>
        )}
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
        <p style={{ color: 'var(--danger)', fontWeight: 600, marginBottom: 8, fontFamily: 'inherit' }}>Something went wrong</p>
        <p className="text-[var(--ink-soft)] text-sm mb-4">{state.message}</p>
        <button onClick={() => setState({ status: 'idle' })} className="btn-secondary">
          Back
        </button>
      </div>
    )
  }

  // ── Running session ──────────────────────────────────────────────────────────

  const { session } = state
  const { phase, batch, rounds, examOrder } = session

  // 5-segment bar: First look(0), Recall 1(1), Recall 2(2), Test(3), Summary(4)
  const segLabels = ['First look', 'Recall 1', 'Recall 2', 'Test', 'Summary']
  let segIdx = 0
  if (phase === 'preview') {
    segIdx = 0
  } else if (isIndexed(phase) && phase.type === 'round') {
    segIdx = phase.index + 1
  } else if (isIndexed(phase) && phase.type === 'selfCheck') {
    segIdx = phase.index + 1
  } else if (phase === 'exam' || phase === 'examRound' || phase === 'examCheck') {
    segIdx = 3
  } else if (phase === 'result') {
    segIdx = 4
  }

  return (
    <div className="flex flex-col h-full">
      {/* Session bar */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', background: t.surface, borderBottom: `1px solid ${t.border}` }}>
        <button
          onClick={handleExit}
          style={{ width: 32, height: 32, flexShrink: 0, borderRadius: 9, border: `1px solid ${t.border}`, background: t.surface2, color: t.inkSoft, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title="Exit session"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        </button>
        <div style={{ flex: 1, display: 'flex', gap: 4, alignItems: 'center' }}>
          {segLabels.map((_, idx) => (
            <div
              key={idx}
              style={{
                flex: 1, height: 5, borderRadius: 999, transition: 'all .25s',
                background: idx <= segIdx ? t.pop : t.border,
                boxShadow: idx === segIdx ? `0 0 0 3px ${t.popSoft}` : 'none',
              }}
            />
          ))}
        </div>
        <span style={{ fontFamily: t.fontBody, fontSize: 12, fontWeight: 600, color: t.inkSoft, flexShrink: 0 }}>
          {segLabels[segIdx]}
        </span>
      </div>

      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', minHeight: 0, overflow: 'hidden', padding: '0 22px' }}>
        <div style={{ display: 'flex', gap: 32, maxWidth: 940, width: '100%', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
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
        {!isMobile && (
          <div style={{ width: 240, flexShrink: 0, padding: '20px 0' }}>
            <StorySidebar stage={phase as SidebarStage} deck={deck} t={t} />
          </div>
        )}
        </div>
      </div>
    </div>
  )
}
