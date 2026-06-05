/**
 * Big Stick Worm API
 * ─────────────────────────────────────────────────────────────────────────────
 * Single-file Express server backed by SQLite (better-sqlite3).
 * Designed to run locally on a Mac Mini at a campsite — no cloud, no auth,
 * just a token-based worm ownership system.
 *
 * Routes:
 *   POST   /api/worms              — create worm (Creator Studio)
 *   GET    /api/worms/:token       — fetch worm state (PWA on load)
 *   PATCH  /api/worms/:token       — sync worm state (PWA on action)
 *   GET    /api/worms/:token/qr    — re-generate QR PNG (optional utility)
 *   GET    /api/friends/:token     — list friend summaries
 *   POST   /api/friends/:token     — add friend by their token
 *   GET    /health                 — health check
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';

// ── Config ─────────────────────────────────────────────────────────────────

const PORT      = parseInt(process.env.PORT ?? '3001', 10);
const CARE_URL  = process.env.CARE_URL ?? `http://localhost:5174`;
const DB_PATH   = process.env.DB_PATH  ?? path.join(process.cwd(), 'worms.db');

// ── Database setup ─────────────────────────────────────────────────────────

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS worms (
    id              TEXT PRIMARY KEY,
    owner_token     TEXT UNIQUE NOT NULL,
    name            TEXT NOT NULL,
    color           TEXT NOT NULL DEFAULT 'blue',
    hat             TEXT NOT NULL DEFAULT 'none',
    shades          TEXT NOT NULL DEFAULT 'none',
    trait           TEXT NOT NULL DEFAULT 'chill',
    genome          TEXT NOT NULL DEFAULT '',
    stage           TEXT NOT NULL DEFAULT 'egg',
    hatched         INTEGER NOT NULL DEFAULT 0,
    mood            REAL NOT NULL DEFAULT 80,
    hunger          REAL NOT NULL DEFAULT 75,
    is_sick         INTEGER NOT NULL DEFAULT 0,
    xp              INTEGER NOT NULL DEFAULT 0,
    feed_count      INTEGER NOT NULL DEFAULT 0,
    game_count      INTEGER NOT NULL DEFAULT 0,
    login_streak    INTEGER NOT NULL DEFAULT 1,
    last_login_day  TEXT NOT NULL DEFAULT '',
    low_mood_since  INTEGER,
    last_checked    INTEGER NOT NULL,
    created_at      INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS friends (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    worm_token      TEXT NOT NULL,
    friend_token    TEXT NOT NULL,
    first_met_at    INTEGER NOT NULL,
    last_met_at     INTEGER NOT NULL,
    meet_count      INTEGER NOT NULL DEFAULT 1,
    UNIQUE(worm_token, friend_token),
    FOREIGN KEY(worm_token) REFERENCES worms(owner_token)
  );

  CREATE INDEX IF NOT EXISTS idx_worms_token ON worms(owner_token);
  CREATE INDEX IF NOT EXISTS idx_friends_token ON friends(worm_token);
`);

// ── Decay constants ────────────────────────────────────────────────────────

const MOOD_DECAY_PER_MS   = 5  / (60 * 60 * 1000);  // 5 pt/hr
const HUNGER_DECAY_PER_MS = 8  / (60 * 60 * 1000);  // 8 pt/hr
const SICK_THRESHOLD_MS   = 4  * 60 * 60 * 1000;     // 4 hours

// ── Helpers ────────────────────────────────────────────────────────────────

function clamp(n: number) { return Math.min(100, Math.max(0, n)); }

function applyDecay(worm: WormRow, now: number): Partial<WormRow> {
  const elapsed = now - worm.last_checked;
  if (elapsed <= 0) return {};

  const newHunger     = clamp(worm.hunger - elapsed * HUNGER_DECAY_PER_MS);
  const moodMult      = newHunger < 30 ? 2 : 1;
  const newMood       = clamp(worm.mood  - elapsed * MOOD_DECAY_PER_MS * moodMult);

  let lowMoodSince = worm.low_mood_since;
  if (newMood < 20) {
    if (lowMoodSince === null) lowMoodSince = worm.last_checked;
  } else {
    lowMoodSince = null;
  }

  const isSick = worm.is_sick ||
    (lowMoodSince !== null && now - lowMoodSince >= SICK_THRESHOLD_MS) ? 1 : 0;

  return {
    mood: newMood,
    hunger: newHunger,
    is_sick: isSick,
    low_mood_since: lowMoodSince,
    last_checked: now,
  };
}

function computeStage(xp: number, createdAt: number, hatched: number): string {
  if (!hatched) return 'egg';
  const age = Date.now() - createdAt;
  const ADULT_XP  = 500;  const ADULT_AGE  = 3  * 86400000;
  const ELDER_XP  = 2000; const ELDER_AGE  = 14 * 86400000;
  if (xp >= ELDER_XP && age >= ELDER_AGE) return 'elder';
  if (xp >= ADULT_XP && age >= ADULT_AGE) return 'adult';
  return 'baby';
}

function dbRowToWorm(row: WormRow) {
  return {
    id:           row.id,
    ownerToken:   row.owner_token,
    name:         row.name,
    color:        row.color,
    hat:          row.hat,
    shades:       row.shades,
    trait:        row.trait,
    genome:       row.genome,
    stage:        row.stage,
    hatched:      row.hatched === 1,
    mood:         row.mood,
    hunger:       row.hunger,
    isSick:       row.is_sick === 1,
    xp:           row.xp,
    feedCount:    row.feed_count,
    gameCount:    row.game_count,
    loginStreak:  row.login_streak,
    lastLoginDay: row.last_login_day,
    lowMoodSince: row.low_mood_since,
    lastChecked:  row.last_checked,
    createdAt:    row.created_at,
  };
}

interface WormRow {
  id: string;
  owner_token: string;
  name: string;
  color: string;
  hat: string;
  shades: string;
  trait: string;
  genome: string;
  stage: string;
  hatched: number;
  mood: number;
  hunger: number;
  is_sick: number;
  xp: number;
  feed_count: number;
  game_count: number;
  login_streak: number;
  last_login_day: string;
  low_mood_since: number | null;
  last_checked: number;
  created_at: number;
}

// ── Prepared statements ────────────────────────────────────────────────────

const insertWorm = db.prepare(`
  INSERT INTO worms (id, owner_token, name, color, hat, shades, trait, genome,
                     stage, hatched, mood, hunger, is_sick, xp, feed_count, game_count,
                     login_streak, last_login_day, low_mood_since, last_checked, created_at)
  VALUES (@id, @owner_token, @name, @color, @hat, @shades, @trait, @genome,
          @stage, @hatched, @mood, @hunger, @is_sick, @xp, @feed_count, @game_count,
          @login_streak, @last_login_day, @low_mood_since, @last_checked, @created_at)
`);

const getWormByToken = db.prepare<[string]>(
  `SELECT * FROM worms WHERE owner_token = ?`
);

const updateWorm = db.prepare(`
  UPDATE worms SET
    name           = @name,
    hat            = @hat,
    shades         = @shades,
    stage          = @stage,
    hatched        = @hatched,
    mood           = @mood,
    hunger         = @hunger,
    is_sick        = @is_sick,
    xp             = @xp,
    feed_count     = @feed_count,
    game_count     = @game_count,
    login_streak   = @login_streak,
    last_login_day = @last_login_day,
    low_mood_since = @low_mood_since,
    last_checked   = @last_checked
  WHERE owner_token = @owner_token
`);

const upsertFriend = db.prepare(`
  INSERT INTO friends (worm_token, friend_token, first_met_at, last_met_at, meet_count)
  VALUES (@worm_token, @friend_token, @now, @now, 1)
  ON CONFLICT(worm_token, friend_token) DO UPDATE SET
    last_met_at = @now,
    meet_count  = meet_count + 1
`);

const getFriends = db.prepare<[string]>(
  `SELECT f.friend_token, f.first_met_at, f.last_met_at, f.meet_count,
          w.name AS friend_name, w.color AS friend_color
   FROM friends f
   LEFT JOIN worms w ON w.owner_token = f.friend_token
   WHERE f.worm_token = ?
   ORDER BY f.last_met_at DESC`
);

// ── App ────────────────────────────────────────────────────────────────────

const app = express();
app.use(cors());
app.use(express.json());

// Health
app.get('/health', (_req: Request, res: Response) => {
  res.json({ ok: true, worms: (db.prepare('SELECT COUNT(*) as c FROM worms').get() as { c: number }).c });
});

// ── POST /api/worms — create worm ─────────────────────────────────────────

app.post('/api/worms', (req: Request, res: Response) => {
  const { name, color, hat, shades, trait, genome } = req.body as {
    name?: string; color?: string; hat?: string;
    shades?: string; trait?: string; genome?: string;
  };

  if (!name || typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'name required' });
    return;
  }

  const now        = Date.now();
  const id         = uuidv4();
  const ownerToken = uuidv4();

  insertWorm.run({
    id,
    owner_token:   ownerToken,
    name:          name.trim().slice(0, 30),
    color:         color         ?? 'blue',
    hat:           hat           ?? 'none',
    shades:        shades        ?? 'none',
    trait:         trait         ?? 'chill',
    genome:        genome        ?? '',
    stage:         'egg',
    hatched:       0,
    mood:          80,
    hunger:        75,
    is_sick:       0,
    xp:            0,
    feed_count:    0,
    game_count:    0,
    login_streak:  1,
    last_login_day: new Date(now).toISOString().slice(0, 10),
    low_mood_since: null,
    last_checked:  now,
    created_at:    now,
  });

  const careUrl = `${CARE_URL}/care?token=${ownerToken}`;

  res.status(201).json({
    id,
    ownerToken,
    careUrl,
    worm: dbRowToWorm(getWormByToken.get(ownerToken) as WormRow),
  });
});

// ── GET /api/worms/:token — fetch worm ────────────────────────────────────

app.get('/api/worms/:token', (req: Request, res: Response) => {
  const raw = getWormByToken.get(req.params.token) as WormRow | undefined;
  if (!raw) { res.status(404).json({ error: 'worm not found' }); return; }

  // Apply server-side decay on read
  const now     = Date.now();
  const decayed = applyDecay(raw, now);
  const newStage = computeStage(raw.xp, raw.created_at, raw.hatched);

  if (Object.keys(decayed).length > 0 || newStage !== raw.stage) {
    updateWorm.run({
      ...raw,
      ...decayed,
      stage:         newStage,
      owner_token:   raw.owner_token,
    });
  }

  const updated = getWormByToken.get(req.params.token) as WormRow;
  res.json(dbRowToWorm(updated));
});

// ── PATCH /api/worms/:token — sync state from PWA ────────────────────────

app.patch('/api/worms/:token', (req: Request, res: Response) => {
  const raw = getWormByToken.get(req.params.token) as WormRow | undefined;
  if (!raw) { res.status(404).json({ error: 'worm not found' }); return; }

  const body = req.body as Partial<{
    hat: string; shades: string; hatched: boolean;
    mood: number; hunger: number; isSick: boolean;
    xp: number; feedCount: number; gameCount: number;
    loginStreak: number; lastLoginDay: string;
    lowMoodSince: number | null; lastChecked: number;
  }>;

  const now      = Date.now();
  const newStage = computeStage(
    body.xp ?? raw.xp,
    raw.created_at,
    body.hatched !== undefined ? (body.hatched ? 1 : 0) : raw.hatched
  );

  updateWorm.run({
    owner_token:   raw.owner_token,
    name:          raw.name,
    hat:           body.hat            ?? raw.hat,
    shades:        body.shades         ?? raw.shades,
    stage:         newStage,
    hatched:       body.hatched !== undefined ? (body.hatched ? 1 : 0) : raw.hatched,
    mood:          body.mood           ?? raw.mood,
    hunger:        body.hunger         ?? raw.hunger,
    is_sick:       body.isSick !== undefined ? (body.isSick ? 1 : 0) : raw.is_sick,
    xp:            body.xp             ?? raw.xp,
    feed_count:    body.feedCount      ?? raw.feed_count,
    game_count:    body.gameCount      ?? raw.game_count,
    login_streak:  body.loginStreak    ?? raw.login_streak,
    last_login_day:body.lastLoginDay   ?? raw.last_login_day,
    low_mood_since:body.lowMoodSince   !== undefined ? body.lowMoodSince : raw.low_mood_since,
    last_checked:  body.lastChecked    ?? now,
  });

  const updated = getWormByToken.get(req.params.token) as WormRow;
  res.json(dbRowToWorm(updated));
});

// ── GET /api/worms/:token/qr — regenerate QR PNG ─────────────────────────

app.get('/api/worms/:token/qr', async (req: Request, res: Response) => {
  const raw = getWormByToken.get(req.params.token) as WormRow | undefined;
  if (!raw) { res.status(404).json({ error: 'worm not found' }); return; }

  const careUrl = `${CARE_URL}/care?token=${raw.owner_token}`;
  const png     = await QRCode.toBuffer(careUrl, {
    type: 'png',
    width: 300,
    color: { dark: '#00f5ff', light: '#0a0020' },
  });
  res.setHeader('Content-Type', 'image/png');
  res.send(png);
});

// ── GET /api/friends/:token ────────────────────────────────────────────────

app.get('/api/friends/:token', (req: Request, res: Response) => {
  const rows = getFriends.all(req.params.token);
  res.json(rows);
});

// ── POST /api/friends/:token ──────────────────────────────────────────────

app.post('/api/friends/:token', (req: Request, res: Response) => {
  const { friendToken } = req.body as { friendToken?: string };
  const myToken         = req.params.token;

  if (!friendToken)         { res.status(400).json({ error: 'friendToken required' }); return; }
  if (friendToken === myToken) { res.status(400).json({ error: 'cannot friend yourself' }); return; }

  const friendExists = getWormByToken.get(friendToken);
  if (!friendExists) { res.status(404).json({ error: 'friend worm not found' }); return; }

  const myWorm = getWormByToken.get(myToken) as WormRow | undefined;
  if (!myWorm) { res.status(404).json({ error: 'your worm not found' }); return; }

  const now = Date.now();

  // Upsert both sides
  upsertFriend.run({ worm_token: myToken,     friend_token: friendToken, now });
  upsertFriend.run({ worm_token: friendToken, friend_token: myToken,     now });

  // Mood boost for both worms
  db.prepare(`UPDATE worms SET mood = MIN(100, mood + 10), xp = xp + 5 WHERE owner_token = ?`).run(myToken);
  db.prepare(`UPDATE worms SET mood = MIN(100, mood + 10), xp = xp + 5 WHERE owner_token = ?`).run(friendToken);

  res.json({ result: 'ok', now });
});

// ── Error handler ─────────────────────────────────────────────────────────

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'internal server error' });
});

// ── Start ─────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`🪱 Worm API running on http://localhost:${PORT}`);
  console.log(`   Care PWA URL: ${CARE_URL}`);
  console.log(`   DB: ${DB_PATH}`);
});
