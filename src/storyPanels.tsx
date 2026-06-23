import type { Deck } from '@shared/types'
import type { Theme } from './themes'

export type SidebarStage =
  | 'idle'
  | 'preview'
  | 'result'
  | 'exam'
  | 'examRound'
  | 'examCheck'
  | { type: 'round'; index: number }
  | { type: 'selfCheck'; index: number }

// ─── Inline preview panels (mode-picker / idle page) ─────────────────────────

export function PreviewPanel({ deck, t }: { deck: Deck; t: Theme }) {
  if (t.id === 'neutral') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 18px', marginBottom: 20, background: t.surface, border: `1px solid ${t.border}`, borderLeft: `4px solid ${t.pop}`, borderRadius: t.radius }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontFamily: t.fontBody, fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: t.inkFaint }}>Ready to start</span>
          <span style={{ fontFamily: t.fontHead, fontSize: 20, fontWeight: 700, color: t.ink }}>{deck.name}</span>
        </div>
        <span style={{ fontFamily: t.fontBody, fontSize: 13.5, color: t.inkSoft, marginLeft: 'auto', maxWidth: 180, textAlign: 'right' }}>A quick pass keeps them from slipping.</span>
      </div>
    )
  }

  if (t.id === 'school') {
    return (
      <div style={{ display: 'flex', gap: 14, padding: '18px 20px', marginBottom: 20, background: t.panelBg, borderRadius: t.radius, color: t.panelText }}>
        <span style={{ width: 44, height: 44, flexShrink: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.pop, color: t.popInk, fontFamily: t.fontBody, fontSize: 14, fontWeight: 700 }}>FR</span>
        <div style={{ flex: 1 }}>
          <span style={{ fontFamily: t.fontHead, fontSize: 12.5, color: t.panelMeta, letterSpacing: '.02em' }}>Frau Richter</span>
          <p style={{ fontFamily: t.fontHead, fontSize: 14.5, fontStyle: 'italic', color: t.panelText, margin: '4px 0 0', lineHeight: 1.5 }}>
            &ldquo;I trust everyone has reviewed their vocabulary. I will be checking every single word today.&rdquo;
          </p>
        </div>
      </div>
    )
  }

  // quest
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 12, marginBottom: 20 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, padding: '16px 18px', background: t.surface, border: `1px solid ${t.border}`, borderRadius: t.radius }}>
        <span style={{ fontFamily: t.fontBody, fontSize: 10, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: t.inkFaint }}>Main Quest</span>
        <span style={{ fontFamily: t.fontHead, fontSize: 16, fontWeight: 700, color: t.ink }}>Master {deck.name}</span>
        <div style={{ height: 7, borderRadius: 999, background: t.border, overflow: 'hidden', marginTop: 2 }}>
          <div style={{ width: '35%', height: '100%', background: t.pop, borderRadius: 999 }} />
        </div>
        <span style={{ fontFamily: t.fontBody, fontSize: 12, fontWeight: 600, color: t.inkFaint }}>Keep training to level up</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '16px 18px', background: t.popSoft, border: `1px solid ${t.pop}`, borderRadius: t.radius }}>
        <span style={{ fontFamily: t.fontBody, fontSize: 10, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: t.pop }}>⚡ Side Quest</span>
        <span style={{ fontFamily: t.fontHead, fontSize: 14, fontWeight: 700, color: t.ink, lineHeight: 1.35 }}>Finish under 2:00</span>
        <span style={{ fontFamily: t.fontBody, fontSize: 12, fontWeight: 700, color: t.pop }}>Reward +150 XP</span>
      </div>
    </div>
  )
}

// ─── Sidebar widget helpers ───────────────────────────────────────────────────

function getSchoolContent(stage: SidebarStage): { heading: string; quote: string } {
  if (stage === 'idle') return {
    heading: 'Homework overdue',
    quote: "You were supposed to learn these words last night. You didn't. She always checks. Every. Single. Word.",
  }
  if (stage === 'preview') return {
    heading: 'Read carefully',
    quote: "Don't skim. She will ask you to spell it out, word for word. Take your time on every entry.",
  }
  if (typeof stage === 'object' && stage.type === 'round') return {
    heading: stage.index === 0 ? 'First pass' : 'Second pass',
    quote: stage.index === 0
      ? "She calls on students without warning — you won't know which word she'll pick."
      : "Almost out of time. These need to stick. The bell is coming.",
  }
  if (typeof stage === 'object' && stage.type === 'selfCheck') return {
    heading: stage.index === 0 ? 'Be honest' : 'Last chance',
    quote: stage.index === 0
      ? "Don't mark it right if you're not sure. You need to know what you actually don't know yet."
      : "Fix whatever's still shaky. She doesn't just ask once — she circles back.",
  }
  if (stage === 'exam' || stage === 'examRound' || stage === 'examCheck') return {
    heading: 'Lesson time',
    quote: "Frau Richter is walking around the room. Write down exactly what you know.",
  }
  return {
    heading: 'Done',
    quote: "Let's hope it was enough. She has your parents' number. She uses it.",
  }
}

function schoolUrgency(stage: SidebarStage): number {
  if (stage === 'idle') return 0.12
  if (stage === 'preview') return 0.28
  if (typeof stage === 'object' && stage.type === 'round') return stage.index === 0 ? 0.42 : 0.62
  if (typeof stage === 'object' && stage.type === 'selfCheck') return stage.index === 0 ? 0.52 : 0.75
  return 1.0
}

function urgencyColor(pct: number): string {
  if (pct < 0.45) return '#3fae86'
  if (pct < 0.75) return '#e0a23a'
  return '#dc5360'
}

function getQuestContent(stage: SidebarStage, deckName: string): { heading: string; body: string } {
  if (stage === 'idle') return { heading: 'Objective', body: `Master every word in ${deckName}. Clear the deck to advance the main quest.` }
  if (stage === 'preview') return { heading: 'Scouting', body: "Review your targets before engaging. Knowledge is your weapon." }
  if (typeof stage === 'object' && stage.type === 'round') return {
    heading: stage.index === 0 ? 'Round 1 — Attack' : 'Round 2 — Press on',
    body: stage.index === 0 ? "First contact. Stay sharp and push through." : "Tighten formation. Clear what remains.",
  }
  if (typeof stage === 'object' && stage.type === 'selfCheck') return {
    heading: stage.index === 0 ? 'After-action check' : 'Final assessment',
    body: stage.index === 0 ? "Mark your hits. Misses return to the queue." : "Last recon before the Boss Trial.",
  }
  if (stage === 'exam' || stage === 'examRound' || stage === 'examCheck') return { heading: '⚔️ Boss Trial', body: "All skills summoned. Write from memory — no second chances." }
  return { heading: 'Run complete!', body: "XP earned and logged. Return to base." }
}

function questXP(stage: SidebarStage): number {
  if (stage === 'idle' || stage === 'preview') return 0
  if (typeof stage === 'object' && stage.type === 'round') return stage.index === 0 ? 60 : 180
  if (typeof stage === 'object' && stage.type === 'selfCheck') return stage.index === 0 ? 100 : 240
  if (stage === 'exam' || stage === 'examRound' || stage === 'examCheck') return 300
  return 400
}

function getNeutralContent(stage: SidebarStage): { heading: string; body: string } {
  if (stage === 'idle') return { heading: 'Ready', body: "Choose a mode and begin your session." }
  if (stage === 'preview') return { heading: 'Warm-up', body: "Look through the words before you start." }
  if (typeof stage === 'object' && stage.type === 'round') return { heading: `Round ${stage.index + 1}`, body: "Work through each word at your pace." }
  if (typeof stage === 'object' && stage.type === 'selfCheck') return { heading: 'Self-check', body: "Rate your recall honestly." }
  if (stage === 'exam' || stage === 'examRound' || stage === 'examCheck') return { heading: 'Recall', body: "Write from memory. No hints." }
  return { heading: 'Session done', body: "Review your score below." }
}

// ─── Sidebar card ─────────────────────────────────────────────────────────────

export function StorySidebar({ stage, deck, t }: { stage: SidebarStage; deck: Deck; t: Theme }) {
  const cardBorder = t.id === 'neutral' ? `1px solid ${t.border}` : '1px solid rgba(255,255,255,0.10)'
  const divider = t.id === 'neutral' ? `1px solid ${t.border}` : '1px solid rgba(255,255,255,0.08)'

  if (t.id === 'school') {
    const { heading, quote } = getSchoolContent(stage)
    const urgency = schoolUrgency(stage)
    const uColor = urgencyColor(urgency)
    const minsLeft = Math.round((1 - urgency) * 25)

    return (
      <div style={{ background: t.panelBg, border: cardBorder, borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ padding: '20px 16px 16px', textAlign: 'center', borderBottom: divider }}>
          <div style={{ fontSize: 48, lineHeight: 1, marginBottom: 10 }}>👩‍🏫</div>
          <div style={{ fontFamily: t.fontHead, fontSize: 15, fontWeight: 700, color: t.panelText, letterSpacing: '-0.01em' }}>Frau Richter</div>
          <div style={{ fontFamily: t.fontBody, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', color: t.pop, marginTop: 4, textTransform: 'uppercase' }}>Homework due today</div>
        </div>

        <div style={{ padding: '14px 16px', borderBottom: divider }}>
          <div style={{ fontFamily: t.fontHead, fontSize: 13, fontWeight: 700, color: t.panelText, marginBottom: 6, lineHeight: 1.3 }}>{heading}</div>
          <div style={{ fontFamily: t.fontHead, fontSize: 12.5, fontStyle: 'italic', color: t.panelMeta, lineHeight: 1.65 }}>&ldquo;{quote}&rdquo;</div>
        </div>

        <div style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontFamily: t.fontBody, fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', color: t.panelMeta }}>TIME UNTIL BELL</span>
            <span style={{ fontFamily: t.fontBody, fontSize: 12, fontWeight: 700, color: uColor }}>
              {(stage === 'result' || stage === 'exam' || stage === 'examRound' || stage === 'examCheck') ? 'In class now' : `${minsLeft} min`}
            </span>
          </div>
          <div style={{ height: 7, borderRadius: 99, background: 'rgba(255,255,255,0.10)', overflow: 'hidden' }}>
            <div style={{ width: `${urgency * 100}%`, height: '100%', borderRadius: 99, background: uColor, transition: 'width 0.6s, background 0.6s' }} />
          </div>
          {urgency >= 0.88 && stage !== 'result' && stage !== 'exam' && stage !== 'examRound' && stage !== 'examCheck' && (
            <div style={{ textAlign: 'center', fontSize: 28, lineHeight: 1, marginTop: 14 }}>⚠️</div>
          )}
        </div>
      </div>
    )
  }

  if (t.id === 'quest') {
    const { heading, body } = getQuestContent(stage, deck.name)
    const xp = questXP(stage)
    const XP_MAX = 500

    return (
      <div style={{ background: t.panelBg, border: cardBorder, borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ padding: '20px 16px 16px', textAlign: 'center', borderBottom: divider }}>
          <div style={{ fontSize: 48, lineHeight: 1, marginBottom: 10 }}>⚔️</div>
          <div style={{ fontFamily: t.fontHead, fontSize: 15, fontWeight: 700, color: t.panelText, letterSpacing: '-0.01em' }}>Quest Log</div>
          <div style={{ fontFamily: t.fontBody, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', color: t.pop, marginTop: 4, textTransform: 'uppercase' }}>Main Quest</div>
        </div>

        <div style={{ padding: '14px 16px', borderBottom: divider }}>
          <div style={{ fontFamily: t.fontHead, fontSize: 13, fontWeight: 700, color: t.panelText, marginBottom: 6, lineHeight: 1.3 }}>{heading}</div>
          <div style={{ fontFamily: t.fontBody, fontSize: 12.5, color: t.panelMeta, lineHeight: 1.65 }}>{body}</div>
        </div>

        <div style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontFamily: t.fontBody, fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', color: t.panelMeta }}>SESSION XP</span>
            <span style={{ fontFamily: t.fontBody, fontSize: 12, fontWeight: 700, color: t.pop }}>{xp} / {XP_MAX}</span>
          </div>
          <div style={{ height: 7, borderRadius: 99, background: 'rgba(255,255,255,0.10)', overflow: 'hidden' }}>
            <div style={{ width: `${(xp / XP_MAX) * 100}%`, height: '100%', borderRadius: 99, background: t.pop, transition: 'width 0.6s' }} />
          </div>
        </div>
      </div>
    )
  }

  // neutral
  const { heading, body } = getNeutralContent(stage)

  return (
    <div style={{ background: t.surface, border: cardBorder, borderRadius: 16, overflow: 'hidden' }}>
      <div style={{ padding: '16px 16px 14px', borderBottom: divider }}>
        <div style={{ fontFamily: t.fontBody, fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: t.inkFaint, marginBottom: 4 }}>Session</div>
        <div style={{ fontFamily: t.fontHead, fontSize: 14, fontWeight: 700, color: t.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{deck.name}</div>
      </div>
      <div style={{ padding: '14px 16px' }}>
        <div style={{ fontFamily: t.fontHead, fontSize: 16, fontWeight: 700, color: t.ink, marginBottom: 6 }}>{heading}</div>
        <div style={{ fontFamily: t.fontBody, fontSize: 13, color: t.inkSoft, lineHeight: 1.6 }}>{body}</div>
      </div>
    </div>
  )
}
