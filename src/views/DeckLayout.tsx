import { useState, useEffect, useRef, CSSProperties } from 'react'
import { Outlet, useParams, useNavigate, useLocation } from 'react-router-dom'
import { decksApi } from '../api/decks'
import { wordsApi } from '../api/words'
import { settingsApi } from '../api/settings'
import SessionContext from '../contexts/SessionContext'
import { useTheme } from '../contexts/ThemeContext'
import type { Deck, Settings } from '@shared/types'
import ModalShell from '../components/ModalShell'

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

          {/* Header right: settings button */}
          <div style={{
            marginLeft: isDesktop ? 0 : 'auto',
            display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
            transition: 'opacity .2s',
            ...(inSession ? { opacity: 0.4 } : {}),
          }}>
            <button
              onClick={() => setShowSettings(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 11px', borderRadius: 6,
                background: t.surface2, border: `1px solid ${t.border}`,
                color: t.inkSoft, fontSize: 12.5, fontWeight: 500,
                cursor: 'pointer', transition: 'all .15s ease',
                fontFamily: t.fontBody,
              }}
            >
              <GearIcon size={13} />
              Settings
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

function GearIcon({ size = 15, stroke = 'currentColor' }: { size?: number; stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  )
}

export function SettingsModal({ deckId, onClose }: { deckId: string; onClose: () => void }) {
  const { theme: t, setTheme } = useTheme()
  const [settings, setSettings] = useState<Settings | null>(null)
  const [saving, setSaving] = useState(false)
  const [batchSizeStr, setBatchSizeStr] = useState('')

  useEffect(() => {
    settingsApi.getDeck(deckId).then((s) => {
      setSettings(s)
      setBatchSizeStr(String(s.batchSize))
    })
  }, [deckId])

  function commitBatchSize() {
    if (!settings) return
    const clamped = Math.max(3, Math.min(50, Number(batchSizeStr) || settings.batchSize))
    setSettings({ ...settings, batchSize: clamped })
    setBatchSizeStr(String(clamped))
  }

  async function save() {
    if (!settings) return
    setSaving(true)
    await settingsApi.updateDeck(deckId, settings)
    setSaving(false)
    onClose()
  }

  const sectionLabel: CSSProperties = {
    fontFamily: t.fontBody, fontSize: 11, fontWeight: 600,
    letterSpacing: '.9px', textTransform: 'uppercase',
    color: t.inkFaint, marginBottom: 9, display: 'block',
  }
  const pill = (active: boolean): CSSProperties => ({
    padding: '9px 8px', flex: 1, border: `1.5px solid ${active ? t.pop : t.border}`,
    borderRadius: 8, fontFamily: t.fontBody, fontSize: 13, fontWeight: 500,
    cursor: 'pointer', background: active ? t.pop : 'transparent',
    color: active ? t.popInk : t.inkSoft, transition: 'all .13s',
  })
  const divider: CSSProperties = { height: 1, background: t.border, margin: '0 0' }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: t.overlay,
        backdropFilter: 'blur(3px)', zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'backdrop-in .15s ease forwards',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: t.surface, borderRadius: 14, width: 390,
          maxWidth: 'calc(100vw - 32px)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.2), 0 4px 16px rgba(0,0,0,0.07)',
          animation: 'modal-in .18s ease forwards', overflow: 'hidden',
          fontFamily: t.fontBody,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 22px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ width: 30, height: 30, background: t.popSoft, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <GearIcon size={15} stroke={t.pop} />
            </div>
            <span style={{ fontSize: 16, fontWeight: 700, color: t.ink, letterSpacing: '-.3px' }}>Settings</span>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', background: t.surface2, borderRadius: '50%',
              cursor: 'pointer', color: t.inkFaint, transition: 'all .13s', flexShrink: 0,
            }}
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="1.5" y1="1.5" x2="9.5" y2="9.5"/><line x1="9.5" y1="1.5" x2="1.5" y2="9.5"/>
            </svg>
          </button>
        </div>

        <div style={divider} />

        {/* Body */}
        <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 22 }}>

          {/* Theme */}
          <div>
            <span style={sectionLabel}>Theme</span>
            <div style={{ display: 'flex', gap: 7 }}>
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
                    value={batchSizeStr}
                    onChange={(e) => setBatchSizeStr(e.target.value)}
                    onBlur={commitBatchSize}
                    style={{
                      width: 68, padding: '9px 10px', border: `1.5px solid ${t.border}`,
                      borderRadius: 8, fontSize: 14, fontWeight: 600, textAlign: 'center',
                      color: t.ink, background: t.surface2, fontFamily: t.fontBody,
                      outline: 'none',
                    }}
                  />
                  <span style={{ fontSize: 13, color: t.inkSoft }}>words per session</span>
                </div>
              </div>

              {/* Word order */}
              <div>
                <span style={sectionLabel}>Word order</span>
                <div style={{ display: 'flex', gap: 7, marginBottom: 9 }}>
                  {(['random', 'sequential'] as const).map((order) => (
                    <button
                      key={order}
                      onClick={() => setSettings({ ...settings, batchOrder: order })}
                      style={{ ...pill(settings.batchOrder === order), flex: 'unset', padding: '9px 18px' }}
                    >
                      {order === 'random' ? 'Random' : 'Sequential'}
                    </button>
                  ))}
                </div>
                <p style={{ fontSize: 12, color: t.inkFaint, lineHeight: 1.5 }}>
                  {settings.batchOrder === 'sequential'
                    ? 'Words appear in import order (good for structured lists).'
                    : 'Words are shuffled on every session start.'}
                </p>
              </div>
            </>
          ) : (
            <p style={{ fontSize: 13, color: t.inkFaint }}>Loading…</p>
          )}
        </div>

        <div style={divider} />

        {/* Footer */}
        <div style={{ padding: '16px 22px' }}>
          <button
            onClick={save}
            disabled={saving || !settings}
            style={{
              width: '100%', padding: 12, background: t.pop, color: t.popInk,
              border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 600,
              cursor: 'pointer', transition: 'background .15s', letterSpacing: '.1px',
              fontFamily: t.fontBody, opacity: saving || !settings ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
