# Active-Recall Vocabulary Trainer — System Requirements

Status: draft for implementation by a coding agent (e.g. Claude Code).
This document is design + requirements only. No implementation code included.

## 1. Background and intent

The user needs to cram vocabulary for a language exam (target level: B1, but the
system itself must not be tied to any specific level or language pair). The
method is based on how the user used to cram vocab lists before university
seminars, and is deliberately **not** spaced-repetition flashcards.

Core properties of the method that make it different from Anki/Quizlet/Duolingo:

- Short-term loading for an upcoming checkpoint, not long-term interval scheduling.
- Batches are homogeneous (all new/target words), never mixed old+new in one drill.
- Recall is produced out loud (spoken), not typed, during practice rounds — the
  tool never transcribes or grades speech. Typed input only happens at the final
  graded step.
- The learner sees the **whole batch at once**, not one item at a time.
- Self-checking after a practice round must require active effort (scanning an
  unshuffled reference list and self-marking), not passive side-by-side reveal —
  passive reveal is too easy to cheat past.
- No audio/pronunciation playback anywhere in the practice loop — it adds a beat
  of latency the method is explicitly optimizing away.

## 2. Scope boundaries (explicit non-goals)

Do not build:

- A spaced-repetition scheduler (no SM-2/Anki-style interval algorithm).
- Multiple-choice / recognition-based quizzing.
- One-card-at-a-time flashcard flipping UI.
- Audio playback or pronunciation features anywhere in the drill flow.
- Any bundled/hardcoded vocabulary content. The tool ships with zero words. All
  content comes from user import. This is a generic engine, not a German app.
- Any text-to-speech or speech-to-text.

If a future request reintroduces any of these, treat it as a deliberate scope
change, not an obvious default to add back in.

## 3. Language-agnosticism requirement

The tool must not assume any specific language pair. Internally there is no
"German" or "Russian" — only:

- `targetLanguage`: the language being learned.
- `nativeLanguage`: the language the learner already knows.

These are configured per **Deck** (see data model). All UI strings, code,
identifiers, and comments are in English regardless of which languages a given
deck contains. A deck's content is just data.

## 4. Data model

### 4.1 Deck
```
Deck {
  id
  name                  // e.g. "German B1 exam"
  targetLanguage         // free-text or ISO code, e.g. "de"
  nativeLanguage          // e.g. "ru"
  createdAt
}
```

### 4.2 Word
```
Word {
  id
  deckId
  term                   // string in targetLanguage
  translation             // string in nativeLanguage
  levelTag                // optional, free-text, e.g. "B1" — user-defined, not enforced
  categoryTag              // optional, free-text, e.g. "work", "housing"
  notes                  // optional free text
  createdAt
  stats: {
    timesSeenInExam
    timesCorrectInExam
    timesWrongInExam
    streak                // consecutive correct exam results
    weak                  // bool, true if last exam result was wrong
    lastSeenAt
  }
}
```
`mastered` is derived, not stored: `streak >= masteryStreakThreshold` (config,
default 2).

### 4.3 Session
A full, immutable record of one training run. Store the whole thing — do not
normalize into smaller pieces, the user explicitly wants full-session log
records to support a later weak-word review pass and historical grade tracking.

```
Session {
  id                     // human-referenceable, e.g. date + short suffix
  deckId
  timestamp
  mode                    // "normal" | "review"
  batchWordIds[]
  round1: { orderShown[], selfCheckedIds[] }
  round2: { orderShown[], selfCheckedIds[] }
  exam: {
    orderShown[],
    answers: [{ wordId, rawInput, matched(bool) }],
    scorePct,
    grade                  // derived label, see 6.4
  }
}
```

### 4.4 Settings (per deck or global)
```
Settings {
  batchSize              // default 15, range 8–20
  masteryStreakThreshold // default 2
  fuzzyMatchTolerance     // function of word length, see 6.4
}
```

## 5. Functional requirements

### 5.1 Word bank management
- Create / rename / delete decks.
- Manual add/edit/delete of single words.
- Bulk import from pasted text and from uploaded files. Supported input shapes:
  - Delimited lines: `term<delim>translation<delim>levelTag?<delim>categoryTag?`
    where delim is auto-detected among tab, semicolon, pipe, comma, " - ".
  - Anki "Notes in Plain Text" export (tab-separated fields) — this is the
    practical path for "importing from Anki": Anki can export any deck to this
    format from the desktop app. Full binary `.apkg` parsing is explicitly
    **out of scope for v1** — flag as a possible future enhancement only.
  - CSV/TSV with a header row mapping to `term,translation,levelTag,categoryTag`.
- Import must deduplicate against existing words in the deck (case-insensitive
  match on `term`).
- Import should strip common trailing plural/grammar annotations that some
  source wordlists include (e.g. ", -en", ", -s") so they don't break exam
  matching later — this is a normalization step, not data loss; keep the
  original notation in `notes` if practical.
- Search/filter word list by text, levelTag, categoryTag, weak/mastered status.

### 5.2 Batch selection
Two modes, selectable by the user before starting a session:

- **Normal mode**: prioritize never-seen words first; if the deck doesn't have
  enough never-seen words to fill `batchSize`, fill remaining slots with
  `weak` words, then with lowest-streak non-mastered words. Never silently mix
  in already-mastered words if avoidable.
- **Review mode**: batch consists only of words where `weak == true`, ordered
  worst-first (highest `timesWrongInExam`, then oldest `lastSeenAt`). Intended
  for later in the course once the deck is large and the priority shifts from
  "load new words" to "patch holes." If there are no weak words, show an empty
  state explaining why instead of silently falling back to normal mode.

### 5.3 Training session flow
A session is a fixed sequence of phases over one batch. The system must not
allow skipping ahead or reordering these phases.

1. **Preview**: show the full batch as `term — translation` pairs, in one
   fixed original order. Single read-through, no interaction except "Continue."
2. **Round 1**: shuffle the batch into a new random order. Show **only the
   `translation` (native language) side**, as a full list, all items visible
   simultaneously. The learner recalls the `term` out loud — the system does
   not capture this. Single "Done, check myself" action advances.
3. **Self-check 1**: show the batch in the **same fixed order as Preview**
   (not the round's shuffled order). Each row has a checkbox the learner ticks
   themselves if they recalled it correctly. Do not show the round's shuffled
   order here, and do not auto-align any "your answer vs correct answer" pair —
   the point is the learner has to re-scan the reference list themselves.
   Record which ids were checked.
4. **Round 2**: re-shuffle into a *different* random order than Round 1. Same
   mechanics as step 2.
5. **Self-check 2**: same mechanics as step 3.
6. **Exam (graded assessment)**: shuffle the batch into a new random order.
   Show the `translation` side with a text input per row, all rows visible at
   once. Learner types the `term` for every row, then submits all at once
   (no per-row feedback before submission). Grade on submit using fuzzy
   matching (see 6.4). Reveal correct answers only after grading, since the
   exam is over at that point.
7. **Result**: show score, grade label, and per-word right/wrong breakdown.
   Persist the full `Session` record. Update each word's `stats`.

### 5.4 Progress / state management
- Dashboard per deck: total words, mastered count, weak count, never-seen count.
- Score history: list/visualization of past sessions (date, mode, score,
  batch size), most recent first.
- Average score (overall, and optionally rolling last-N).
- This data must be derivable primarily from stored `Session` records plus
  current `Word.stats` — don't invent a third source of truth.

## 6. Other functional details

### 6.1 Empty states
- Deck with zero words: training tab should not silently no-op; it should
  explain that words need to be imported first and link to the bank/import
  view.
- Review mode with zero weak words: explain why, don't fall back silently.

### 6.2 Multi-deck support
A user may want more than one deck (different language pairs, or splitting one
language into sub-decks by topic). Decks are fully independent: separate word
pools, separate stats, separate session history.

### 6.3 Editing/deleting words with history
Deleting a word should not retroactively rewrite past `Session` records (they
are immutable logs). A deleted word's id may appear in old sessions; the UI
should handle a missing word reference gracefully (e.g. "deleted word").

### 6.4 Grading rules (defaults, should be configurable constants, not hardcoded magic numbers)
- Match function: case-insensitive, trimmed, exact string match OR Levenshtein
  distance ≤ tolerance, where tolerance scales with word length (e.g. 0 for
  ≤4 chars, 1 for 5–7 chars, 2 for 8+ chars — exact thresholds are a
  parameter, not a fixed rule).
- Score = correct / batch size, as a percentage.
- Grade labels are banded from score percentage into roughly 4 tiers
  (e.g. excellent / good / shaky pass / fail) — exact bands are a parameter.
- A word's `streak` increments on exam-correct, resets to 0 on exam-wrong.
  `weak` is set true on exam-wrong, cleared on exam-correct.

## 7. Non-functional requirements

- **Local-first**: no required network calls for core functionality. No
  external API dependency for the drill loop itself.
- **No content shipped**: repo/build must not embed any vocabulary data.
  README should point at where a user can source their own lists (e.g. an
  exam board's official word list, or exporting a list from a flashcard app)
  and import it — content sourcing is a user action, not a build-time asset.
- Must comfortably handle decks in the low thousands of words without
  meaningful UI lag (filtering, batch selection, dashboard aggregation).
- Persistence must survive app restarts (this is a tool used over weeks/months,
  not a single session).

## 8. Suggested architecture (recommendation, not mandate — confirm with the
   coding agent before committing)

- Separate concerns into distinct views/pages rather than one monolithic file:
  - Train (the phase-driven session flow)
  - Word Bank (CRUD + import)
  - Progress (dashboard + history)
  - Deck management (if multi-deck is in scope for v1)
- TypeScript throughout for the data model and parsing logic (import parsing
  and fuzzy matching are exactly the kind of logic that benefits from typed
  data shapes and is easy to unit test in isolation from any UI).
- Local persistence: a local relational store (e.g. SQLite via a lightweight
  embedded driver) is a good fit given the relational shape of
  Deck → Word → Session and the need for filtering/aggregation queries on
  word stats. A simpler JSON-file or IndexedDB store is acceptable for a
  smaller-scope v1 if the coding agent judges SQLite to be overkill — flag
  this as an open decision, not a hard requirement.
- Import parsing should be a pure, testable module separate from any UI code
  (input: raw text/file → output: validated Word[] + list of rejected lines
  with reasons).
- Fuzzy matching (Levenshtein + tolerance rule) should also be a pure,
  independently testable module.

## 9. Open decisions to settle before/during implementation

- Target platform: local web app, desktop app, or CLI+TUI? (User has Claude
  Code available; a small local web app is a reasonable default given the
  amount of structured input/review UI needed, but this is the coding agent's
  call.)
- Multi-deck support in v1, or single deck for now with the data model simply
  allowing for it later?
- Exact fuzzy-match tolerance bands and exact grade-label bands (defaults
  proposed in 6.4, need final numbers).
- Whether self-check tallies (round1/round2 checked counts) factor into any
  visible metric, or are stored purely for later analysis.
- Whether `.apkg` (binary Anki package) import is worth adding later, given
  plain-text export already covers the practical need.

## 10. Glossary (for shared vocabulary with whoever implements this)

- **Deck**: a named collection of words tied to one target/native language pair.
- **Batch**: the set of words selected for one training session.
- **Round**: one full pass of shuffle → recall-aloud → self-check, repeated
  twice per session before the exam.
- **Exam**: the graded, typed, final step of a session.
- **Session**: one complete run through preview → round 1 → round 2 → exam,
  logged in full.
- **Weak word**: a word whose most recent exam appearance was incorrect.
- **Mastered word**: a word with a current correct-streak at or above the
  mastery threshold.
