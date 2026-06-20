/// <reference types="@cloudflare/workers-types" />
import { Hono } from 'hono'
import { handle } from 'hono/cloudflare-pages'
import { cors } from 'hono/cors'
import { drizzle } from 'drizzle-orm/d1'
import { eq, and, isNull } from 'drizzle-orm'
import * as schema from '../../db/schema'
import { matches, gradeLabel } from '../../shared/fuzzy'
import { selectBatch, isMastered } from '../../shared/batch'
import type { Settings, SessionData, ParsedWord } from '../../shared/types'
import { DEFAULT_SETTINGS } from '../../shared/types'

type Bindings = { DB: D1Database }

const app = new Hono<{ Bindings: Bindings }>()

app.use('*', cors())

function getUserId(req: Request): string {
  return req.headers.get('Cf-Access-Authenticated-User-Email') ?? 'dev-user'
}

function db(env: Bindings) {
  return drizzle(env.DB, { schema })
}

function nanoid(len = 8): string {
  return Math.random().toString(36).slice(2, 2 + len)
}

async function getSettings(d: ReturnType<typeof db>, userId: string, deckId?: string): Promise<Settings> {
  // Try deck-specific settings first, then global, then defaults
  if (deckId) {
    const row = await d
      .select()
      .from(schema.settings)
      .where(and(eq(schema.settings.userId, userId), eq(schema.settings.deckId, deckId)))
      .get()
    if (row) return { ...DEFAULT_SETTINGS, ...JSON.parse(row.data) }
  }
  const global = await d
    .select()
    .from(schema.settings)
    .where(and(eq(schema.settings.userId, userId), isNull(schema.settings.deckId)))
    .get()
  if (global) return { ...DEFAULT_SETTINGS, ...JSON.parse(global.data) }
  return DEFAULT_SETTINGS
}

// ── Decks ────────────────────────────────────────────────────────────────────

app.get('/api/decks', async (c) => {
  const userId = getUserId(c.req.raw)
  const decks = await db(c.env).select().from(schema.decks).where(eq(schema.decks.userId, userId)).all()
  return c.json(decks)
})

app.post('/api/decks', async (c) => {
  const userId = getUserId(c.req.raw)
  const body = await c.req.json<{ name: string; targetLanguage: string; nativeLanguage: string }>()
  const deck = {
    id: nanoid(),
    userId,
    name: body.name.trim(),
    targetLanguage: body.targetLanguage.trim(),
    nativeLanguage: body.nativeLanguage.trim(),
    createdAt: Date.now(),
  }
  await db(c.env).insert(schema.decks).values(deck)
  return c.json(deck, 201)
})

app.patch('/api/decks/:id', async (c) => {
  const userId = getUserId(c.req.raw)
  const body = await c.req.json<Partial<{ name: string; targetLanguage: string; nativeLanguage: string }>>()
  const updates: Record<string, string> = {}
  if (body.name) updates.name = body.name.trim()
  if (body.targetLanguage) updates.targetLanguage = body.targetLanguage.trim()
  if (body.nativeLanguage) updates.nativeLanguage = body.nativeLanguage.trim()
  await db(c.env)
    .update(schema.decks)
    .set(updates)
    .where(and(eq(schema.decks.id, c.req.param('id')), eq(schema.decks.userId, userId)))
  return c.json({ ok: true })
})

app.delete('/api/decks/:id', async (c) => {
  const userId = getUserId(c.req.raw)
  const id = c.req.param('id')
  // Explicitly delete children first — don't rely on FK cascade pragma being set
  await db(c.env).delete(schema.sessions).where(eq(schema.sessions.deckId, id))
  await db(c.env).delete(schema.words).where(eq(schema.words.deckId, id))
  await db(c.env).delete(schema.settings).where(eq(schema.settings.deckId, id))
  await db(c.env).delete(schema.decks).where(and(eq(schema.decks.id, id), eq(schema.decks.userId, userId)))
  return c.json({ ok: true })
})

// ── Words ────────────────────────────────────────────────────────────────────

app.get('/api/decks/:deckId/words', async (c) => {
  const userId = getUserId(c.req.raw)
  const { deckId } = c.req.param()
  const { search, levelTag, categoryTag, weak, mastered } = c.req.query()

  const settings = await getSettings(db(c.env), userId, deckId)

  let rows = await db(c.env)
    .select()
    .from(schema.words)
    .where(eq(schema.words.deckId, deckId))
    .all()

  // JS-side filtering (deck sizes are small enough)
  if (search) {
    const s = search.toLowerCase()
    rows = rows.filter(
      (w) => w.term.toLowerCase().includes(s) || w.translation.toLowerCase().includes(s),
    )
  }
  if (levelTag) rows = rows.filter((w) => w.levelTag === levelTag)
  if (categoryTag) rows = rows.filter((w) => w.categoryTag === categoryTag)
  if (weak === '1') rows = rows.filter((w) => w.weak === 1)
  if (mastered === '1') rows = rows.filter((w) => isMastered(w, settings.masteryStreakThreshold))

  // Verify deck ownership
  const deck = await db(c.env).select().from(schema.decks).where(and(eq(schema.decks.id, deckId), eq(schema.decks.userId, userId))).get()
  if (!deck) return c.json({ error: 'Not found' }, 404)

  return c.json(rows)
})

app.post('/api/decks/:deckId/words', async (c) => {
  const userId = getUserId(c.req.raw)
  const { deckId } = c.req.param()
  const deck = await db(c.env).select().from(schema.decks).where(and(eq(schema.decks.id, deckId), eq(schema.decks.userId, userId))).get()
  if (!deck) return c.json({ error: 'Not found' }, 404)

  const body = await c.req.json<ParsedWord>()
  const word = {
    id: nanoid(),
    deckId,
    term: body.term.trim(),
    translation: body.translation.trim(),
    levelTag: body.levelTag?.trim() ?? null,
    categoryTag: body.categoryTag?.trim() ?? null,
    notes: body.notes?.trim() ?? null,
    createdAt: Date.now(),
    timesSeenInExam: 0,
    timesCorrectInExam: 0,
    timesWrongInExam: 0,
    streak: 0,
    weak: 0,
    lastSeenAt: null,
  }
  await db(c.env).insert(schema.words).values(word)
  return c.json(word, 201)
})

app.patch('/api/decks/:deckId/words/:id', async (c) => {
  const userId = getUserId(c.req.raw)
  const { deckId, id } = c.req.param()
  const deck = await db(c.env).select().from(schema.decks).where(and(eq(schema.decks.id, deckId), eq(schema.decks.userId, userId))).get()
  if (!deck) return c.json({ error: 'Not found' }, 404)

  const body = await c.req.json<Partial<ParsedWord>>()
  const updates: Record<string, string | null> = {}
  if (body.term !== undefined) updates.term = body.term.trim()
  if (body.translation !== undefined) updates.translation = body.translation.trim()
  if (body.levelTag !== undefined) updates.levelTag = body.levelTag?.trim() ?? null
  if (body.categoryTag !== undefined) updates.categoryTag = body.categoryTag?.trim() ?? null
  if (body.notes !== undefined) updates.notes = body.notes?.trim() ?? null
  await db(c.env).update(schema.words).set(updates).where(eq(schema.words.id, id))
  return c.json({ ok: true })
})

app.delete('/api/decks/:deckId/words/:id', async (c) => {
  const userId = getUserId(c.req.raw)
  const { deckId, id } = c.req.param()
  const deck = await db(c.env).select().from(schema.decks).where(and(eq(schema.decks.id, deckId), eq(schema.decks.userId, userId))).get()
  if (!deck) return c.json({ error: 'Not found' }, 404)
  await db(c.env).delete(schema.words).where(eq(schema.words.id, id))
  return c.json({ ok: true })
})

// ── Import ───────────────────────────────────────────────────────────────────

app.post('/api/decks/:deckId/words/import', async (c) => {
  const userId = getUserId(c.req.raw)
  const { deckId } = c.req.param()
  const deck = await db(c.env).select().from(schema.decks).where(and(eq(schema.decks.id, deckId), eq(schema.decks.userId, userId))).get()
  if (!deck) return c.json({ error: 'Not found' }, 404)

  const body = await c.req.json<{ words: ParsedWord[]; rejected?: { line: string; reason: string }[] }>()
  const existing = await db(c.env).select({ term: schema.words.term }).from(schema.words).where(eq(schema.words.deckId, deckId)).all()
  const existingTerms = new Set(existing.map((w) => w.term.toLowerCase()))

  let imported = 0
  let duplicates = 0
  const toInsert = []

  for (const w of body.words) {
    const term = w.term.trim()
    if (existingTerms.has(term.toLowerCase())) {
      duplicates++
      continue
    }
    toInsert.push({
      id: nanoid(),
      deckId,
      term,
      translation: w.translation.trim(),
      levelTag: w.levelTag?.trim() ?? null,
      categoryTag: w.categoryTag?.trim() ?? null,
      notes: w.notes?.trim() ?? null,
      createdAt: Date.now(),
      timesSeenInExam: 0,
      timesCorrectInExam: 0,
      timesWrongInExam: 0,
      streak: 0,
      weak: 0,
      lastSeenAt: null,
    })
    existingTerms.add(term.toLowerCase())
    imported++
  }

  if (toInsert.length > 0) {
    // D1 batch inserts have limits; chunk if needed
    for (let i = 0; i < toInsert.length; i += 100) {
      await db(c.env).insert(schema.words).values(toInsert.slice(i, i + 100))
    }
  }

  return c.json({ imported, duplicates, rejected: body.rejected ?? [] })
})

// ── Batch ────────────────────────────────────────────────────────────────────

app.get('/api/decks/:deckId/batch', async (c) => {
  const userId = getUserId(c.req.raw)
  const { deckId } = c.req.param()
  const mode = (c.req.query('mode') ?? 'normal') as 'normal' | 'review'

  const deck = await db(c.env).select().from(schema.decks).where(and(eq(schema.decks.id, deckId), eq(schema.decks.userId, userId))).get()
  if (!deck) return c.json({ error: 'Not found' }, 404)

  const words = await db(c.env).select().from(schema.words).where(eq(schema.words.deckId, deckId)).all()
  const settings = await getSettings(db(c.env), userId, deckId)
  const result = selectBatch(words, mode, settings)

  return c.json(result)
})

// ── Sessions ─────────────────────────────────────────────────────────────────

app.get('/api/decks/:deckId/sessions', async (c) => {
  const userId = getUserId(c.req.raw)
  const { deckId } = c.req.param()
  const deck = await db(c.env).select().from(schema.decks).where(and(eq(schema.decks.id, deckId), eq(schema.decks.userId, userId))).get()
  if (!deck) return c.json({ error: 'Not found' }, 404)

  const rows = await db(c.env)
    .select({ id: schema.sessions.id, timestamp: schema.sessions.timestamp, mode: schema.sessions.mode, data: schema.sessions.data })
    .from(schema.sessions)
    .where(and(eq(schema.sessions.deckId, deckId), eq(schema.sessions.userId, userId)))
    .all()

  // Return lightweight list (no full data blob)
  const list = rows.map((r) => {
    const data: SessionData = JSON.parse(r.data)
    return {
      id: r.id,
      timestamp: r.timestamp,
      mode: r.mode,
      scorePct: data.exam.scorePct,
      grade: data.exam.grade,
      batchSize: data.batchWordIds.length,
    }
  })
  list.sort((a, b) => b.timestamp - a.timestamp)

  return c.json(list)
})

app.get('/api/decks/:deckId/sessions/:id', async (c) => {
  const userId = getUserId(c.req.raw)
  const { deckId, id } = c.req.param()
  const row = await db(c.env)
    .select()
    .from(schema.sessions)
    .where(and(eq(schema.sessions.id, id), eq(schema.sessions.deckId, deckId), eq(schema.sessions.userId, userId)))
    .get()
  if (!row) return c.json({ error: 'Not found' }, 404)
  return c.json({ ...row, data: JSON.parse(row.data) })
})

app.post('/api/decks/:deckId/sessions', async (c) => {
  const userId = getUserId(c.req.raw)
  const { deckId } = c.req.param()
  const deck = await db(c.env).select().from(schema.decks).where(and(eq(schema.decks.id, deckId), eq(schema.decks.userId, userId))).get()
  if (!deck) return c.json({ error: 'Not found' }, 404)

  const settings = await getSettings(db(c.env), userId, deckId)
  const body = await c.req.json<{
    mode: 'normal' | 'review'
    data: SessionData
  }>()

  // Grade answers using fuzzy matching
  const { data } = body
  const wordIds = data.exam.orderShown
  const wordRows = await db(c.env).select().from(schema.words).where(eq(schema.words.deckId, deckId)).all()
  const wordMap = new Map(wordRows.map((w) => [w.id, w]))

  const answers = data.exam.answers.map((a) => {
    const word = wordMap.get(a.wordId)
    if (!word) return { ...a, matched: false }
    return {
      ...a,
      matched: matches(a.rawInput, word.term, settings.fuzzyToleranceBands),
    }
  })

  const correctCount = answers.filter((a) => a.matched).length
  const scorePct = Math.round((correctCount / wordIds.length) * 100)
  const grade = gradeLabel(scorePct, settings.gradeBands)

  const sessionData: SessionData = {
    ...data,
    exam: { ...data.exam, answers, scorePct, grade },
  }

  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const session = {
    id: `${dateStr}-${nanoid(4)}`,
    deckId,
    userId,
    timestamp: Date.now(),
    mode: body.mode,
    data: JSON.stringify(sessionData),
  }
  await db(c.env).insert(schema.sessions).values(session)

  // Update word stats atomically-ish (D1 doesn't support transactions in Pages Functions)
  for (const answer of answers) {
    const word = wordMap.get(answer.wordId)
    if (!word) continue
    await db(c.env)
      .update(schema.words)
      .set({
        timesSeenInExam: word.timesSeenInExam + 1,
        timesCorrectInExam: word.timesCorrectInExam + (answer.matched ? 1 : 0),
        timesWrongInExam: word.timesWrongInExam + (answer.matched ? 0 : 1),
        streak: answer.matched ? word.streak + 1 : 0,
        weak: answer.matched ? 0 : 1,
        lastSeenAt: Date.now(),
      })
      .where(eq(schema.words.id, answer.wordId))
  }

  return c.json({ ...session, data: sessionData }, 201)
})

// ── Settings ─────────────────────────────────────────────────────────────────

app.get('/api/decks/:deckId/settings', async (c) => {
  const userId = getUserId(c.req.raw)
  const { deckId } = c.req.param()
  const s = await getSettings(db(c.env), userId, deckId)
  return c.json(s)
})

app.patch('/api/decks/:deckId/settings', async (c) => {
  const userId = getUserId(c.req.raw)
  const { deckId } = c.req.param()
  const body = await c.req.json<Partial<Settings>>()
  const existing = await getSettings(db(c.env), userId, deckId)
  const updated = { ...existing, ...body }

  const row = await db(c.env)
    .select()
    .from(schema.settings)
    .where(and(eq(schema.settings.userId, userId), eq(schema.settings.deckId, deckId)))
    .get()

  if (row) {
    await db(c.env).update(schema.settings).set({ data: JSON.stringify(updated) }).where(eq(schema.settings.id, row.id))
  } else {
    await db(c.env).insert(schema.settings).values({ id: nanoid(), userId, deckId, data: JSON.stringify(updated) })
  }
  return c.json(updated)
})

app.get('/api/settings', async (c) => {
  const userId = getUserId(c.req.raw)
  const s = await getSettings(db(c.env), userId)
  return c.json(s)
})

app.patch('/api/settings', async (c) => {
  const userId = getUserId(c.req.raw)
  const body = await c.req.json<Partial<Settings>>()
  const existing = await getSettings(db(c.env), userId)
  const updated = { ...existing, ...body }

  const row = await db(c.env)
    .select()
    .from(schema.settings)
    .where(and(eq(schema.settings.userId, userId), isNull(schema.settings.deckId)))
    .get()

  if (row) {
    await db(c.env).update(schema.settings).set({ data: JSON.stringify(updated) }).where(eq(schema.settings.id, row.id))
  } else {
    await db(c.env).insert(schema.settings).values({ id: nanoid(), userId, deckId: null, data: JSON.stringify(updated) })
  }
  return c.json(updated)
})

export const onRequest = handle(app)
