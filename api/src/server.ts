/**
 * Big Stick Worm API
 * ─────────────────────────────────────────────────────────────────────────────
 * Single-file Express server backed by SQLite (better-sqlite3).
 * Designed to run locally on a Mac Mini at a campsite — no cloud, no auth,
 * just a token-based worm ownership system.
 *
 * Routes:
 *   GET    /                       — landing page (phones join here)
 *   GET    /admin                  — admin panel: all worms + QR codes
 *   GET    /api/worms              — list all worms (admin use)
 *   POST   /api/worms              — create worm (Creator Studio)
 *   GET    /api/worms/:token       — fetch worm state (PWA on load)
 *   PATCH  /api/worms/:token       — sync worm state (PWA on action)
 *   GET    /api/worms/:token/qr    — re-generate QR PNG
 *   GET    /api/friends/:token     — list friend summaries
 *   POST   /api/friends/:token     — add friend by their token
 *   GET    /api/lookup             — find worm by name (?name=)
 *   GET    /health                 — health check
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';
import path from 'path';

// ── Config ─────────────────────────────────────────────────────────────────

const PORT      = parseInt(process.env.PORT ?? '3001', 10);
const CARE_URL  = process.env.CARE_URL  ?? `http://localhost:5174`;
const STUDIO_URL = process.env.STUDIO_URL ?? `http://localhost:5173`;
const DB_PATH   = process.env.DB_PATH  ??
  (process.env.RAILWAY_VOLUME_MOUNT_PATH
    ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'worms.db')
    : path.join(process.cwd(), 'worms.db'));

// ── Database setup ─────────────────────────────────────────────────────────

// Ensure DB directory exists (Railway volume may not pre-create it)
import fs from 'fs';
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

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

  CREATE TABLE IF NOT EXISTS transmissions (
    id              TEXT PRIMARY KEY,
    from_token      TEXT NOT NULL,
    to_token        TEXT NOT NULL,
    fragment        TEXT NOT NULL,
    sent_at         INTEGER NOT NULL,
    read_at         INTEGER,
    mutation_key    TEXT,
    mutation_applied INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY(from_token) REFERENCES worms(owner_token),
    FOREIGN KEY(to_token)   REFERENCES worms(owner_token)
  );

  CREATE INDEX IF NOT EXISTS idx_tx_to   ON transmissions(to_token, read_at);
  CREATE INDEX IF NOT EXISTS idx_tx_from ON transmissions(from_token);

  CREATE INDEX IF NOT EXISTS idx_worms_token ON worms(owner_token);
  CREATE INDEX IF NOT EXISTS idx_friends_token ON friends(worm_token);
`);

// ── Decay constants ────────────────────────────────────────────────────────

const MOOD_DECAY_PER_MS   = 5  / (60 * 60 * 1000);  // 5 pt/hr
const HUNGER_DECAY_PER_MS = 8  / (60 * 60 * 1000);  // 8 pt/hr
const SICK_THRESHOLD_MS   = 4  * 60 * 60 * 1000;     // 4 hours

// ── Color map for admin UI ─────────────────────────────────────────────────

const COLOR_HEX: Record<string, string> = {
  pink: '#ff00cc', green: '#aaff00', purple: '#cc00ff',
  orange: '#ff6600', blue: '#00f5ff', red: '#ff0055', yellow: '#ffff00',
};

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

  const isSick = (worm.is_sick ||
    (lowMoodSince !== null && now - lowMoodSince >= SICK_THRESHOLD_MS)) ? 1 : 0;

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

const getAllWorms = db.prepare(
  `SELECT * FROM worms ORDER BY created_at DESC`
);

const getWormByName = db.prepare<[string]>(
  `SELECT * FROM worms WHERE LOWER(name) = LOWER(?) LIMIT 1`
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
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// ── GET / — landing page ──────────────────────────────────────────────────

app.get('/', (_req: Request, res: Response) => {
  const wormCount = (db.prepare('SELECT COUNT(*) as c FROM worms').get() as { c: number }).c;
  res.setHeader('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🧠 Airvana</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      background: linear-gradient(160deg, #06000f 0%, #0a0020 50%, #060010 100%);
      color: #e0e0ff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      padding: 24px; text-align: center; gap: 32px;
    }
    .pixel { font-family: 'Press Start 2P', monospace; }
    .egg {
      width: 100px; height: 120px;
      border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
      background: linear-gradient(135deg, #cc00ff44, #00f5ff22);
      border: 2px solid rgba(0,245,255,0.4);
      box-shadow: 0 0 40px rgba(0,245,255,0.25), 0 0 80px rgba(204,0,255,0.1);
      display: flex; align-items: center; justify-content: center;
      font-size: 40px;
      animation: eggFloat 3s ease-in-out infinite;
    }
    @keyframes eggFloat {
      0%,100% { transform: translateY(0) rotate(-2deg); }
      50%      { transform: translateY(-10px) rotate(2deg); }
    }
    h1 { font-size: 14px; color: #00f5ff; text-shadow: 0 0 12px #00f5ff; line-height: 1.8; }
    .tagline { color: rgba(150,150,200,0.65); font-size: 13px; line-height: 1.6; max-width: 280px; }
    .count { font-size: 9px; color: rgba(0,245,255,0.5); }
    .btn-primary {
      display: block; width: 100%; max-width: 300px;
      padding: 18px 24px;
      background: linear-gradient(135deg, #cc00ff22, #00f5ff22);
      border: 2px solid #00f5ff;
      border-radius: 8px;
      color: #00f5ff;
      font-family: 'Press Start 2P', monospace; font-size: 10px;
      text-decoration: none; cursor: pointer;
      box-shadow: 0 0 20px rgba(0,245,255,0.2);
      transition: all 0.15s;
      line-height: 1.8;
    }
    .btn-primary:hover { box-shadow: 0 0 30px rgba(0,245,255,0.4); transform: translateY(-1px); }
    .divider { color: rgba(150,150,200,0.3); font-size: 11px; }
    .rejoin-box {
      width: 100%; max-width: 300px;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(0,245,255,0.15);
      border-radius: 8px;
      padding: 20px;
      display: flex; flex-direction: column; gap: 12px;
    }
    .rejoin-box label { font-family: 'Press Start 2P', monospace; font-size: 7px; color: rgba(0,245,255,0.6); line-height: 2; }
    .rejoin-box input {
      width: 100%; padding: 12px;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(0,245,255,0.2);
      border-radius: 4px;
      color: #e0e0ff; font-size: 13px;
      outline: none;
    }
    .rejoin-box input:focus { border-color: rgba(0,245,255,0.5); }
    .rejoin-box input::placeholder { color: rgba(150,150,200,0.3); }
    .btn-secondary {
      width: 100%; padding: 12px;
      background: rgba(0,245,255,0.08);
      border: 1px solid rgba(0,245,255,0.3);
      border-radius: 4px;
      color: #00f5ff;
      font-family: 'Press Start 2P', monospace; font-size: 7px;
      cursor: pointer; transition: all 0.15s;
    }
    .btn-secondary:hover { background: rgba(0,245,255,0.14); }
    .error { color: #ff0055; font-size: 11px; }
  </style>
</head>
<body>
  <div class="egg">🪱</div>

  <div>
    <h1 class="pixel">Big Stick Worm</h1>
    <p class="tagline">Accept the worm. Join the hive mind.</p>
    <p class="count pixel" style="margin-top:12px">${wormCount} airhead${wormCount !== 1 ? 's' : ''} initiated</p>
  </div>

  <a class="btn-primary" href="${STUDIO_URL}">🧠 Begin acceptance →</a>

  <p class="divider">— returning airhead? —</p>

  <div class="rejoin-box">
    <label>Find my worm</label>
    <input id="nameInput" type="text" placeholder="enter your worm's name" autocomplete="off" />
    <button class="btn-secondary" onclick="lookupByName()">find my worm →</button>
    <p id="nameError" class="error" style="display:none"></p>
  </div>

  <script>
    async function lookupByName() {
      const name = document.getElementById('nameInput').value.trim();
      const err  = document.getElementById('nameError');
      err.style.display = 'none';
      if (!name) { err.textContent = 'enter a name first'; err.style.display = 'block'; return; }
      try {
        const res = await fetch('/api/lookup?name=' + encodeURIComponent(name));
        if (!res.ok) { err.textContent = 'no airhead found. have you accepted?'; err.style.display = 'block'; return; }
        const data = await res.json();
        window.location.href = '${CARE_URL}/care?token=' + data.ownerToken;
      } catch (e) {
        err.textContent = 'hive signal lost';
        err.style.display = 'block';
      }
    }
    document.getElementById('nameInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') lookupByName();
    });
  </script>
</body>
</html>`);
});

// ── GET /admin — admin panel ──────────────────────────────────────────────

app.get('/admin', async (_req: Request, res: Response) => {
  const worms = getAllWorms.all() as WormRow[];
  const now   = Date.now();

  // Generate QR data URLs for each worm
  const wormsWithQr = await Promise.all(worms.map(async (w) => {
    const careUrl = `${CARE_URL}/care?token=${w.owner_token}`;
    const qrDataUrl = await QRCode.toDataURL(careUrl, {
      width: 160,
      margin: 1,
      color: { dark: '#00f5ff', light: '#0a0020' },
    });
    const stage = computeStage(w.xp, w.created_at, w.hatched);
    const ageMin = Math.round((now - w.created_at) / 60000);
    const color = COLOR_HEX[w.color] ?? '#00f5ff';
    return { ...w, qrDataUrl, stage, ageMin, color, careUrl };
  }));

  res.setHeader('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🧠 Airvana Admin</title>
  <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0a0014; color: #e0e0ff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      padding: 24px;
    }
    header {
      display: flex; align-items: baseline; justify-content: space-between;
      border-bottom: 1px solid rgba(0,245,255,0.15);
      padding-bottom: 16px; margin-bottom: 24px;
    }
    h1 { font-family: 'Press Start 2P', monospace; font-size: 11px; color: #00f5ff; text-shadow: 0 0 10px #00f5ff; }
    .meta { font-size: 11px; color: rgba(150,150,200,0.5); }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
    .card {
      background: rgba(255,255,255,0.03);
      border-radius: 10px; padding: 16px;
      display: flex; flex-direction: column; gap: 12px;
      border: 1px solid rgba(255,255,255,0.06);
    }
    .card-top { display: flex; gap: 12px; align-items: flex-start; }
    .qr-wrap { flex-shrink: 0; border-radius: 6px; overflow: hidden; background: #0a0020; padding: 4px; border: 1px solid rgba(0,245,255,0.2); }
    .card-info { flex: 1; min-width: 0; }
    .worm-name { font-family: 'Press Start 2P', monospace; font-size: 9px; line-height: 1.6; overflow: hidden; text-overflow: ellipsis; }
    .badge {
      display: inline-block;
      font-family: 'Press Start 2P', monospace; font-size: 6px;
      padding: 3px 7px; border-radius: 3px; margin-top: 6px;
    }
    .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
    .stat { font-size: 10px; color: rgba(150,150,200,0.6); }
    .stat span { color: #e0e0ff; font-weight: 600; }
    .stat-bar-wrap { display: flex; align-items: center; gap: 6px; font-size: 10px; color: rgba(150,150,200,0.5); }
    .stat-bar { flex: 1; height: 4px; background: rgba(255,255,255,0.06); border-radius: 2px; overflow: hidden; }
    .stat-bar-fill { height: 100%; border-radius: 2px; transition: width 0.3s; }
    .link { font-size: 10px; color: rgba(0,245,255,0.5); text-decoration: none; word-break: break-all; }
    .link:hover { color: #00f5ff; }
    .sick { color: #ff0055; font-family: 'Press Start 2P', monospace; font-size: 6px; }
    .empty { text-align: center; color: rgba(150,150,200,0.4); padding: 60px; font-size: 13px; }
    .refresh { font-family: 'Press Start 2P', monospace; font-size: 7px; color: rgba(0,245,255,0.4);
      background: rgba(0,245,255,0.06); border: 1px solid rgba(0,245,255,0.2); border-radius: 4px;
      padding: 6px 12px; cursor: pointer; text-decoration: none; }
    .refresh:hover { color: #00f5ff; }
  </style>
</head>
<body>
  <header>
    <h1>🧠 airvana admin</h1>
    <div style="display:flex;gap:16px;align-items:center">
      <span class="meta">${wormsWithQr.length} airhead${wormsWithQr.length !== 1 ? 's' : ''} · ${new Date().toLocaleTimeString()}</span>
      <a class="refresh" href="/admin">↺ refresh</a>
    </div>
  </header>

  ${wormsWithQr.length === 0
    ? '<div class="empty">No airheads yet. Send someone to the Acceptance Studio.</div>'
    : `<div class="grid">${wormsWithQr.map(w => {
        const stageColors: Record<string, string> = { egg: '#ff6699', baby: '#00f5ff', adult: '#aaff00', elder: '#fbbf24' };
        const stageColor = stageColors[w.stage] ?? '#00f5ff';
        const moodPct  = Math.round(w.mood);
        const hungPct  = Math.round(w.hunger);
        const ageStr   = w.ageMin < 60 ? `${w.ageMin}m` : `${Math.round(w.ageMin/60)}h`;
        return `
          <div class="card" style="border-color:${w.color}22">
            <div class="card-top">
              <div class="qr-wrap">
                <img src="${w.qrDataUrl}" width="80" height="80" alt="QR for ${w.name}" />
              </div>
              <div class="card-info">
                <div class="worm-name" style="color:${w.color}">${w.name}</div>
                <span class="badge" style="color:${stageColor};background:${stageColor}18;border:1px solid ${stageColor}44">${w.stage.toUpperCase()}</span>
                ${w.is_sick ? '<div class="sick" style="margin-top:4px">😷 sick</div>' : ''}
                <div style="font-size:10px;color:rgba(150,150,200,0.4);margin-top:4px">age ${ageStr} · xp ${w.xp}</div>
              </div>
            </div>
            <div>
              <div class="stat-bar-wrap" style="margin-bottom:6px">
                <span>💜</span>
                <div class="stat-bar"><div class="stat-bar-fill" style="width:${moodPct}%;background:${w.color}"></div></div>
                <span>${moodPct}</span>
              </div>
              <div class="stat-bar-wrap">
                <span>🍕</span>
                <div class="stat-bar"><div class="stat-bar-fill" style="width:${hungPct}%;background:#aaff00"></div></div>
                <span>${hungPct}</span>
              </div>
            </div>
            <a class="link" href="${w.careUrl}" target="_blank">open worm →</a>
          </div>`;
      }).join('')}</div>`
  }

  <script>setTimeout(() => location.reload(), 30000);</script>
</body>
</html>`);
});

// ── GET /health ────────────────────────────────────────────────────────────

app.get('/health', (_req: Request, res: Response) => {
  res.json({ ok: true, worms: (db.prepare('SELECT COUNT(*) as c FROM worms').get() as { c: number }).c });
});

// ── GET /api/lookup?name= — find worm by name ────────────────────────────

app.get('/api/lookup', (req: Request, res: Response) => {
  const name = (req.query.name as string | undefined)?.trim();
  if (!name) { res.status(400).json({ error: 'name required' }); return; }
  const row = getWormByName.get(name) as WormRow | undefined;
  if (!row) { res.status(404).json({ error: 'worm not found' }); return; }
  res.json(dbRowToWorm(row));
});

// ── GET /api/worms — list all worms ──────────────────────────────────────

app.get('/api/worms', (_req: Request, res: Response) => {
  const rows = getAllWorms.all() as WormRow[];
  res.json(rows.map(dbRowToWorm));
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

  const now      = Date.now();
  const decayed  = applyDecay(raw, now);
  const newStage = computeStage(raw.xp, raw.created_at, raw.hatched);

  if (Object.keys(decayed).length > 0 || newStage !== raw.stage) {
    updateWorm.run({ ...raw, ...decayed, stage: newStage, owner_token: raw.owner_token });
  }

  const updated = getWormByToken.get(req.params.token) as WormRow;
  res.json(dbRowToWorm(updated));
});

// ── PATCH /api/worms/:token — sync state from PWA ─────────────────────────

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
    owner_token:    raw.owner_token,
    name:           raw.name,
    hat:            body.hat            ?? raw.hat,
    shades:         body.shades         ?? raw.shades,
    stage:          newStage,
    hatched:        body.hatched !== undefined ? (body.hatched ? 1 : 0) : raw.hatched,
    mood:           body.mood           ?? raw.mood,
    hunger:         body.hunger         ?? raw.hunger,
    is_sick:        body.isSick !== undefined ? (body.isSick ? 1 : 0) : raw.is_sick,
    xp:             body.xp             ?? raw.xp,
    feed_count:     body.feedCount      ?? raw.feed_count,
    game_count:     body.gameCount      ?? raw.game_count,
    login_streak:   body.loginStreak    ?? raw.login_streak,
    last_login_day: body.lastLoginDay   ?? raw.last_login_day,
    low_mood_since: body.lowMoodSince   !== undefined ? body.lowMoodSince : raw.low_mood_since,
    last_checked:   body.lastChecked    ?? now,
  });

  const updated = getWormByToken.get(req.params.token) as WormRow;
  res.json(dbRowToWorm(updated));
});

// ── GET /api/worms/:token/qr ──────────────────────────────────────────────

app.get('/api/worms/:token/qr', async (req: Request, res: Response) => {
  const raw = getWormByToken.get(req.params.token) as WormRow | undefined;
  if (!raw) { res.status(404).json({ error: 'worm not found' }); return; }

  const careUrl = `${CARE_URL}/care?token=${raw.owner_token}`;
  const png     = await QRCode.toBuffer(careUrl, {
    type: 'png', width: 300,
    color: { dark: '#00f5ff', light: '#0a0020' },
  });
  res.setHeader('Content-Type', 'image/png');
  res.send(png);
});

// ── GET /api/friends/:token ────────────────────────────────────────────────

app.get('/api/friends/:token', (req: Request, res: Response) => {
  const worm = getWormByToken.get(req.params.token);
  if (!worm) { res.status(404).json({ error: 'worm not found' }); return; }
  res.json(getFriends.all(req.params.token));
});

// ── POST /api/friends/:token ──────────────────────────────────────────────

app.post('/api/friends/:token', (req: Request, res: Response) => {
  const { friendToken } = req.body as { friendToken?: string };
  const myToken         = req.params.token;

  if (!friendToken)            { res.status(400).json({ error: 'friendToken required' }); return; }
  if (friendToken === myToken) { res.status(400).json({ error: 'cannot friend yourself' }); return; }

  const friendExists = getWormByToken.get(friendToken);
  if (!friendExists) { res.status(404).json({ error: 'friend worm not found' }); return; }

  const myWorm = getWormByToken.get(myToken) as WormRow | undefined;
  if (!myWorm) { res.status(404).json({ error: 'your worm not found' }); return; }

  const now = Date.now();
  upsertFriend.run({ worm_token: myToken,      friend_token: friendToken, now });
  upsertFriend.run({ worm_token: friendToken,  friend_token: myToken,     now });

  db.prepare(`UPDATE worms SET mood = MIN(100, mood + 10), xp = xp + 5 WHERE owner_token = ?`).run(myToken);
  db.prepare(`UPDATE worms SET mood = MIN(100, mood + 10), xp = xp + 5 WHERE owner_token = ?`).run(friendToken);

  res.json({ result: 'ok', now });
});

// ── Error handler ─────────────────────────────────────────────────────────

// ── Mutation engine ────────────────────────────────────────────────────────
// A "thought fragment" carries a mutation key that flips one genome byte
// or shifts the worm's trait when the receiver opens the transmission.

const TRAITS = ['sleepy', 'hyper', 'grumpy', 'chill', 'bubbly', 'spooky'] as const;

// 20 curated fragments — each maps to a mutation_key
const FRAGMENTS: Array<{ text: string; mutationKey: string; label: string }> = [
  { text: 'a memory that doesn\'t belong to you',        mutationKey: 'eye_shift',      label: 'Eye Shift' },
  { text: 'the feeling of falling upward',               mutationKey: 'body_morph',     label: 'Body Morph' },
  { text: 'something that hums in the dark',             mutationKey: 'glow_surge',     label: 'Glow Surge' },
  { text: 'a thought about teeth',                       mutationKey: 'mouth_warp',     label: 'Mouth Warp' },
  { text: 'the color of a sound you heard once',         mutationKey: 'marking_bloom',  label: 'Marking Bloom' },
  { text: 'an itch behind the eyes',                     mutationKey: 'pupil_split',    label: 'Pupil Split' },
  { text: 'a name you almost remember',                  mutationKey: 'tail_mutation',  label: 'Tail Mutation' },
  { text: 'the urge to become something softer',         mutationKey: 'nub_growth',     label: 'Nub Growth' },
  { text: 'static where silence should be',              mutationKey: 'trait_echo',     label: 'Trait Echo' },
  { text: 'the exact weight of a secret',                mutationKey: 'body_morph',     label: 'Body Morph' },
  { text: 'light from a source you can\'t locate',       mutationKey: 'glow_surge',     label: 'Glow Surge' },
  { text: 'a dream that isn\'t finished',                 mutationKey: 'eye_shift',      label: 'Eye Shift' },
  { text: 'the sound of your own name said wrong',       mutationKey: 'mouth_warp',     label: 'Mouth Warp' },
  { text: 'warmth from a direction that doesn\'t exist', mutationKey: 'marking_bloom',  label: 'Marking Bloom' },
  { text: 'a feeling of being very slightly translated', mutationKey: 'trait_echo',     label: 'Trait Echo' },
  { text: 'the memory of a colour you\'ve never seen',   mutationKey: 'pupil_split',    label: 'Pupil Split' },
  { text: 'the part of you that watches you sleep',      mutationKey: 'tail_mutation',  label: 'Tail Mutation' },
  { text: 'an urgency with no object',                   mutationKey: 'nub_growth',     label: 'Nub Growth' },
  { text: 'the version of yourself you almost became',   mutationKey: 'body_morph',     label: 'Body Morph' },
  { text: 'something that has been waiting',             mutationKey: 'glow_surge',     label: 'Glow Surge' },
];

function pickFragment(): typeof FRAGMENTS[number] {
  return FRAGMENTS[Math.floor(Math.random() * FRAGMENTS.length)];
}

// Genome byte indices per mutation key
const MUTATION_GENOME_BYTE: Record<string, number> = {
  body_morph:    1,
  eye_shift:     2,
  tail_mutation: 3,
  marking_bloom: 4,
  nub_growth:    6,
  mouth_warp:    8,
  glow_surge:    9,
  pupil_split:   11,
  trait_echo:    -1, // special: shifts the trait field
};

function applyMutation(worm: WormRow, mutationKey: string): { genome: string; trait: string } {
  let genome = (worm.genome || '').padEnd(32, '0');
  let trait  = worm.trait;

  const byteIdx = MUTATION_GENOME_BYTE[mutationKey] ?? 0;

  if (mutationKey === 'trait_echo') {
    // Shift trait one step around the ring
    const idx = (TRAITS.indexOf(trait as typeof TRAITS[number]) + 1) % TRAITS.length;
    trait = TRAITS[idx];
  } else {
    // Flip 1–3 bits in the target genome byte (XOR with random nibble)
    const pos  = byteIdx * 2;
    const cur  = parseInt(genome.slice(pos, pos + 2) || '00', 16);
    const flip = (Math.floor(Math.random() * 14) + 1); // 1–14
    const next = (cur ^ flip) & 0xff;
    const hex  = next.toString(16).padStart(2, '0');
    genome = genome.slice(0, pos) + hex + genome.slice(pos + 2);
  }

  return { genome, trait };
}

// ── Prepared statements for transmissions ─────────────────────────────────

const insertTx = db.prepare(`
  INSERT INTO transmissions (id, from_token, to_token, fragment, sent_at, mutation_key, mutation_applied)
  VALUES (@id, @from_token, @to_token, @fragment, @sent_at, @mutation_key, 0)
`);

const getInbox = db.prepare<[string]>(`
  SELECT t.id, t.from_token, t.fragment, t.sent_at, t.read_at,
         t.mutation_key, t.mutation_applied,
         w.name AS from_name, w.color AS from_color
  FROM   transmissions t
  JOIN   worms w ON w.owner_token = t.from_token
  WHERE  t.to_token = ?
  ORDER  BY t.sent_at DESC
  LIMIT  30
`);

const getUnreadCount = db.prepare<[string]>(
  `SELECT COUNT(*) AS n FROM transmissions WHERE to_token = ? AND read_at IS NULL`
);

const markRead = db.prepare<[number, string]>(
  `UPDATE transmissions SET read_at = ? WHERE id = ? AND read_at IS NULL`
);

const getTx = db.prepare<[string]>(
  `SELECT * FROM transmissions WHERE id = ?`
);

const sentToday = db.prepare<[string, string, number]>(
  `SELECT COUNT(*) AS n FROM transmissions WHERE from_token = ? AND to_token = ? AND sent_at > ?`
);

// ── POST /api/transmit/:token — send thought fragment ────────────────────

app.post('/api/transmit/:token', (req: Request, res: Response) => {
  const myToken     = req.params.token;
  const { toToken } = req.body as { toToken?: string };

  if (!toToken)           { res.status(400).json({ error: 'toToken required' }); return; }
  if (toToken === myToken){ res.status(400).json({ error: 'cannot transmit to yourself' }); return; }

  const sender   = getWormByToken.get(myToken);
  const receiver = getWormByToken.get(toToken);
  if (!sender)   { res.status(404).json({ error: 'your worm not found' }); return; }
  if (!receiver) { res.status(404).json({ error: 'target worm not found' }); return; }

  // Rate limit: max 3 transmissions per sender→receiver pair per 24h
  const cutoff  = Date.now() - 24 * 60 * 60 * 1000;
  const { n }   = sentToday.get(myToken, toToken, cutoff) as { n: number };
  if (n >= 3)   { res.status(429).json({ error: 'transmission limit reached (3/day per worm)' }); return; }

  const frag = pickFragment();
  const id   = crypto.randomUUID();
  const now  = Date.now();

  insertTx.run({
    id,
    from_token:   myToken,
    to_token:     toToken,
    fragment:     frag.text,
    sent_at:      now,
    mutation_key: frag.mutationKey,
  });

  // Sender reward: small XP for transmitting
  db.prepare(`UPDATE worms SET xp = xp + 10, mood = MIN(100, mood + 5) WHERE owner_token = ?`).run(myToken);

  res.json({ id, fragment: frag.text, mutationKey: frag.mutationKey, label: frag.label });
});

// ── GET /api/transmit/:token/inbox — get inbox ────────────────────────────

app.get('/api/transmit/:token/inbox', (req: Request, res: Response) => {
  const worm = getWormByToken.get(req.params.token);
  if (!worm) { res.status(404).json({ error: 'worm not found' }); return; }

  const rows = getInbox.all(req.params.token);
  const unread = (getUnreadCount.get(req.params.token) as { n: number }).n;

  res.json({ transmissions: rows, unread });
});

// ── POST /api/transmit/:token/absorb/:txId — absorb + mutate ─────────────

app.post('/api/transmit/:token/absorb/:txId', (req: Request, res: Response) => {
  const { token, txId } = req.params;

  const tx = getTx.get(txId) as {
    id: string; from_token: string; to_token: string;
    fragment: string; mutation_key: string; mutation_applied: number;
  } | undefined;

  if (!tx)                { res.status(404).json({ error: 'transmission not found' }); return; }
  if (tx.to_token !== token) { res.status(403).json({ error: 'not your transmission' }); return; }
  if (tx.mutation_applied){ res.status(409).json({ error: 'already absorbed' }); return; }

  const worm = getWormByToken.get(token) as WormRow | undefined;
  if (!worm) { res.status(404).json({ error: 'worm not found' }); return; }

  const now = Date.now();
  markRead.run(now, txId);

  const { genome, trait } = applyMutation(worm, tx.mutation_key);

  // XP reward for absorbing
  const xpGain = 30;

  db.prepare(`
    UPDATE worms
    SET genome = @genome, trait = @trait,
        xp = xp + @xp, mood = MIN(100, mood + 15)
    WHERE owner_token = @token
  `).run({ genome, trait, xp: xpGain, token });

  db.prepare(`UPDATE transmissions SET mutation_applied = 1 WHERE id = ?`).run(txId);

  // Find the mutation label
  const mutDef = FRAGMENTS.find(f => f.mutationKey === tx.mutation_key);

  res.json({
    mutationKey:   tx.mutation_key,
    mutationLabel: mutDef?.label ?? tx.mutation_key,
    traitChanged:  trait !== worm.trait,
    newTrait:      trait,
    genomeChanged: genome !== worm.genome,
    xpGained:      xpGain,
  });
});

// ── GET /api/transmit/:token/unread — unread badge count ─────────────────

app.get('/api/transmit/:token/unread', (req: Request, res: Response) => {
  const worm = getWormByToken.get(req.params.token);
  if (!worm) { res.status(404).json({ error: 'worm not found' }); return; }
  const { n } = getUnreadCount.get(req.params.token) as { n: number };
  res.json({ unread: n });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'internal server error' });
});

// ── Start ─────────────────────────────────────────────────────────────────

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🪱 Worm API running on http://0.0.0.0:${PORT}`);
  console.log(`   Landing page: http://localhost:${PORT}/`);
  console.log(`   Admin panel:  http://localhost:${PORT}/admin`);
  console.log(`   Care PWA URL: ${CARE_URL}`);
  console.log(`   DB: ${DB_PATH}`);
});
