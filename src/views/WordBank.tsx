import { useEffect, useState, useRef, CSSProperties } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { wordsApi } from "../api/words";
import { decksApi } from "../api/decks";
import type { Deck, Word, ParsedWord, ImportResult } from "@shared/types";
import { textPasteAdapter } from "../importAdapters/textPaste";
import { fileAdapter } from "../importAdapters/file";
import { ankiPackageAdapter } from "../importAdapters/ankiPackage";
import { cameraAdapter } from "../importAdapters/camera";
import type { ImportAdapter } from "../importAdapters/types";
import AudioButton from "../components/AudioButton";
import { useTheme } from "../contexts/ThemeContext";
import type { Theme } from "../themes";
import ModalShell from "../components/ModalShell";

const ADAPTERS: ImportAdapter[] = [
    textPasteAdapter,
    fileAdapter,
    ankiPackageAdapter,
    cameraAdapter,
];

// ── Status helpers ────────────────────────────────────────────────────────────

type WordStatus = "new" | "problematic" | "learned";

function statusMeta(t: Theme): Record<WordStatus, { color: string; label: string }> {
    return {
        new:         { color: t.statusNew,      label: "New" },
        problematic: { color: t.statusWeak,     label: "Problematic" },
        learned:     { color: t.statusMastered, label: "Learned" },
    };
}

function getStatus(word: Word): WordStatus {
    if (word.streak >= 2) return "learned";
    if (word.weak === 1) return "problematic";
    return "new";
}

function statusToFields(status: WordStatus): { streak: number; weak: number } {
    if (status === "learned") return { streak: 2, weak: 0 };
    if (status === "problematic") return { streak: 0, weak: 1 };
    return { streak: 0, weak: 0 };
}

type SortKey = "az" | "status" | "recent";
type FilterKey = "all" | WordStatus;
const SORT_LABELS: Record<SortKey, string> = { az: "A–Z", status: "By status", recent: "Recently added" };

// ── Main component ────────────────────────────────────────────────────────────

export default function WordBank() {
    const deck = useOutletContext<Deck>();
    const navigate = useNavigate();
    const { theme: t } = useTheme();
    const [words, setWords] = useState<Word[]>([]);
    const [importResult, setImportResult] = useState<ImportResult | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showImport, setShowImport] = useState(false);
    const [showDeleteDeck, setShowDeleteDeck] = useState(false);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState("");
    const [filter, setFilter] = useState<FilterKey>("all");
    const [sort, setSort] = useState<SortKey>("az");
    const [sortMenuOpen, setSortMenuOpen] = useState(false);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [statusMenuId, setStatusMenuId] = useState<string | null>(null);
    const [toast, setToast] = useState<{ text: string; undo?: () => void } | null>(null);
    const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Maps wordId → setTimeout handle for deferred API deletes (undo support)
    const deleteTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

    async function load() {
        const data = await wordsApi.list(deck.id);
        setWords(data);
        setLoading(false);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { load(); }, [deck.id]);

    useEffect(() => {
        if (!statusMenuId && !sortMenuOpen) return;
        function handler() { setStatusMenuId(null); setSortMenuOpen(false); }
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [statusMenuId, sortMenuOpen]);

    function showToast(text: string, undo?: () => void) {
        if (toastTimer.current) clearTimeout(toastTimer.current);
        setToast({ text, undo });
        toastTimer.current = setTimeout(() => setToast(null), 4500);
    }

    function handleDelete(word: Word) {
        // Optimistic remove; defer actual API call so Undo can cancel it
        setWords(prev => prev.filter(w => w.id !== word.id));
        setEditingId(id => id === word.id ? null : id);

        const timer = setTimeout(async () => {
            deleteTimers.current.delete(word.id);
            await wordsApi.remove(deck.id, word.id);
        }, 4500);
        deleteTimers.current.set(word.id, timer);

        showToast(`"${word.term}" deleted`, () => {
            const t = deleteTimers.current.get(word.id);
            if (t) { clearTimeout(t); deleteTimers.current.delete(word.id); }
            setWords(prev => [word, ...prev]);
            setToast(null);
        });
    }

    async function handleDeleteDeck() {
        await decksApi.remove(deck.id);
        navigate("/", { replace: true });
    }

    async function handleSetStatus(word: Word, status: WordStatus) {
        setStatusMenuId(null);
        const fields = statusToFields(status);
        await wordsApi.update(deck.id, word.id, fields);
        setWords(prev => prev.map(w => w.id === word.id ? { ...w, ...fields } : w));
    }

    async function handleSaveEdit(wordId: string, body: Partial<ParsedWord>, status: WordStatus) {
        const fields = statusToFields(status);
        await wordsApi.update(deck.id, wordId, { ...body, ...fields });
        setEditingId(null);
        load();
    }

    async function handleCreate(body: ParsedWord, status: WordStatus) {
        const word = await wordsApi.create(deck.id, body);
        if (status !== "new") {
            await wordsApi.update(deck.id, word.id, statusToFields(status));
        }
        setEditingId(null);
        load();
    }

    async function runAdapter(adapter: ImportAdapter) {
        setShowImport(false);
        const result = await adapter.run();
        if (!result) return;
        const importRes = await wordsApi.import(deck.id, {
            words: result.words,
            rejected: result.rejected,
        });
        setImportResult(importRes);
        load();
    }

    function toggleExpand(id: string) {
        setExpanded(prev => {
            const s = new Set(prev);
            if (s.has(id)) s.delete(id); else s.add(id);
            return s;
        });
    }

    function toggleExpandAll() {
        const withEx = words.filter(w => w.example);
        const allOpen = withEx.length > 0 && withEx.every(w => expanded.has(w.id));
        setExpanded(allOpen ? new Set() : new Set(withEx.map(w => w.id)));
    }

    // ── Derived list ──────────────────────────────────────────────────────────

    const counts = { all: words.length, new: 0, problematic: 0, learned: 0 };
    words.forEach(w => { counts[getStatus(w)]++; });

    let list = words.slice();
    if (filter !== "all") list = list.filter(w => getStatus(w) === filter);
    const q = query.trim().toLowerCase();
    if (q) list = list.filter(w =>
        [w.term, w.translation, w.example ?? "", w.exampleTranslation ?? ""]
            .join(" ").toLowerCase().includes(q)
    );
    if (sort === "az") list.sort((a, b) => a.term.localeCompare(b.term));
    else if (sort === "status") {
        const ord: Record<WordStatus, number> = { problematic: 0, new: 1, learned: 2 };
        list.sort((a, b) => (ord[getStatus(a)] - ord[getStatus(b)]) || a.term.localeCompare(b.term));
    } else {
        list.sort((a, b) => b.createdAt - a.createdAt);
    }

    const wordsWithEx = words.filter(w => w.example);
    const allExpanded = wordsWithEx.length > 0 && wordsWithEx.every(w => expanded.has(w.id));

    // ── Style helpers ─────────────────────────────────────────────────────────

    const filterChip = (active: boolean): CSSProperties => ({
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "6px 11px", borderRadius: 9, fontSize: 13, fontWeight: 600,
        cursor: "pointer", whiteSpace: "nowrap", border: "none",
        background: active ? t.pop : t.surface2,
        color: active ? t.popInk : t.ink,
    });

    const sortItem = (active: boolean): CSSProperties => ({
        display: "block", width: "100%", textAlign: "left",
        padding: "7px 10px", border: "none", background: "transparent",
        borderRadius: 7, fontSize: 13, fontWeight: active ? 700 : 500,
        color: active ? t.pop : t.ink, cursor: "pointer", fontFamily: t.fontBody,
    });

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div style={{ padding: "24px 22px 80px", maxWidth: 1060, margin: "0 auto" }}>

            {/* Toolbar row 1 */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <button
                    onClick={() => setShowImport(true)}
                    style={{
                        display: "inline-flex", alignItems: "center", gap: 8,
                        padding: "9px 16px", borderRadius: t.radius, border: "none",
                        background: t.pop, color: t.popInk,
                        fontSize: 14, fontWeight: 600, cursor: "pointer",
                        fontFamily: t.fontBody,
                    }}
                >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 16V3M7 8l5-5 5 5M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" />
                    </svg>
                    Import
                </button>
                <button
                    onClick={() => { setEditingId("new"); setSortMenuOpen(false); setStatusMenuId(null); }}
                    style={{
                        display: "inline-flex", alignItems: "center", gap: 7,
                        padding: "9px 15px", borderRadius: t.radius,
                        border: `1px solid ${t.border}`, background: t.surface,
                        color: t.ink, fontSize: 14, fontWeight: 600, cursor: "pointer",
                        fontFamily: t.fontBody,
                    }}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 5v14M5 12h14" />
                    </svg>
                    Add word
                </button>
                <div style={{ flex: 1 }} />
                <button
                    onClick={() => setShowDeleteDeck(true)}
                    style={{
                        display: "inline-flex", alignItems: "center", gap: 7,
                        padding: "9px 13px", border: "none", background: "transparent",
                        color: t.danger, fontSize: 13.5, fontWeight: 600, cursor: "pointer",
                        borderRadius: t.radius, fontFamily: t.fontBody,
                    }}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    </svg>
                    Delete deck
                </button>
            </div>

            {/* Import result banner */}
            {importResult && (
                <ImportResultBanner result={importResult} onDismiss={() => setImportResult(null)} />
            )}

            {/* Toolbar row 2: search + filters */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
                <div style={{ position: "relative", width: 300, maxWidth: "46vw" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.inkFaint} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"
                        style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                        <circle cx="11" cy="11" r="7" /><path d="M21 21l-3.6-3.6" />
                    </svg>
                    <input
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Search words, translations, examples…"
                        style={{
                            width: "100%", padding: "9px 12px 9px 35px",
                            borderRadius: t.radius, border: `1px solid ${t.border}`,
                            background: t.surface, fontSize: 14, color: t.ink,
                            outline: "none", fontFamily: t.fontBody,
                        }}
                    />
                </div>
                <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                    {(["all", "new", "problematic", "learned"] as FilterKey[]).map(f => {
                        const sm = statusMeta(t);
                        return (
                            <button key={f} onClick={() => setFilter(f)} style={filterChip(filter === f)}>
                                {f !== "all" && (
                                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: sm[f as WordStatus].color, flexShrink: 0 }} />
                                )}
                                {f === "all" ? "All" : sm[f as WordStatus].label}
                                <span style={{ opacity: 0.65, fontWeight: 500, marginLeft: 3 }}>{counts[f]}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* List card */}
            <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: t.radius }}>

                {/* Subheader */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 16px" }}>
                    <span style={{ fontSize: 13, color: t.inkSoft, fontWeight: 500, fontFamily: t.fontBody }}>
                        {list.length === words.length
                            ? `${words.length} ${words.length === 1 ? "word" : "words"}`
                            : `${list.length} of ${words.length} words`}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                        {wordsWithEx.length > 0 && (
                            <button
                                onClick={toggleExpandAll}
                                style={{ background: "none", border: "none", color: t.pop, fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0, fontFamily: t.fontBody }}
                            >
                                {allExpanded ? "Collapse all" : "Expand all"}
                            </button>
                        )}
                        <div style={{ position: "relative" }}>
                            <button
                                onClick={e => { e.stopPropagation(); setSortMenuOpen(v => !v); setStatusMenuId(null); }}
                                style={{
                                    display: "inline-flex", alignItems: "center", gap: 6,
                                    background: "transparent", border: `1px solid ${t.border}`,
                                    borderRadius: t.radiusSm, padding: "5px 11px",
                                    fontSize: 13, fontWeight: 500, color: t.ink,
                                    cursor: "pointer", fontFamily: t.fontBody,
                                }}
                            >
                                Sort: {SORT_LABELS[sort]}
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M6 9l6 6 6-6" />
                                </svg>
                            </button>
                            {sortMenuOpen && (
                                <div
                                    onMouseDown={e => e.stopPropagation()}
                                    style={{
                                        position: "absolute", right: 0, top: 36, zIndex: 40,
                                        background: t.surface, border: `1px solid ${t.border}`,
                                        borderRadius: t.radiusSm, boxShadow: "0 10px 30px rgba(0,0,0,.13)",
                                        padding: 5, minWidth: 170,
                                        animation: "fadein .12s ease",
                                    }}
                                >
                                    {(["az", "status", "recent"] as SortKey[]).map(s => (
                                        <button key={s} onClick={() => { setSort(s); setSortMenuOpen(false); }} style={sortItem(sort === s)}>
                                            {SORT_LABELS[s]}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Skeleton */}
                {loading && Array.from({ length: 9 }).map((_, i) => <SkeletonRow key={i} t={t} />)}

                {/* Rows */}
                {!loading && (
                    <>
                        {editingId === "new" && (
                            <WordEditRow
                                word={null}
                                onSave={(body, status) => handleCreate(body as ParsedWord, status)}
                                onCancel={() => setEditingId(null)}
                                t={t}
                            />
                        )}

                        {list.map(word => (
                            <div key={word.id} style={{ borderTop: `1px solid ${t.border}`, position: "relative" }}>
                                {editingId === word.id ? (
                                    <WordEditRow
                                        word={word}
                                        onSave={(body, status) => handleSaveEdit(word.id, body, status)}
                                        onCancel={() => setEditingId(null)}
                                        t={t}
                                    />
                                ) : (
                                    <WordViewRow
                                        word={word}
                                        expanded={expanded.has(word.id)}
                                        statusMenuOpen={statusMenuId === word.id}
                                        onToggleExpand={() => toggleExpand(word.id)}
                                        onToggleStatus={e => {
                                            e.stopPropagation();
                                            setStatusMenuId(prev => prev === word.id ? null : word.id);
                                            setSortMenuOpen(false);
                                        }}
                                        onSetStatus={status => handleSetStatus(word, status)}
                                        onEdit={() => { setEditingId(word.id); setStatusMenuId(null); }}
                                        onDelete={() => handleDelete(word)}
                                        t={t}
                                    />
                                )}
                            </div>
                        ))}

                        {/* Empty state */}
                        {list.length === 0 && editingId !== "new" && (
                            <div style={{
                                display: "flex", flexDirection: "column",
                                alignItems: "center", justifyContent: "center",
                                textAlign: "center", padding: "64px 24px",
                                borderTop: `1px solid ${t.border}`,
                            }}>
                                <div style={{
                                    width: 46, height: 46, borderRadius: 13,
                                    background: t.surface2, display: "flex",
                                    alignItems: "center", justifyContent: "center",
                                    color: t.inkSoft, marginBottom: 14,
                                }}>
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                                    </svg>
                                </div>
                                <div style={{ fontSize: 15.5, fontWeight: 700, color: t.ink, fontFamily: t.fontHead }}>
                                    {words.length === 0 ? "This deck is empty" : "No matching words"}
                                </div>
                                <div style={{ fontSize: 13.5, color: t.inkSoft, marginTop: 5, maxWidth: 300, lineHeight: 1.5, fontFamily: t.fontBody }}>
                                    {words.length === 0
                                        ? "Import a word list or add your first word to get started."
                                        : "Try a different search term or status filter."}
                                </div>
                                {words.length > 0 && (filter !== "all" || q) && (
                                    <button
                                        onClick={() => { setFilter("all"); setQuery(""); }}
                                        style={{
                                            marginTop: 16, padding: "8px 16px", borderRadius: t.radius,
                                            border: `1px solid ${t.border}`, background: t.surface,
                                            color: t.ink, fontSize: 13.5, fontWeight: 600,
                                            cursor: "pointer", fontFamily: t.fontBody,
                                        }}
                                    >
                                        Clear filters
                                    </button>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Overlay backdrop for menus */}
            {(statusMenuId != null || sortMenuOpen) && (
                <div
                    onClick={() => { setStatusMenuId(null); setSortMenuOpen(false); }}
                    style={{ position: "fixed", inset: 0, zIndex: 30 }}
                />
            )}

            {/* Import modal */}
            {showImport && (
                <ModalShell onClose={() => setShowImport(false)} maxWidth={480}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 18 }}>
                        <div>
                            <div style={{ fontSize: 17, fontWeight: 700, color: t.ink, fontFamily: t.fontHead }}>Import words</div>
                            <div style={{ fontSize: 13, color: t.inkSoft, marginTop: 4, fontFamily: t.fontBody }}>Choose an import method</div>
                        </div>
                        <button
                            onClick={() => setShowImport(false)}
                            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: t.radiusSm, border: "none", background: t.surface2, color: t.inkSoft, cursor: "pointer", flexShrink: 0 }}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                        </button>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {ADAPTERS.map(adapter => (
                            <button
                                key={adapter.id}
                                onClick={() => runAdapter(adapter)}
                                style={{
                                    textAlign: "left", padding: "12px 16px",
                                    borderRadius: t.radiusSm, border: `1px solid ${t.border}`,
                                    background: t.surface2, cursor: "pointer",
                                    fontFamily: t.fontBody,
                                }}
                            >
                                <div style={{ fontSize: 14, fontWeight: 600, color: t.ink }}>{adapter.name}</div>
                                <div style={{ fontSize: 12, color: t.inkSoft, marginTop: 2 }}>{adapter.description}</div>
                            </button>
                        ))}
                    </div>
                </ModalShell>
            )}

            {/* Delete deck modal */}
            {showDeleteDeck && (
                <ModalShell onClose={() => setShowDeleteDeck(false)} maxWidth={420}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: t.dangerSoft, display: "flex", alignItems: "center", justifyContent: "center", color: t.danger, marginBottom: 14 }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        </svg>
                    </div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: t.ink, fontFamily: t.fontHead }}>Delete this deck?</div>
                    <div style={{ fontSize: 13.5, color: t.inkSoft, marginTop: 6, lineHeight: 1.55, fontFamily: t.fontBody }}>
                        This permanently removes "{deck.name}" and all {words.length} words. This action can't be undone.
                    </div>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, marginTop: 20 }}>
                        <button
                            onClick={() => setShowDeleteDeck(false)}
                            style={{ padding: "9px 16px", borderRadius: t.radius, border: `1px solid ${t.border}`, background: t.surface, color: t.ink, fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: t.fontBody }}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleDeleteDeck}
                            style={{ padding: "9px 16px", borderRadius: t.radius, border: "none", background: t.danger, color: t.popInk, fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: t.fontBody }}
                        >
                            Delete deck
                        </button>
                    </div>
                </ModalShell>
            )}

            {/* Toast */}
            {toast && (
                <div style={{
                    position: "fixed", left: "50%", bottom: 26, transform: "translateX(-50%)",
                    zIndex: 60, display: "flex", alignItems: "center", gap: 16,
                    padding: "11px 14px 11px 18px", background: t.toastBg, color: t.toastInk,
                    borderRadius: 11, boxShadow: "0 12px 36px rgba(0,0,0,.3)",
                    fontSize: 13.5, fontFamily: t.fontBody, animation: "fadein .16s ease",
                    whiteSpace: "nowrap",
                }}>
                    <span>{toast.text}</span>
                    {toast.undo && (
                        <button onClick={toast.undo} style={{ background: "none", border: "none", color: t.toastAction, fontSize: 13.5, fontWeight: 700, cursor: "pointer", padding: 0, fontFamily: t.fontBody }}>
                            Undo
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

// ── Skeleton row ──────────────────────────────────────────────────────────────

function SkeletonRow({ t }: { t: Theme }) {
    const shimmerBase: CSSProperties = {
        borderRadius: 6,
        background: `linear-gradient(90deg, ${t.surface2} 25%, ${t.border} 37%, ${t.surface2} 63%)`,
        backgroundSize: "800px 100%",
        animation: "shimmer 1.4s infinite linear",
    };
    return (
        <div style={{
            display: "grid", gridTemplateColumns: "26px 210px 1fr",
            alignItems: "center", columnGap: 14,
            padding: "0 16px", height: 46, borderTop: `1px solid ${t.border}`,
        }}>
            <div style={{ width: 9, height: 9, borderRadius: "50%", ...shimmerBase }} />
            <div style={{ height: 12, width: "72%", ...shimmerBase }} />
            <div style={{ height: 12, width: "42%", ...shimmerBase }} />
        </div>
    );
}

// ── Word view row ─────────────────────────────────────────────────────────────

function WordViewRow({
    word, expanded, statusMenuOpen,
    onToggleExpand, onToggleStatus, onSetStatus, onEdit, onDelete, t,
}: {
    word: Word;
    expanded: boolean;
    statusMenuOpen: boolean;
    onToggleExpand: () => void;
    onToggleStatus: (e: React.MouseEvent) => void;
    onSetStatus: (s: WordStatus) => void;
    onEdit: () => void;
    onDelete: () => void;
    t: Theme;
}) {
    const SM = statusMeta(t);
    const m = SM[getStatus(word)];

    const iconBtn: CSSProperties = {
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 28, height: 28, borderRadius: t.radiusSm,
        border: "none", background: "transparent",
        cursor: "pointer",
    };

    return (
        <>
            <div style={{
                display: "grid",
                gridTemplateColumns: "26px minmax(110px,230px) 1fr auto",
                alignItems: "center", columnGap: 14,
                padding: "0 14px", minHeight: 46,
            }}>
                {/* Status dot + menu */}
                <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <button
                        onClick={onToggleStatus}
                        title="Change status"
                        style={{
                            width: 10, height: 10, borderRadius: "50%",
                            background: m.color, boxShadow: `0 0 0 3px ${m.color}26`,
                            border: "none", padding: 0, cursor: "pointer", flexShrink: 0,
                        }}
                    />
                    {statusMenuOpen && (
                        <div
                            onMouseDown={e => e.stopPropagation()}
                            style={{
                                position: "absolute", left: 0, top: 18, zIndex: 41,
                                background: t.surface, border: `1px solid ${t.border}`,
                                borderRadius: t.radius, boxShadow: "0 10px 30px rgba(0,0,0,.14)",
                                padding: 5, minWidth: 158,
                                animation: "fadein .12s ease",
                            }}
                        >
                            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: t.inkFaint, padding: "5px 9px 4px", fontFamily: t.fontBody }}>
                                Set status
                            </div>
                            {(["new", "problematic", "learned"] as WordStatus[]).map(s => (
                                <button
                                    key={s}
                                    onClick={() => onSetStatus(s)}
                                    style={{
                                        display: "flex", alignItems: "center", gap: 9,
                                        width: "100%", padding: "7px 9px", border: "none",
                                        background: "transparent", borderRadius: 7,
                                        fontSize: 13, color: t.ink, cursor: "pointer",
                                        textAlign: "left", fontFamily: t.fontBody,
                                    }}
                                >
                                    <span style={{ width: 9, height: 9, borderRadius: "50%", background: SM[s].color, flexShrink: 0 }} />
                                    {SM[s].label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Term + audio */}
                <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                    <span style={{ fontWeight: 600, fontSize: 14.5, color: t.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {word.term}
                    </span>
                    <AudioButton wordId={word.id} type="word" />
                </div>

                {/* Translation */}
                <span style={{ fontSize: 14, color: t.inkSoft, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {word.translation}
                </span>

                {/* Actions */}
                <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                    {word.example && (
                        <button
                            onClick={onToggleExpand}
                            title={expanded ? "Hide example" : "Show example"}
                            style={{ ...iconBtn, color: t.inkSoft, opacity: 0.6, transform: expanded ? "rotate(180deg)" : "none", transition: "transform .15s" }}
                        >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M6 9l6 6 6-6" />
                            </svg>
                        </button>
                    )}
                    <button onClick={onEdit} title="Edit" style={{ ...iconBtn, color: t.inkSoft, opacity: 0.5 }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
                        </svg>
                    </button>
                    <button onClick={onDelete} title="Delete" style={{ ...iconBtn, color: t.inkSoft, opacity: 0.5 }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Expanded example */}
            {expanded && word.example && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: "0 16px 12px 56px", animation: "fadein .15s ease" }}>
                    <AudioButton wordId={word.id} type="example" />
                    <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 14, color: t.ink, opacity: 0.82, lineHeight: 1.5, fontFamily: t.fontBody }}>{word.example}</div>
                        {word.exampleTranslation && (
                            <div style={{ fontSize: 13.5, color: t.inkSoft, lineHeight: 1.5, marginTop: 1, fontFamily: t.fontBody }}>{word.exampleTranslation}</div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}

// ── Word edit row ─────────────────────────────────────────────────────────────

function WordEditRow({
    word, onSave, onCancel, t,
}: {
    word: Word | null;
    onSave: (body: Partial<ParsedWord>, status: WordStatus) => Promise<void>;
    onCancel: () => void;
    t: Theme;
}) {
    const [term, setTerm] = useState(word?.term ?? "");
    const [translation, setTranslation] = useState(word?.translation ?? "");
    const [example, setExample] = useState(word?.example ?? "");
    const [exampleTranslation, setExampleTranslation] = useState(word?.exampleTranslation ?? "");
    const [levelTag, setLevelTag] = useState(word?.levelTag ?? "");
    const [categoryTag, setCategoryTag] = useState(word?.categoryTag ?? "");
    const [notes, setNotes] = useState(word?.notes ?? "");
    const [draftStatus, setDraftStatus] = useState<WordStatus>(word ? getStatus(word) : "new");
    const [saving, setSaving] = useState(false);

    const isValid = term.trim().length > 0 && translation.trim().length > 0;

    async function save() {
        if (!isValid || saving) return;
        setSaving(true);
        await onSave({
            term: term.trim(),
            translation: translation.trim(),
            example: example.trim() || undefined,
            exampleTranslation: exampleTranslation.trim() || undefined,
            levelTag: levelTag.trim() || undefined,
            categoryTag: categoryTag.trim() || undefined,
            notes: notes.trim() || undefined,
        }, draftStatus);
        setSaving(false);
    }

    function onKeyDown(e: React.KeyboardEvent) {
        if (e.key === "Enter") { e.preventDefault(); save(); }
        if (e.key === "Escape") onCancel();
    }

    const inputStyle: CSSProperties = {
        width: "100%", padding: "9px 11px",
        border: `1px solid ${t.border}`, borderRadius: t.radiusSm,
        fontSize: 14, background: t.surface, color: t.ink,
        outline: "none", fontFamily: t.fontBody,
    };
    const labelStyle: CSSProperties = {
        display: "block", fontSize: 11.5, fontWeight: 600,
        color: t.inkSoft, marginBottom: 5, fontFamily: t.fontBody,
    };
    const SM = statusMeta(t);
    const seg = (s: WordStatus): CSSProperties => {
        const active = draftStatus === s;
        const meta = SM[s];
        return {
            padding: "6px 11px", borderRadius: t.radiusSm, fontSize: 12.5, fontWeight: 600,
            cursor: "pointer",
            border: `1px solid ${active ? meta.color + "66" : t.border}`,
            background: active ? meta.color + "1f" : "transparent",
            color: active ? meta.color : t.inkSoft,
            fontFamily: t.fontBody,
        };
    };

    return (
        <div style={{ padding: "15px 16px", background: t.surface2, borderTop: `1px solid ${t.border}`, animation: "fadein .15s ease" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: t.inkSoft, fontFamily: t.fontBody }}>
                    {word ? "Edit word" : "New word"}
                </span>
                <div style={{ display: "flex", gap: 6 }}>
                    {(["new", "problematic", "learned"] as WordStatus[]).map(s => (
                        <button key={s} onClick={() => setDraftStatus(s)} style={seg(s)}>
                            {SM[s].label}
                        </button>
                    ))}
                </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11 }}>
                <div>
                    <label style={labelStyle}>Word</label>
                    <input
                        autoFocus
                        value={term}
                        onChange={e => setTerm(e.target.value)}
                        onKeyDown={onKeyDown}
                        placeholder="e.g. abholen"
                        style={inputStyle}
                        autoCapitalize="none"
                        autoCorrect="off"
                    />
                </div>
                <div>
                    <label style={labelStyle}>Translation</label>
                    <input
                        value={translation}
                        onChange={e => setTranslation(e.target.value)}
                        onKeyDown={onKeyDown}
                        placeholder="e.g. to pick up"
                        style={inputStyle}
                        autoCapitalize="none"
                        autoCorrect="off"
                    />
                </div>
            </div>
            <div style={{ marginTop: 11 }}>
                <label style={labelStyle}>Example <span style={{ fontWeight: 500, opacity: 0.7 }}>(optional)</span></label>
                <input
                    value={example}
                    onChange={e => setExample(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder="Example sentence"
                    style={inputStyle}
                    autoCapitalize="none"
                    autoCorrect="off"
                />
            </div>
            <div style={{ marginTop: 11 }}>
                <label style={labelStyle}>Example translation <span style={{ fontWeight: 500, opacity: 0.7 }}>(optional)</span></label>
                <input
                    value={exampleTranslation}
                    onChange={e => setExampleTranslation(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder="Example sentence translated"
                    style={inputStyle}
                    autoCapitalize="none"
                    autoCorrect="off"
                />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11, marginTop: 11 }}>
                <div>
                    <label style={labelStyle}>Level <span style={{ fontWeight: 500, opacity: 0.7 }}>(optional)</span></label>
                    <input
                        value={levelTag}
                        onChange={e => setLevelTag(e.target.value)}
                        onKeyDown={onKeyDown}
                        placeholder="e.g. B1"
                        style={inputStyle}
                    />
                </div>
                <div>
                    <label style={labelStyle}>Category <span style={{ fontWeight: 500, opacity: 0.7 }}>(optional)</span></label>
                    <input
                        value={categoryTag}
                        onChange={e => setCategoryTag(e.target.value)}
                        onKeyDown={onKeyDown}
                        placeholder="e.g. Verbs"
                        style={inputStyle}
                    />
                </div>
            </div>
            <div style={{ marginTop: 11 }}>
                <label style={labelStyle}>Notes <span style={{ fontWeight: 500, opacity: 0.7 }}>(optional)</span></label>
                <input
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder="Additional notes"
                    style={inputStyle}
                />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, marginTop: 15 }}>
                <button
                    onClick={onCancel}
                    style={{ padding: "9px 16px", borderRadius: t.radius, border: `1px solid ${t.border}`, background: t.surface, color: t.ink, fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: t.fontBody }}
                >
                    Cancel
                </button>
                <button
                    onClick={save}
                    disabled={!isValid || saving}
                    style={{
                        padding: "9px 18px", borderRadius: t.radius, border: "none",
                        background: t.pop, color: t.popInk, fontSize: 13.5, fontWeight: 600,
                        cursor: isValid && !saving ? "pointer" : "not-allowed",
                        opacity: isValid && !saving ? 1 : 0.45,
                        fontFamily: t.fontBody,
                    }}
                >
                    {saving ? "Saving…" : word ? "Save changes" : "Add word"}
                </button>
            </div>
        </div>
    );
}

// ── Import result banner ──────────────────────────────────────────────────────

function ImportResultBanner({
    result, onDismiss,
}: {
    result: ImportResult;
    onDismiss: () => void;
}) {
    const { theme: t } = useTheme();
    const [showDuplicates, setShowDuplicates] = useState(false);
    const listRef = useRef<HTMLDivElement>(null);
    const successColor = t.statusMastered;
    const successBg = t.statusMastered + "18";
    const successBorder = t.statusMastered + "44";

    return (
        <div style={{ background: successBg, border: `1px solid ${successBorder}`, borderRadius: t.radiusSm, padding: "12px 16px", marginBottom: 14, fontSize: 13.5, color: successColor, fontFamily: t.fontBody }}>
            <p>
                Imported <strong>{result.imported}</strong> words
                {result.duplicates > 0 && (
                    <>
                        {", "}
                        <button
                            onClick={() => setShowDuplicates(v => !v)}
                            style={{ textDecoration: "underline", fontWeight: 600, background: "none", border: "none", color: "inherit", cursor: "pointer" }}
                        >
                            {result.duplicates} duplicates skipped{" "}{showDuplicates ? "▲" : "▼"}
                        </button>
                    </>
                )}
                {result.rejected.length > 0 && `, ${result.rejected.length} lines rejected`}
            </p>
            {showDuplicates && (
                <div ref={listRef} style={{ marginTop: 8, maxHeight: 160, overflowY: "auto", background: t.surface2, borderRadius: 6, padding: "8px 10px" }}>
                    {result.skippedDuplicates.map((term, i) => (
                        <p key={i} style={{ fontSize: 12, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 2 }}>{term}</p>
                    ))}
                </div>
            )}
            <button onClick={onDismiss} style={{ color: successColor, textDecoration: "underline", fontSize: 12, marginTop: 6, background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: t.fontBody }}>
                Dismiss
            </button>
        </div>
    );
}
