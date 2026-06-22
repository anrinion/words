import { useState, CSSProperties } from 'react'
import type { Word } from '@shared/types'
import { useTheme } from '../../contexts/ThemeContext'
import AudioButton from '../../components/AudioButton'

export default function Preview({
  batch,
  onContinue,
  onEditWord,
}: {
  batch: Word[]
  onContinue: () => void
  onEditWord?: (wordId: string, updates: { term: string; translation: string }) => Promise<void>
}) {
  const { theme: t } = useTheme()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTerm, setEditTerm] = useState('')
  const [editTranslation, setEditTranslation] = useState('')
  const [saving, setSaving] = useState(false)

  function startEdit(word: Word) {
    setEditingId(word.id)
    setEditTerm(word.term)
    setEditTranslation(word.translation)
  }
  function cancelEdit() { setEditingId(null) }

  async function saveEdit() {
    if (!editingId || !editTerm.trim() || !editTranslation.trim() || saving) return
    setSaving(true)
    await onEditWord?.(editingId, { term: editTerm.trim(), translation: editTranslation.trim() })
    setEditingId(null)
    setSaving(false)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); saveEdit() }
    if (e.key === 'Escape') cancelEdit()
  }

  const iconBtn: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 26, height: 26, borderRadius: 6, border: 'none',
    background: 'transparent', color: t.inkSoft, cursor: 'pointer',
    opacity: 0.35, flexShrink: 0,
  }
  const inputStyle: CSSProperties = {
    width: '100%', padding: '8px 10px', border: `1px solid ${t.border}`,
    borderRadius: 8, fontSize: 14, background: t.surface, color: t.ink,
    outline: 'none', fontFamily: t.fontBody,
  }
  const rowBg = (i: number) => i % 2 === 1 ? t.surface2 : 'transparent'

  return (
    <div style={{ padding: '18px 22px 80px', maxWidth: 680, margin: '0 auto', width: '100%' }}>
      <h2 style={{ fontSize: 23, fontWeight: 700, color: t.ink, margin: 0, fontFamily: t.fontHead }}>Warm-up</h2>
      <p style={{ fontSize: 14.5, color: t.inkSoft, margin: '6px 0 20px', fontFamily: t.fontBody }}>
        Just read through. Nothing to answer — let them settle in.
      </p>

      <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 16, overflow: 'hidden' }}>
        {batch.map((word, i) => (
          <div key={word.id} style={{ borderTop: i === 0 ? 'none' : `1px solid ${t.border}` }}>
            {editingId === word.id ? (
              <div style={{ padding: '12px 18px', background: t.surface2 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 10 }}>
                  <input
                    autoFocus value={editTerm}
                    onChange={e => setEditTerm(e.target.value)} onKeyDown={onKeyDown}
                    placeholder="Term" style={{ ...inputStyle, fontWeight: 600 }}
                    autoCapitalize="none" autoCorrect="off"
                  />
                  <input
                    value={editTranslation}
                    onChange={e => setEditTranslation(e.target.value)} onKeyDown={onKeyDown}
                    placeholder="Translation" style={inputStyle}
                    autoCapitalize="none" autoCorrect="off"
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button onClick={cancelEdit} style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.surface, color: t.ink, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: t.fontBody }}>Cancel</button>
                  <button onClick={saveEdit} disabled={saving} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: t.pop, color: t.popInk, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: t.fontBody }}>Save</button>
                </div>
              </div>
            ) : (
              <>
                {/* Main row: term | translation */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr',
                  alignItems: 'center', gap: 8, padding: '9px 18px',
                  background: rowBg(i),
                }}>
                  {/* Left: audio + term (right-aligned) */}
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                    <AudioButton wordId={word.id} type="word" />
                    <span style={{ fontSize: 15, fontWeight: 700, color: t.ink, fontFamily: t.fontBody }}>
                      {word.term}
                    </span>
                  </span>
                  {/* Right: translation + edit button */}
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 14, color: t.inkSoft, flex: 1, fontFamily: t.fontBody }}>
                      {word.translation}
                    </span>
                    {onEditWord && (
                      <button onClick={() => startEdit(word)} title="Edit" style={iconBtn}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
                        </svg>
                      </button>
                    )}
                  </span>
                </div>

                {/* Example row: target example left | translated example right */}
                {(word.example || word.exampleTranslation) && (
                  <div style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr',
                    gap: 8, padding: '0 18px 9px',
                    background: rowBg(i),
                  }}>
                    {/* Left: target-language example, right-aligned under term */}
                    <span style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', gap: 5 }}>
                      {word.example && (
                        <>
                          <AudioButton wordId={word.id} type="example" />
                          <span style={{ fontSize: 12.5, color: t.inkSoft, lineHeight: 1.5, textAlign: 'right', fontFamily: t.fontBody }}>
                            {word.example}
                          </span>
                        </>
                      )}
                    </span>
                    {/* Right: translated example, left-aligned under translation */}
                    <span style={{ fontSize: 12.5, color: t.inkFaint, lineHeight: 1.5, fontFamily: t.fontBody }}>
                      {word.exampleTranslation ?? ''}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={onContinue}
        style={{
          width: '100%', padding: 15, borderRadius: 14, border: 'none',
          background: t.pop, color: t.popInk, fontSize: 15, fontWeight: 700,
          cursor: 'pointer', fontFamily: t.fontBody, marginTop: 18,
          boxShadow: `0 2px 8px ${t.pop}46`,
        }}
      >
        I've read these →
      </button>
    </div>
  )
}
