import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const decks = sqliteTable('decks', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  targetLanguage: text('target_language').notNull(),
  nativeLanguage: text('native_language').notNull(),
  createdAt: integer('created_at').notNull(),
})

export const words = sqliteTable('words', {
  id: text('id').primaryKey(),
  deckId: text('deck_id')
    .notNull()
    .references(() => decks.id, { onDelete: 'cascade' }),
  term: text('term').notNull(),
  translation: text('translation').notNull(),
  levelTag: text('level_tag'),
  categoryTag: text('category_tag'),
  notes: text('notes'),
  example: text('example'),
  exampleTranslation: text('example_translation'),
  createdAt: integer('created_at').notNull(),
  timesSeenInExam: integer('times_seen_in_exam').notNull().default(0),
  timesCorrectInExam: integer('times_correct_in_exam').notNull().default(0),
  timesWrongInExam: integer('times_wrong_in_exam').notNull().default(0),
  streak: integer('streak').notNull().default(0),
  weak: integer('weak').notNull().default(0), // 0 | 1
  lastSeenAt: integer('last_seen_at'),
})

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  deckId: text('deck_id')
    .notNull()
    .references(() => decks.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),
  timestamp: integer('timestamp').notNull(),
  mode: text('mode').notNull(), // 'normal' | 'review'
  data: text('data').notNull(), // JSON blob — full SessionData
})

export const settings = sqliteTable('settings', {
  id: text('id').primaryKey(),
  deckId: text('deck_id').references(() => decks.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),
  data: text('data').notNull(), // JSON blob of Settings
})

export const otps = sqliteTable('otps', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  code: text('code').notNull(),
  expiresAt: integer('expires_at').notNull(),
  used: integer('used').notNull().default(0),
})

export const authSessions = sqliteTable('auth_sessions', {
  token: text('token').primaryKey(),
  email: text('email').notNull(),
  expiresAt: integer('expires_at').notNull(),
})

export const bannedEmails = sqliteTable('banned_emails', {
  email: text('email').primaryKey(),
  bannedAt: integer('banned_at').notNull(),
})
