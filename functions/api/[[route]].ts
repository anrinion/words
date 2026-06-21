/// <reference types="@cloudflare/workers-types" />
import { Hono } from 'hono'
import { handle } from 'hono/cloudflare-pages'
import { cors } from 'hono/cors'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { drizzle } from 'drizzle-orm/d1'
import { eq, and, isNull } from 'drizzle-orm'
import * as schema from '../../db/schema'
import { matches, gradeLabel } from '../../shared/fuzzy'
import { selectBatch, isMastered } from '../../shared/batch'
import type { Settings, SessionData, ParsedWord } from '../../shared/types'
import { DEFAULT_SETTINGS } from '../../shared/types'

type Bindings = { DB: D1Database; RESEND_API_KEY?: string; ADMIN_EMAIL?: string }
type Variables = { userId: string }

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

app.use('*', cors())

function db(env: Bindings) {
  return drizzle(env.DB, { schema })
}

function nanoid(len = 8): string {
  return Math.random().toString(36).slice(2, 2 + len)
}

function generateOtp(): string {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return String((buf[0] % 900000) + 100000)
}

async function getSettings(d: ReturnType<typeof db>, userId: string, deckId?: string): Promise<Settings> {
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

// ── Auth middleware ───────────────────────────────────────────────────────────

app.use('/api/*', async (c, next) => {
  // Auth routes are public
  if (c.req.path.startsWith('/api/auth/')) return next()

  // Dev mode: no RESEND_API_KEY means auth is disabled
  if (!c.env.RESEND_API_KEY) {
    c.set('userId', 'dev-user')
    return next()
  }

  const token = getCookie(c, 'session')
  if (!token) return c.json({ error: 'Unauthorized' }, 401)

  const session = await db(c.env)
    .select()
    .from(schema.authSessions)
    .where(eq(schema.authSessions.token, token))
    .get()

  if (!session || session.expiresAt < Date.now()) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const ban = await db(c.env)
    .select()
    .from(schema.bannedEmails)
    .where(eq(schema.bannedEmails.email, session.email))
    .get()
  if (ban) return c.json({ error: 'Forbidden' }, 403)

  c.set('userId', session.email)
  return next()
})

// ── Auth routes ───────────────────────────────────────────────────────────────

app.get('/api/auth/me', async (c) => {
  if (!c.env.RESEND_API_KEY) return c.json({ email: 'dev-user' })

  const token = getCookie(c, 'session')
  if (!token) return c.json({ error: 'Unauthorized' }, 401)

  const session = await db(c.env)
    .select()
    .from(schema.authSessions)
    .where(eq(schema.authSessions.token, token))
    .get()

  if (!session || session.expiresAt < Date.now()) return c.json({ error: 'Unauthorized' }, 401)
  return c.json({ email: session.email })
})

app.post('/api/auth/send-otp', async (c) => {
  const { email } = await c.req.json<{ email: string }>()
  if (!email || !email.includes('@')) return c.json({ error: 'Invalid email' }, 400)

  const code = generateOtp()
  const expiresAt = Date.now() + 10 * 60 * 1000

  // Replace any existing OTP for this email
  await db(c.env).delete(schema.otps).where(eq(schema.otps.email, email))
  await db(c.env).insert(schema.otps).values({ id: crypto.randomUUID(), email, code, expiresAt, used: 0 })

  if (c.env.RESEND_API_KEY) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${c.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Words <noreply@words.ansid.de>',
        to: [email],
        subject: 'Your login code',
        text: `Your login code is: ${code}\n\nExpires in 10 minutes.`,
      }),
    })
    if (!res.ok) {
      const body = await res.text()
      console.error(`[resend] ${res.status} ${body}`)
      return c.json({ ok: false, resendStatus: res.status, resendError: body })
    }
  } else {
    console.log(`[dev auth] OTP for ${email}: ${code}`)
  }

  return c.json({ ok: true })
})

app.post('/api/auth/verify-otp', async (c) => {
  const { email, code } = await c.req.json<{ email: string; code: string }>()

  const otp = await db(c.env)
    .select()
    .from(schema.otps)
    .where(and(eq(schema.otps.email, email), eq(schema.otps.code, code), eq(schema.otps.used, 0)))
    .get()

  if (!otp || otp.expiresAt < Date.now()) return c.json({ error: 'Invalid or expired code' }, 400)

  await db(c.env).update(schema.otps).set({ used: 1 }).where(eq(schema.otps.id, otp.id))

  const token = crypto.randomUUID()
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000

  await db(c.env).insert(schema.authSessions).values({ token, email, expiresAt })

  const isProd = !!c.env.RESEND_API_KEY
  setCookie(c, 'session', token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'Lax',
    maxAge: 30 * 24 * 60 * 60,
    path: '/',
  })

  return c.json({ email })
})

app.post('/api/auth/logout', async (c) => {
  const token = getCookie(c, 'session')
  if (token) await db(c.env).delete(schema.authSessions).where(eq(schema.authSessions.token, token))
  deleteCookie(c, 'session', { path: '/' })
  return c.json({ ok: true })
})

// ── Admin ─────────────────────────────────────────────────────────────────────

app.use('/api/admin/*', async (c, next) => {
  if (!c.env.ADMIN_EMAIL || c.get('userId') !== c.env.ADMIN_EMAIL) {
    return c.json({ error: 'Forbidden' }, 403)
  }
  return next()
})

app.get('/api/admin/bans', async (c) => {
  const bans = await db(c.env).select().from(schema.bannedEmails).all()
  return c.json(bans)
})

app.post('/api/admin/ban', async (c) => {
  const { email } = await c.req.json<{ email: string }>()
  await db(c.env).insert(schema.bannedEmails).values({ email, bannedAt: Date.now() }).onConflictDoNothing()
  await db(c.env).delete(schema.authSessions).where(eq(schema.authSessions.email, email))
  return c.json({ ok: true })
})

app.delete('/api/admin/ban/:email', async (c) => {
  await db(c.env).delete(schema.bannedEmails).where(eq(schema.bannedEmails.email, c.req.param('email')))
  return c.json({ ok: true })
})

// ── Decks ────────────────────────────────────────────────────────────────────

app.get('/api/decks', async (c) => {
  const userId = c.get('userId')
  const decks = await db(c.env).select().from(schema.decks).where(eq(schema.decks.userId, userId)).all()
  return c.json(decks)
})

app.post('/api/decks', async (c) => {
  const userId = c.get('userId')
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
  const userId = c.get('userId')
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
  const userId = c.get('userId')
  const id = c.req.param('id')
  await db(c.env).delete(schema.sessions).where(eq(schema.sessions.deckId, id))
  await db(c.env).delete(schema.words).where(eq(schema.words.deckId, id))
  await db(c.env).delete(schema.settings).where(eq(schema.settings.deckId, id))
  await db(c.env).delete(schema.decks).where(and(eq(schema.decks.id, id), eq(schema.decks.userId, userId)))
  return c.json({ ok: true })
})

// ── Words ────────────────────────────────────────────────────────────────────

app.get('/api/decks/:deckId/words', async (c) => {
  const userId = c.get('userId')
  const { deckId } = c.req.param()
  const { search, levelTag, categoryTag, weak, mastered } = c.req.query()

  const deck = await db(c.env).select().from(schema.decks).where(and(eq(schema.decks.id, deckId), eq(schema.decks.userId, userId))).get()
  if (!deck) return c.json({ error: 'Not found' }, 404)

  const settings = await getSettings(db(c.env), userId, deckId)

  let rows = await db(c.env).select().from(schema.words).where(eq(schema.words.deckId, deckId)).all()

  if (search) {
    const s = search.toLowerCase()
    rows = rows.filter((w) => w.term.toLowerCase().includes(s) || w.translation.toLowerCase().includes(s))
  }
  if (levelTag) rows = rows.filter((w) => w.levelTag === levelTag)
  if (categoryTag) rows = rows.filter((w) => w.categoryTag === categoryTag)
  if (weak === '1') rows = rows.filter((w) => w.weak === 1)
  if (mastered === '1') rows = rows.filter((w) => isMastered(w, settings.masteryStreakThreshold))

  return c.json(rows)
})

app.post('/api/decks/:deckId/words', async (c) => {
  const userId = c.get('userId')
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
  const userId = c.get('userId')
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
  const userId = c.get('userId')
  const { deckId, id } = c.req.param()
  const deck = await db(c.env).select().from(schema.decks).where(and(eq(schema.decks.id, deckId), eq(schema.decks.userId, userId))).get()
  if (!deck) return c.json({ error: 'Not found' }, 404)
  await db(c.env).delete(schema.words).where(eq(schema.words.id, id))
  return c.json({ ok: true })
})

// ── Import ───────────────────────────────────────────────────────────────────

app.post('/api/decks/:deckId/words/import', async (c) => {
  const userId = c.get('userId')
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
    if (existingTerms.has(term.toLowerCase())) { duplicates++; continue }
    toInsert.push({
      id: nanoid(), deckId, term,
      translation: w.translation.trim(),
      levelTag: w.levelTag?.trim() ?? null,
      categoryTag: w.categoryTag?.trim() ?? null,
      notes: w.notes?.trim() ?? null,
      createdAt: Date.now(),
      timesSeenInExam: 0, timesCorrectInExam: 0, timesWrongInExam: 0,
      streak: 0, weak: 0, lastSeenAt: null,
    })
    existingTerms.add(term.toLowerCase())
    imported++
  }

  for (let i = 0; i < toInsert.length; i += 100) {
    await db(c.env).insert(schema.words).values(toInsert.slice(i, i + 100))
  }

  return c.json({ imported, duplicates, rejected: body.rejected ?? [] })
})

// ── Batch ────────────────────────────────────────────────────────────────────

app.get('/api/decks/:deckId/batch', async (c) => {
  const userId = c.get('userId')
  const { deckId } = c.req.param()
  const mode = (c.req.query('mode') ?? 'normal') as 'normal' | 'review'

  const deck = await db(c.env).select().from(schema.decks).where(and(eq(schema.decks.id, deckId), eq(schema.decks.userId, userId))).get()
  if (!deck) return c.json({ error: 'Not found' }, 404)

  const words = await db(c.env).select().from(schema.words).where(eq(schema.words.deckId, deckId)).all()
  const settings = await getSettings(db(c.env), userId, deckId)
  return c.json(selectBatch(words, mode, settings))
})

// ── Sessions ─────────────────────────────────────────────────────────────────

app.get('/api/decks/:deckId/sessions', async (c) => {
  const userId = c.get('userId')
  const { deckId } = c.req.param()
  const deck = await db(c.env).select().from(schema.decks).where(and(eq(schema.decks.id, deckId), eq(schema.decks.userId, userId))).get()
  if (!deck) return c.json({ error: 'Not found' }, 404)

  const rows = await db(c.env)
    .select({ id: schema.sessions.id, timestamp: schema.sessions.timestamp, mode: schema.sessions.mode, data: schema.sessions.data })
    .from(schema.sessions)
    .where(and(eq(schema.sessions.deckId, deckId), eq(schema.sessions.userId, userId)))
    .all()

  const list = rows.map((r) => {
    const data: SessionData = JSON.parse(r.data)
    return { id: r.id, timestamp: r.timestamp, mode: r.mode, scorePct: data.exam.scorePct, grade: data.exam.grade, batchSize: data.batchWordIds.length }
  })
  list.sort((a, b) => b.timestamp - a.timestamp)
  return c.json(list)
})

app.get('/api/decks/:deckId/sessions/:id', async (c) => {
  const userId = c.get('userId')
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
  const userId = c.get('userId')
  const { deckId } = c.req.param()
  const deck = await db(c.env).select().from(schema.decks).where(and(eq(schema.decks.id, deckId), eq(schema.decks.userId, userId))).get()
  if (!deck) return c.json({ error: 'Not found' }, 404)

  const settings = await getSettings(db(c.env), userId, deckId)
  const body = await c.req.json<{ mode: 'normal' | 'review'; data: SessionData }>()

  const { data } = body
  const wordIds = data.exam.orderShown
  const wordRows = await db(c.env).select().from(schema.words).where(eq(schema.words.deckId, deckId)).all()
  const wordMap = new Map(wordRows.map((w) => [w.id, w]))

  const answers = data.exam.answers.map((a) => {
    const word = wordMap.get(a.wordId)
    if (!word) return { ...a, matched: false }
    return { ...a, matched: matches(a.rawInput, word.term, settings.fuzzyToleranceBands) }
  })

  const correctCount = answers.filter((a) => a.matched).length
  const scorePct = Math.round((correctCount / wordIds.length) * 100)
  const grade = gradeLabel(scorePct, settings.gradeBands)

  const sessionData: SessionData = { ...data, exam: { ...data.exam, answers, scorePct, grade } }

  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const session = { id: `${dateStr}-${nanoid(4)}`, deckId, userId, timestamp: Date.now(), mode: body.mode, data: JSON.stringify(sessionData) }
  await db(c.env).insert(schema.sessions).values(session)

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
  const userId = c.get('userId')
  const { deckId } = c.req.param()
  return c.json(await getSettings(db(c.env), userId, deckId))
})

app.patch('/api/decks/:deckId/settings', async (c) => {
  const userId = c.get('userId')
  const { deckId } = c.req.param()
  const body = await c.req.json<Partial<Settings>>()
  const updated = { ...await getSettings(db(c.env), userId, deckId), ...body }

  const row = await db(c.env).select().from(schema.settings).where(and(eq(schema.settings.userId, userId), eq(schema.settings.deckId, deckId))).get()
  if (row) {
    await db(c.env).update(schema.settings).set({ data: JSON.stringify(updated) }).where(eq(schema.settings.id, row.id))
  } else {
    await db(c.env).insert(schema.settings).values({ id: nanoid(), userId, deckId, data: JSON.stringify(updated) })
  }
  return c.json(updated)
})

app.get('/api/settings', async (c) => {
  return c.json(await getSettings(db(c.env), c.get('userId')))
})

app.patch('/api/settings', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json<Partial<Settings>>()
  const updated = { ...await getSettings(db(c.env), userId), ...body }

  const row = await db(c.env).select().from(schema.settings).where(and(eq(schema.settings.userId, userId), isNull(schema.settings.deckId))).get()
  if (row) {
    await db(c.env).update(schema.settings).set({ data: JSON.stringify(updated) }).where(eq(schema.settings.id, row.id))
  } else {
    await db(c.env).insert(schema.settings).values({ id: nanoid(), userId, deckId: null, data: JSON.stringify(updated) })
  }
  return c.json(updated)
})

export const onRequest = handle(app)
