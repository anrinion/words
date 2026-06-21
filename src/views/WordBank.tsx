import { useEffect, useState, useRef } from "react";
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

const ADAPTERS: ImportAdapter[] = [
    textPasteAdapter,
    fileAdapter,
    ankiPackageAdapter,
    cameraAdapter,
];

export default function WordBank() {
    const deck = useOutletContext<Deck>();
    const navigate = useNavigate();
    const [words, setWords] = useState<Word[]>([]);
    const [importResult, setImportResult] = useState<ImportResult | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null); // 'new' | word.id | null
    const [showImport, setShowImport] = useState(false);
    const [loading, setLoading] = useState(true);

    async function load() {
        const data = await wordsApi.list(deck.id);
        setWords(data);
        setLoading(false);
    }

    useEffect(() => {
        load();
    }, [deck.id]);

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

    async function handleDelete(id: string) {
        if (!confirm("Delete this word?")) return;
        await wordsApi.remove(deck.id, id);
        setWords((prev) => prev.filter((w) => w.id !== id));
    }

    async function handleDeleteDeck() {
        if (!confirm(`Delete "${deck.name}" and all its words? This cannot be undone.`)) return;
        await decksApi.remove(deck.id);
        navigate('/', { replace: true });
    }

    async function handleClearWeak(id: string) {
        await wordsApi.update(deck.id, id, { weak: 0 });
        setWords((prev) =>
            prev.map((w) => (w.id === id ? { ...w, weak: 0 } : w)),
        );
    }

    async function handleSaveEdit(wordId: string, body: Partial<ParsedWord>) {
        await wordsApi.update(deck.id, wordId, body);
        setEditingId(null);
        load();
    }

    async function handleCreate(body: ParsedWord) {
        await wordsApi.create(deck.id, body);
        setEditingId(null);
        load();
    }

    return (
        <div className="p-4">
            {/* Toolbar */}
            <div className="flex gap-2 mb-4">
                <button onClick={() => setShowImport(true)} className="btn-primary text-sm px-4 py-2">
                    Import
                </button>
                <button onClick={() => setEditingId('new')} className="btn-secondary text-sm px-4 py-2">
                    + Add word
                </button>
                <button onClick={handleDeleteDeck} className="ml-auto text-red-400 hover:text-red-600 text-sm px-2">
                    Delete deck
                </button>
            </div>

            {/* Import result banner */}
            {importResult && (
                <ImportResultBanner
                    result={importResult}
                    onDismiss={() => setImportResult(null)}
                />
            )}

            {/* Empty states */}
            {!loading && words.length === 0 && editingId !== "new" && (
                <div className="text-center py-16 text-[var(--ink-soft)]">
                    <p className="text-4xl mb-3">📝</p>
                    <p className="font-medium">No words yet</p>
                    <p className="text-sm mt-1">
                        Import a word list or add words manually to get started.
                    </p>
                </div>
            )}

            {/* Word list */}
            <div className="space-y-2">
                {/* Inline add-new card */}
                {editingId === "new" && (
                    <WordCardEdit
                        word={null}
                        onSave={(body) => handleCreate(body as ParsedWord)}
                        onCancel={() => setEditingId(null)}
                    />
                )}

                {words.map((word) =>
                    editingId === word.id ? (
                        <WordCardEdit
                            key={word.id}
                            word={word}
                            onSave={(body) => handleSaveEdit(word.id, body)}
                            onCancel={() => setEditingId(null)}
                        />
                    ) : (
                        <div
                            key={word.id}
                            className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2.5"
                        >
                            {/* Main row: status dot | term | translation | actions */}
                            <div className="flex items-center gap-2">
                                <StatusDot word={word} />
                                <AudioButton wordId={word.id} type="word" />
                                <div className="flex-1 grid grid-cols-2 items-center min-w-0">
                                    <span className="font-medium text-[var(--ink)] text-sm text-right pr-3 break-words">
                                        {word.term}
                                    </span>
                                    <span className="text-sm text-[var(--ink-soft)] pl-3 break-words">
                                        {word.translation}
                                    </span>
                                </div>
                                <div className="shrink-0 flex gap-0.5">
                                    {word.weak === 1 && (
                                        <button
                                            onClick={() => handleClearWeak(word.id)}
                                            className="text-orange-400 hover:text-orange-600 text-xs p-1"
                                            title="Remove from weak"
                                        >✓</button>
                                    )}
                                    <button
                                        onClick={() => setEditingId(word.id)}
                                        className="text-[var(--ink-faint)] hover:text-[var(--ink)] text-sm p-1 leading-none"
                                    >✎</button>
                                    <button
                                        onClick={() => handleDelete(word.id)}
                                        className="text-red-300 hover:text-red-500 text-xs p-1"
                                    >✕</button>
                                </div>
                            </div>

                            {word.example && (
                                <div className="mt-1.5 border-t border-[var(--border)] pt-1.5">
                                    <div className="flex items-start gap-2">
                                        <div className="w-[9px] shrink-0 mt-0.5" aria-hidden />
                                        <AudioButton wordId={word.id} type="example" />
                                        <div className="flex-1 grid grid-cols-2 items-start min-w-0">
                                            <span className="text-right text-xs italic text-[var(--ink-faint)] pr-3 break-words">
                                                {word.example}
                                            </span>
                                            <span className="text-left text-xs italic text-[var(--ink-faint)] pl-3 break-words">
                                                {word.exampleTranslation ?? ""}
                                            </span>
                                        </div>
                                        <div className="shrink-0 flex gap-0.5 invisible" aria-hidden>
                                            <span className="text-sm p-1 leading-none">✎</span>
                                            <span className="text-xs p-1">✕</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Tags row */}
                            {(word.levelTag || word.categoryTag) && (
                                <div className="flex gap-1 mt-1 flex-wrap">
                                    {word.levelTag && (
                                        <span className="text-xs bg-[var(--surface2)] text-[var(--ink-faint)] px-1.5 rounded">
                                            {word.levelTag}
                                        </span>
                                    )}
                                    {word.categoryTag && (
                                        <span className="text-xs bg-[var(--surface2)] text-[var(--ink-faint)] px-1.5 rounded">
                                            {word.categoryTag}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    ),
                )}
            </div>

            {/* Import picker modal */}
            {showImport && (
                <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
                    <div className="bg-[var(--surface)] rounded-2xl w-full max-w-sm p-5 shadow-xl" style={{ border: '1px solid var(--border)' }}>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-semibold text-[var(--ink)]">
                                Import words
                            </h2>
                            <button
                                onClick={() => setShowImport(false)}
                                className="text-[var(--ink-faint)] hover:text-[var(--ink)] text-xl"
                            >
                                ×
                            </button>
                        </div>
                        <div className="space-y-2">
                            {ADAPTERS.map((adapter) => (
                                <button
                                    key={adapter.id}
                                    onClick={() => runAdapter(adapter)}
                                    className="w-full text-left bg-[var(--surface2)] hover:bg-[var(--border)] rounded-lg px-4 py-3 transition-colors"
                                >
                                    <p className="font-medium text-[var(--ink)] text-sm">
                                        {adapter.name}
                                    </p>
                                    <p className="text-xs text-[var(--ink-soft)] mt-0.5">
                                        {adapter.description}
                                    </p>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Status dot ───────────────────────────────────────────────────────────────

function StatusDot({ word }: { word: Word }) {
    const { theme: t } = useTheme()
    let fill: string, border: string
    if (word.streak >= 2) { fill = t.pop; border = t.pop }
    else if (word.weak === 1) { fill = '#ef4444'; border = '#ef4444' }
    else if (word.lastSeenAt !== null) { fill = t.inkSoft; border = t.inkSoft }
    else { fill = 'transparent'; border = t.inkFaint }
    return (
        <span style={{
            width: 9, height: 9, flexShrink: 0, borderRadius: '50%',
            background: fill, border: `1.6px solid ${border}`, display: 'inline-block',
        }} />
    )
}

// ── Inline word editor ────────────────────────────────────────────────────────

function WordCardEdit({
    word,
    onSave,
    onCancel,
}: {
    word: Word | null;
    onSave: (body: Partial<ParsedWord>) => Promise<void>;
    onCancel: () => void;
}) {
    const [term, setTerm] = useState(word?.term ?? "");
    const [translation, setTranslation] = useState(word?.translation ?? "");
    const [example, setExample] = useState(word?.example ?? "");
    const [exampleTranslation, setExampleTranslation] = useState(
        word?.exampleTranslation ?? "",
    );
    const [levelTag, setLevelTag] = useState(word?.levelTag ?? "");
    const [categoryTag, setCategoryTag] = useState(word?.categoryTag ?? "");
    const [notes, setNotes] = useState(word?.notes ?? "");
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
        });
        setSaving(false);
    }

    function onKeyDown(e: React.KeyboardEvent) {
        if (e.key === "Enter") {
            e.preventDefault();
            save();
        }
        if (e.key === "Escape") onCancel();
    }

    return (
        <div className="bg-[var(--surface)] rounded-lg px-3 py-3 space-y-2" style={{ border: '2px solid var(--pop)' }}>
            {/* Term | Translation */}
            <div className="grid grid-cols-2 gap-2">
                <input
                    autoFocus
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder="Term"
                    className="input text-sm text-right"
                    autoCapitalize="none"
                    autoCorrect="off"
                />
                <input
                    value={translation}
                    onChange={(e) => setTranslation(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder="Translation"
                    className="input text-sm"
                    autoCapitalize="none"
                    autoCorrect="off"
                />
            </div>

            {/* Example | Example translation */}
            <div className="grid grid-cols-2 gap-2">
                <input
                    value={example}
                    onChange={(e) => setExample(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder="Example sentence"
                    className="input text-sm text-right"
                    autoCapitalize="none"
                    autoCorrect="off"
                />
                <input
                    value={exampleTranslation}
                    onChange={(e) => setExampleTranslation(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder="Example translation"
                    className="input text-sm"
                    autoCapitalize="none"
                    autoCorrect="off"
                />
            </div>

            {/* Level | Category */}
            <div className="grid grid-cols-2 gap-2">
                <input
                    value={levelTag}
                    onChange={(e) => setLevelTag(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder="Level (e.g. B1)"
                    className="input text-sm text-right"
                />
                <input
                    value={categoryTag}
                    onChange={(e) => setCategoryTag(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder="Category"
                    className="input text-sm"
                />
            </div>

            {/* Notes */}
            <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Notes"
                className="input text-sm"
            />

            {/* Actions */}
            <div className="flex gap-2 pt-1">
                <button
                    onClick={onCancel}
                    className="btn-secondary text-xs flex-1 py-1.5"
                >
                    Cancel
                </button>
                <button
                    onClick={save}
                    disabled={!isValid || saving}
                    className={`btn-primary text-xs flex-1 py-1.5 ${!isValid ? "opacity-40 pointer-events-none" : ""}`}
                >
                    {word ? "Save" : "Add"}
                </button>
            </div>
        </div>
    );
}

// ── Import result banner ──────────────────────────────────────────────────────

function ImportResultBanner({
    result,
    onDismiss,
}: {
    result: ImportResult;
    onDismiss: () => void;
}) {
    const [showDuplicates, setShowDuplicates] = useState(false);
    const listRef = useRef<HTMLDivElement>(null);

    return (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3 text-sm text-green-800">
            <p>
                Imported <strong>{result.imported}</strong> words
                {result.duplicates > 0 && (
                    <>
                        {", "}
                        <button
                            onClick={() => setShowDuplicates((v) => !v)}
                            className="underline font-medium"
                        >
                            {result.duplicates} duplicates skipped{" "}
                            {showDuplicates ? "▲" : "▼"}
                        </button>
                    </>
                )}
                {result.rejected.length > 0 &&
                    `, ${result.rejected.length} lines rejected`}
            </p>

            {showDuplicates && (
                <div
                    ref={listRef}
                    className="mt-2 max-h-40 overflow-y-auto bg-[var(--surface2)] border border-[var(--border)] rounded p-2 space-y-0.5"
                >
                    {result.skippedDuplicates.map((term, i) => (
                        <p
                            key={i}
                            className="text-xs text-[var(--ink-faint)] font-mono truncate"
                        >
                            {term}
                        </p>
                    ))}
                </div>
            )}

            <button
                onClick={onDismiss}
                className="text-green-600 underline text-xs mt-1.5 block"
            >
                Dismiss
            </button>
        </div>
    );
}
