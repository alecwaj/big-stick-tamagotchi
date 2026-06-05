# Big Stick Worm 🪱

A campsite Tamagotchi system. Design your worm on a Mac Mini Creator Studio, scan the QR code, and carry your worm in your pocket all weekend.

## Architecture

```
creator-studio/   React SPA (desktop) — design worm, generate QR
care-pwa/         React PWA (mobile) — ongoing care, games, evolution
api/              Express + SQLite backend — runs locally on Mac Mini
shared/           genome.ts — shared worm DNA logic
```

## Quick start (local / Mac Mini)

### 1. Start the API

```bash
cd api
npm install
npm run dev
# Running on http://localhost:3001
```

### 2. Start Creator Studio (desktop)

```bash
cd creator-studio
npm install
npm run dev
# http://localhost:5173
```

### 3. Start Care PWA (mobile, on the same network)

```bash
cd care-pwa
npm install
npm run dev -- --host
# http://192.168.x.x:5174  ← share this address with campers
```

Open Creator Studio on the Mac Mini. Campers design their worm, hit **Hatch**, scan the QR → phone opens the Care PWA with their egg. Tap the egg → it hatches.

## Genome system

Every worm gets a 32-char hex genome at creation. It deterministically drives:

- Body shape (round / tapered / lumpy / ribbed)
- Segment count (3–9, revealed over time as worm grows)
- Eye style (beady / wide / sleepy / compound / hearts)
- Tail type (flat / pointed / frilly / club / split)
- Markings (none / stripes / spots / rings / gradient / zigzag)
- Nubs (none / tiny / wavy / spiky / leafy) — adult/elder only
- Mouth (smile / smirk / ooh / beam / fangs)
- Cheeks (none / rosy / freckles / star)
- Glow intensity (low / medium / high / pulse)
- Pupil style (dot / oval / cross / star / heart)

~100 distinct evolutionary paths from combinations of these traits.

## API routes

| Method | Route | Purpose |
|--------|-------|---------|
| POST | /api/worms | Create worm (Creator Studio) |
| GET | /api/worms/:token | Fetch worm state |
| PATCH | /api/worms/:token | Sync worm state (PWA actions) |
| GET | /api/worms/:token/qr | Re-generate QR PNG |
| GET | /api/friends/:token | List friends |
| POST | /api/friends/:token | Add friend |
| GET | /health | Health check |

## Evolution stages

| Stage | Trigger | Visual |
|-------|---------|--------|
| Egg | At creation | Bouncing egg, mystery inside |
| Baby | First tap (hatch) | 2 body segments, big eyes |
| Adult | 500 XP + 3 days | 4–6 segments, markings appear, nubs |
| Elder | 2000 XP + 14 days | Full segments, crown, intensified glow |
