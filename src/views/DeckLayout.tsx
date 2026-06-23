import { useState, useEffect, useRef, CSSProperties } from 'react'
import { Outlet, useParams, useNavigate, useLocation } from 'react-router-dom'
import { decksApi } from '../api/decks'
import { wordsApi } from '../api/words'
import { settingsApi } from '../api/settings'
import SessionContext from '../contexts/SessionContext'
import { useTheme } from '../contexts/ThemeContext'
import type { Theme } from '../themes'
import type { Deck, Settings } from '@shared/types'
import ModalShell from '../components/ModalShell'
import { dateHash } from '../lib/dateHash'

type DeckModal =
  | { type: 'create' }
  | { type: 'rename'; deck: Deck }
  | { type: 'delete'; deck: Deck }
  | null

type DeckStats = { total: number; mastered: number }

function useIsDesktop() {
  const [v, setV] = useState(() => window.innerWidth >= 768)
  useEffect(() => {
    const h = () => setV(window.innerWidth >= 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])
  return v
}

export default function DeckLayout() {
  const { deckId } = useParams<{ deckId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { theme: t } = useTheme()
  const isDesktop = useIsDesktop()

  const [deck, setDeck] = useState<Deck | null>(null)
  const [allDecks, setAllDecks] = useState<Deck[]>([])
  const [allDeckStats, setAllDeckStats] = useState<Record<string, DeckStats>>({})
  const [deckOpen, setDeckOpen] = useState(false)
  const [inSession, setInSession] = useState(false)
  const [modal, setModal] = useState<DeckModal>(null)
  const [stats, setStats] = useState<DeckStats | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const activeTab = location.pathname.endsWith('/words') ? 'words'
    : location.pathname.endsWith('/progress') ? 'progress'
    : 'train'

  async function loadDecks() {
    const decks = await decksApi.list()
    setAllDecks(decks)
    const found = decks.find((d) => d.id === deckId)
    if (!found) navigate('/', { replace: true })
    else setDeck(found)
    return decks
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadDecks() }, [deckId])

  useEffect(() => {
    if (!deckId) return
    wordsApi.list(deckId).then((words) => {
      setStats({ total: words.length, mastered: words.filter((w) => w.streak >= 2).length })
    })
  }, [deckId])

  useEffect(() => {
    if (allDecks.length === 0) return
    Promise.all(
      allDecks.map((d) =>
        wordsApi.list(d.id).then((words) => [
          d.id,
          { total: words.length, mastered: words.filter((w) => w.streak >= 2).length },
        ] as [string, DeckStats])
      )
    ).then((results) => setAllDeckStats(Object.fromEntries(results)))
  }, [allDecks])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDeckOpen(false)
    }
    if (deckOpen) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [deckOpen])

  async function handleCreate(name: string, targetLanguage: string, nativeLanguage: string) {
    const d = await decksApi.create({ name, targetLanguage, nativeLanguage })
    setModal(null); setDeckOpen(false)
    await loadDecks()
    navigate(`/deck/${d.id}/train`)
  }

  async function handleRename(id: string, name: string) {
    await decksApi.update(id, { name })
    setModal(null); loadDecks()
  }

  async function handleDelete(id: string) {
    await decksApi.remove(id)
    setModal(null)
    const rest = (await loadDecks()).filter((d) => d.id !== id)
    if (rest.length > 0) navigate(`/deck/${rest[0].id}/train`, { replace: true })
    else navigate('/', { replace: true })
  }

  // ─── style helpers (mirroring the Claude Design renderVals) ───────────────

  const tab = (active: boolean): CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '9px 16px', border: 'none', borderRadius: t.radius,
    cursor: 'pointer', fontFamily: t.fontBody, fontSize: 14, fontWeight: 600,
    transition: 'background .13s, color .13s',
    background: active ? t.popSoft : 'transparent',
    color: active ? t.pop : t.inkSoft,
  })

  const mobTab = (active: boolean): CSSProperties => ({
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
    padding: '7px 0', border: 'none', background: 'transparent', cursor: 'pointer',
    color: active ? t.pop : t.inkFaint, fontFamily: t.fontBody, fontSize: 11, fontWeight: 600,
    transition: 'color .13s',
  })

  if (!deck) return null

  return (
    <SessionContext.Provider value={{ inSession, setInSession }}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: t.appBg, fontFamily: t.fontBody }}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <header style={{
          flexShrink: 0, display: 'flex', alignItems: 'center', gap: 18,
          padding: isDesktop ? '7px 22px' : '14px 16px 10px',
          background: t.surface, borderBottom: `1px solid ${t.border}`,
        }}>

          {/* Deck switcher */}
          <div style={{ position: 'relative', flexShrink: 0 }} ref={dropdownRef}>
            <button
              onClick={() => setDeckOpen((v) => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 11,
                padding: '6px 13px 6px 6px', borderRadius: t.radius,
                border: `1px solid ${t.border}`, background: t.surface2,
                cursor: 'pointer', color: t.ink, fontFamily: t.fontBody, transition: 'background .15s',
              }}
            >
              <span style={{
                width: 36, height: 36, flexShrink: 0, borderRadius: t.radiusSm,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: t.pop, color: t.popInk,
                fontFamily: t.fontHead, fontSize: 13, fontWeight: 700, letterSpacing: '.02em',
              }}>
                {deck.name.slice(0, 2).toUpperCase()}
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.18, minWidth: 0 }}>
                <span style={{ fontFamily: t.fontHead, fontSize: 15, fontWeight: 600, color: t.ink, whiteSpace: 'nowrap' }}>
                  {deck.name}
                </span>
                <span style={{ fontFamily: t.fontBody, fontSize: 11.5, fontWeight: 500, color: t.inkFaint, whiteSpace: 'nowrap' }}>
                  {stats && stats.total > 0 ? `${stats.mastered} of ${stats.total} learned` : `${deck.targetLanguage} · ${deck.nativeLanguage}`}
                </span>
              </span>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" style={{ color: t.inkFaint, marginLeft: 3, flexShrink: 0 }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {deckOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 9px)', left: 0, width: 312,
                background: t.surface, border: `1px solid ${t.border}`, borderRadius: t.radius,
                boxShadow: '0 18px 44px -14px rgba(0,0,0,.4)',
                padding: 7, zIndex: 40, animation: 'drop-in .16s ease',
              }}>
                <div style={{ fontFamily: t.fontBody, fontSize: 10, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: t.inkFaint, padding: '8px 10px 6px' }}>
                  Your decks
                </div>

                {allDecks.map((d) => {
                  const cur = d.id === deckId
                  return (
                    <button
                      key={d.id}
                      onClick={() => { setDeckOpen(false); navigate(`/deck/${d.id}/train`) }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 11, width: '100%', minWidth: 0,
                        textAlign: 'left', padding: '9px 10px', border: 'none', margin: '1px 0',
                        borderRadius: t.radiusSm, cursor: 'pointer',
                        background: cur ? t.popSoft : 'transparent', transition: 'background .12s',
                      }}
                    >
                      <span style={{
                        width: 34, height: 34, flexShrink: 0, borderRadius: t.radiusSm,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: cur ? t.pop : t.surface2,
                        color: cur ? t.popInk : t.inkSoft,
                        fontFamily: t.fontHead, fontSize: 12, fontWeight: 700,
                      }}>
                        {d.name.slice(0, 2).toUpperCase()}
                      </span>
                      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.2, flex: 1, minWidth: 0 }}>
                        <span style={{ fontFamily: t.fontHead, fontSize: 14, fontWeight: 600, color: t.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                        <span style={{ fontFamily: t.fontBody, fontSize: 11.5, fontWeight: 500, color: t.inkFaint }}>
                          {allDeckStats[d.id]
                            ? `${allDeckStats[d.id].mastered} of ${allDeckStats[d.id].total} learned`
                            : `${d.targetLanguage} · ${d.nativeLanguage}`}
                        </span>
                      </span>
                      {cur && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" style={{ color: t.pop, flexShrink: 0 }}>
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                  )
                })}

                <button
                  onClick={() => { setDeckOpen(false); setModal({ type: 'create' }) }}
                  style={{
                    width: '100%', textAlign: 'left', padding: '10px 12px', marginTop: 3,
                    border: `1px dashed ${t.border}`, borderRadius: t.radiusSm,
                    background: 'transparent', color: t.inkSoft,
                    fontFamily: t.fontBody, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  +  New deck
                </button>
              </div>
            )}
          </div>

          {/* Desktop center tab nav */}
          {isDesktop && (
            <nav style={{
              display: 'flex', gap: 5, alignItems: 'center', flex: 1, justifyContent: 'center',
              transition: 'opacity .2s',
              ...(inSession ? { opacity: 0.38, pointerEvents: 'none', filter: 'grayscale(.5)' } : {}),
            }}>
              <button onClick={() => navigate(`/deck/${deckId}/words`)} style={tab(activeTab === 'words')}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" />
                  <line x1="9" y1="6" x2="20" y2="6" /><line x1="9" y1="12" x2="20" y2="12" /><line x1="9" y1="18" x2="20" y2="18" />
                </svg>
                Words
              </button>
              <button onClick={() => navigate(`/deck/${deckId}/train`)} style={tab(activeTab === 'train')}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
                  <polygon points="6 4 20 12 6 20" />
                </svg>
                Train
              </button>
              <button onClick={() => navigate(`/deck/${deckId}/progress`)} style={tab(activeTab === 'progress')}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="4" y1="20" x2="20" y2="20" />
                  <line x1="7" y1="20" x2="7" y2="13" />
                  <line x1="12" y1="20" x2="12" y2="8" />
                  <line x1="17" y1="20" x2="17" y2="11" />
                </svg>
                Progress
              </button>
            </nav>
          )}

          {/* Header right: progress badge + theme switcher */}
          <div style={{
            marginLeft: isDesktop ? 0 : 'auto',
            display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
            transition: 'opacity .2s',
            ...(inSession ? { opacity: 0.4 } : {}),
          }}>
            {isDesktop && stats && stats.total > 0 && (
              <ProgressBadge stats={stats} t={t} />
            )}
            <button
              onClick={() => setShowSettings(true)}
              style={{ ...tab(false), padding: '9px 12px' }}
              title="Settings"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
              </svg>
            </button>
          </div>
        </header>

        {/* ── Content ─────────────────────────────────────────────────────── */}
        <main style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          <Outlet context={deck} />
        </main>

        {/* ── Mobile bottom tab bar (hidden on desktop + during session) ─── */}
        {!isDesktop && !inSession && (
          <nav style={{
            flexShrink: 0, display: 'flex',
            background: t.surface, borderTop: `1px solid ${t.border}`,
            paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
          }}>
            <button onClick={() => navigate(`/deck/${deckId}/words`)} style={mobTab(activeTab === 'words')}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" />
                <line x1="9" y1="6" x2="20" y2="6" /><line x1="9" y1="12" x2="20" y2="12" /><line x1="9" y1="18" x2="20" y2="18" />
              </svg>
              Words
            </button>
            <button onClick={() => navigate(`/deck/${deckId}/train`)} style={mobTab(activeTab === 'train')}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
                <polygon points="6 4 20 12 6 20" />
              </svg>
              Train
            </button>
            <button onClick={() => navigate(`/deck/${deckId}/progress`)} style={mobTab(activeTab === 'progress')}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="4" y1="20" x2="20" y2="20" />
                <line x1="7" y1="20" x2="7" y2="13" />
                <line x1="12" y1="20" x2="12" y2="8" />
                <line x1="17" y1="20" x2="17" y2="11" />
              </svg>
              Progress
            </button>
          </nav>
        )}

        {/* ── Modals ──────────────────────────────────────────────────────── */}
        {modal?.type === 'create' && <CreateDeckModal onConfirm={handleCreate} onCancel={() => setModal(null)} />}
        {modal?.type === 'rename' && (
          <RenameDeckModal deck={modal.deck} onConfirm={(name) => handleRename(modal.deck.id, name)} onCancel={() => setModal(null)} />
        )}
        {modal?.type === 'delete' && (
          <DeleteDeckModal deck={modal.deck} onConfirm={() => handleDelete(modal.deck.id)} onCancel={() => setModal(null)} />
        )}
        {showSettings && (
          <SettingsModal deckId={deckId!} onClose={() => setShowSettings(false)} />
        )}
      </div>
    </SessionContext.Provider>
  )
}

// ── Progress badge (header top-right) ────────────────────────────────────────

function ProgressBadge({ stats, t }: { stats: DeckStats; t: Theme }) {
  const pct = Math.round((stats.mastered / Math.max(1, stats.total)) * 100)
  const pillBase: CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 10,
    borderRadius: 999, border: `1px solid ${t.border}`, background: t.surface2,
  }

  if (t.id === 'quest') {
    const level = Math.max(1, Math.floor((stats.mastered / Math.max(1, stats.total)) * 10) + 1)
    const xp = stats.mastered * 50
    const xpNext = level * 300
    const xpPct = Math.min(100, Math.round((xp % xpNext) / xpNext * 100))
    return (
      <div style={{ ...pillBase, padding: '7px 14px 7px 7px' }}>
        <span style={{ padding: '5px 9px', borderRadius: 7, background: t.pop, color: t.popInk, fontFamily: t.fontHead, fontSize: 12, fontWeight: 700 }}>
          Lv {level}
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 96 }}>
          <div style={{ height: 5, borderRadius: 999, background: t.border, overflow: 'hidden' }}>
            <div style={{ width: `${xpPct}%`, height: '100%', background: t.pop, borderRadius: 999 }} />
          </div>
          <span style={{ fontFamily: t.fontBody, fontSize: 10.5, fontWeight: 600, color: t.inkFaint, letterSpacing: '.02em' }}>
            {xp.toLocaleString()} / {xpNext.toLocaleString()} XP
          </span>
        </div>
      </div>
    )
  }

  if (t.id === 'school') {
    const h = (dateHash(3) % 2)
    const m = (dateHash(4) % 59) + 1
    const countdown = `${h > 0 ? h + ':' : ''}${String(m).padStart(2, '0')}:${String(dateHash(5) % 59).padStart(2, '0')}`
    return (
      <div style={{ ...pillBase, padding: '6px 14px 6px 6px' }}>
        <span style={{
          width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: t.pop, color: t.popInk, fontFamily: t.fontBody, fontSize: 13, fontWeight: 700,
        }}>FR</span>
        <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
          <span style={{ fontFamily: t.fontBody, fontSize: 10, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: t.inkFaint }}>Next lesson</span>
          <span style={{ fontFamily: t.fontHead, fontSize: 14, fontWeight: 600, color: t.pop }}>in {countdown}</span>
        </span>
      </div>
    )
  }

  // neutral
  return (
    <div style={{ ...pillBase, padding: '8px 14px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontFamily: t.fontBody, fontSize: 12.5, fontWeight: 600, color: t.ink, whiteSpace: 'nowrap' }}>
          {stats.mastered} / {stats.total}
        </span>
        <div style={{ width: 96, height: 5, borderRadius: 999, background: t.border, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: t.pop, borderRadius: 999 }} />
        </div>
      </div>
    </div>
  )
}

function CreateDeckModal({ onConfirm, onCancel }: { onConfirm: (n: string, t: string, l: string) => void; onCancel: () => void }) {
  const { theme: t } = useTheme()
  const [name, setName] = useState('')
  const [target, setTarget] = useState('')
  const [native, setNative] = useState('')
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => ref.current?.focus(), [])

  function submit() { if (name.trim() && target.trim() && native.trim()) onConfirm(name.trim(), target.trim(), native.trim()) }
  function onEnter(e: React.KeyboardEvent) { if (e.key === 'Enter') { e.preventDefault(); submit() } }

  const labelStyle: CSSProperties = { display: 'block', fontFamily: t.fontBody, fontSize: 13, color: t.inkSoft, marginBottom: 5 }
  const valid = name.trim() && target.trim() && native.trim()

  return (
    <ModalShell title="New deck" onClose={onCancel}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div><label style={labelStyle}>Deck name</label><input ref={ref} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={onEnter} placeholder="e.g. German B1 exam" className="input" /></div>
        <div><label style={labelStyle}>Language you're learning</label><input value={target} onChange={(e) => setTarget(e.target.value)} onKeyDown={onEnter} placeholder="e.g. de or German" className="input" /></div>
        <div><label style={labelStyle}>Your native language</label><input value={native} onChange={(e) => setNative(e.target.value)} onKeyDown={onEnter} placeholder="e.g. en or English" className="input" /></div>
        <button onClick={submit} className="btn-primary w-full" style={{ opacity: valid ? 1 : 0.4, pointerEvents: valid ? 'auto' : 'none' }}>Create deck</button>
      </div>
    </ModalShell>
  )
}

function RenameDeckModal({ deck, onConfirm, onCancel }: { deck: Deck; onConfirm: (name: string) => void; onCancel: () => void }) {
  const [name, setName] = useState(deck.name)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { ref.current?.focus(); ref.current?.select() }, [])
  function submit() { if (name.trim()) onConfirm(name.trim()) }
  return (
    <ModalShell title="Rename deck" onClose={onCancel}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input ref={ref} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit() } }} className="input" />
        <button onClick={submit} className="btn-primary w-full" style={{ opacity: name.trim() ? 1 : 0.4, pointerEvents: name.trim() ? 'auto' : 'none' }}>Save</button>
      </div>
    </ModalShell>
  )
}

function DeleteDeckModal({ deck, onConfirm, onCancel }: { deck: Deck; onConfirm: () => void; onCancel: () => void }) {
  const { theme: t } = useTheme()
  return (
    <ModalShell title="Delete deck?" onClose={onCancel}>
      <p style={{ fontFamily: t.fontBody, fontSize: 14, color: t.inkSoft, marginBottom: 16, lineHeight: 1.5 }}>
        This will permanently delete <strong style={{ color: t.ink }}>{deck.name}</strong> and all its words and session history.
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
        <button onClick={onConfirm} style={{ flex: 1, padding: '8px 16px', background: t.danger, color: t.dangerInk, borderRadius: t.radius, border: 'none', fontFamily: t.fontBody, fontWeight: 600, cursor: 'pointer' }}>Delete</button>
      </div>
    </ModalShell>
  )
}

function SettingsModal({ deckId, onClose }: { deckId: string; onClose: () => void }) {
  const { theme: t, setTheme } = useTheme()
  const [settings, setSettings] = useState<Settings | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { settingsApi.getDeck(deckId).then(setSettings) }, [deckId])

  async function save() {
    if (!settings) return
    setSaving(true)
    await settingsApi.updateDeck(deckId, settings)
    setSaving(false)
    onClose()
  }

  const sectionLabel: CSSProperties = { fontFamily: t.fontBody, fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: t.inkFaint, marginBottom: 8, display: 'block' }
  const pill = (active: boolean): CSSProperties => ({
    padding: '6px 14px', border: `1px solid ${active ? t.pop : t.border}`, borderRadius: t.radiusSm,
    fontFamily: t.fontBody, fontSize: 13, fontWeight: 600, cursor: 'pointer',
    background: active ? t.popSoft : t.surface2, color: active ? t.pop : t.inkSoft,
    transition: 'all .13s',
  })

  return (
    <ModalShell title="Settings" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Theme */}
        <div>
          <span style={sectionLabel}>Theme</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['neutral', 'school', 'quest'] as const).map((id) => (
              <button key={id} onClick={() => setTheme(id)} style={pill(t.id === id)}>
                {id === 'neutral' ? 'Neutral' : id === 'school' ? 'School' : 'Quest'}
              </button>
            ))}
          </div>
        </div>

        {settings ? (
          <>
            {/* Batch size */}
            <div>
              <span style={sectionLabel}>Batch size</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="number"
                  min={3}
                  max={50}
                  value={settings.batchSize}
                  onChange={(e) => setSettings({ ...settings, batchSize: Math.max(3, Math.min(50, Number(e.target.value))) })}
                  className="input"
                  style={{ width: 80, textAlign: 'center' }}
                />
                <span style={{ fontFamily: t.fontBody, fontSize: 13, color: t.inkSoft }}>words per session</span>
              </div>
            </div>

            {/* Word order */}
            <div>
              <span style={sectionLabel}>Word order</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['random', 'sequential'] as const).map((order) => (
                  <button
                    key={order}
                    onClick={() => setSettings({ ...settings, batchOrder: order })}
                    style={pill(settings.batchOrder === order)}
                  >
                    {order === 'random' ? 'Random' : 'Sequential'}
                  </button>
                ))}
              </div>
              <p style={{ fontFamily: t.fontBody, fontSize: 12, color: t.inkFaint, marginTop: 6 }}>
                {settings.batchOrder === 'sequential'
                  ? 'Words appear in import order (good for structured lists).'
                  : 'Words are shuffled on every session start.'}
              </p>
            </div>
          </>
        ) : (
          <p style={{ fontFamily: t.fontBody, fontSize: 13, color: t.inkFaint }}>Loading…</p>
        )}

        <button onClick={save} disabled={saving || !settings} className="btn-primary w-full">
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </ModalShell>
  )
}
