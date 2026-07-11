/**
 * useWorm — Care PWA worm state hook with backend sync.
 *
 * Hydration priority:
 *  1. On first load with a token → fetch from API (real worm state)
 *  2. Subsequent loads → serve from localStorage (fast, offline-friendly)
 *     but also re-sync from API in the background
 *  3. All actions → update localStorage immediately + PATCH to API async
 *
 * The egg → hatch flow:
 *  - On first scan, worm arrives as stage='egg', hatched=false
 *  - User taps the egg → hatch() is called
 *  - Local state flips to hatched=true, stage='baby'
 *  - PATCH sent to API to persist the hatch
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  type WormState,
  type WormStage,
  type AddFriendResult,
  MOOD_DECAY_PER_MS,
  HUNGER_DECAY_PER_MS,
  SICK_THRESHOLD_MS,
  ADULT_XP_THRESHOLD,
  ELDER_XP_THRESHOLD,
  ADULT_AGE_MS,
  ELDER_AGE_MS,
} from '../types';

const STORAGE_KEY    = 'worm_state_v2';
const TICK_INTERVAL  = 5000;
const API_BASE       = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

// ── Stage computation ─────────────────────────────────────────────────────

function computeStage(xp: number, createdAt: number, hatched: boolean): WormStage {
  if (!hatched) return 'egg';
  const age = Date.now() - createdAt;
  if (xp >= ELDER_XP_THRESHOLD && age >= ELDER_AGE_MS) return 'elder';
  if (xp >= ADULT_XP_THRESHOLD && age >= ADULT_AGE_MS) return 'adult';
  return 'baby';
}

// ── Decay ─────────────────────────────────────────────────────────────────

function applyDecay(state: WormState, now: number): WormState {
  if (!state.hatched) return { ...state, lastChecked: now }; // eggs don't decay
  const elapsed = now - state.lastChecked;
  if (elapsed <= 0) return state;

  const hungerDrop   = elapsed * HUNGER_DECAY_PER_MS;
  const newHunger    = Math.max(0, state.hunger - hungerDrop);
  const moodMult     = newHunger < 30 ? 2 : 1;
  const moodDrop     = elapsed * MOOD_DECAY_PER_MS * moodMult;
  const newMood      = Math.max(0, state.mood - moodDrop);

  let lowMoodSince = state.lowMoodSince;
  if (newMood < 20) {
    if (lowMoodSince === null) lowMoodSince = state.lastChecked;
  } else {
    lowMoodSince = null;
  }

  const isSick =
    state.isSick ||
    (lowMoodSince !== null && now - lowMoodSince >= SICK_THRESHOLD_MS);

  const newStage = computeStage(state.xp, state.createdAt, state.hatched);
  let hat = state.hat;
  if (newStage === 'elder' && hat === 'none') hat = 'tophat';

  return {
    ...state,
    mood: newMood,
    hunger: newHunger,
    isSick,
    lowMoodSince,
    stage: newStage,
    hat,
    lastChecked: now,
  };
}

// ── Streak ────────────────────────────────────────────────────────────────

function updateStreak(state: WormState): WormState {
  const today = new Date().toISOString().slice(0, 10);
  if (state.lastLoginDay === today) return state;
  const yesterday  = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const newStreak  = state.lastLoginDay === yesterday ? state.loginStreak + 1 : 1;
  return { ...state, lastLoginDay: today, loginStreak: newStreak };
}

// ── API helpers ───────────────────────────────────────────────────────────

// Maps snake_case API friends response to WormFriend camelCase
function mapFriends(rows: Array<{
  friend_token: string; first_met_at: number; last_met_at: number; meet_count: number;
}>): import('../types').WormFriend[] {
  return rows.map((r) => ({
    token:      r.friend_token,
    firstMetAt: r.first_met_at,
    lastMetAt:  r.last_met_at,
    meetCount:  r.meet_count,
  }));
}

async function fetchWorm(token: string): Promise<WormState | null> {
  try {
    const [wormResp, friendsResp] = await Promise.all([
      fetch(`${API_BASE}/api/worms/${token}`),
      fetch(`${API_BASE}/api/friends/${token}`),
    ]);
    if (!wormResp.ok) return null;
    const data = await wormResp.json() as {
      id: string; ownerToken: string; name: string; color: string;
      hat: string; shades: string; trait: string; genome: string;
      stage: string; hatched: boolean; mood: number; hunger: number;
      isSick: boolean; xp: number; feedCount: number; gameCount: number;
      loginStreak: number; lastLoginDay: string; lowMoodSince: number | null;
      lastChecked: number; createdAt: number;
    };
    const friendRows = friendsResp.ok ? await friendsResp.json() : [];
    const friends = mapFriends(friendRows);
    return {
      id:           data.id,
      token:        data.ownerToken,
      name:         data.name,
      color:        data.color as WormState['color'],
      hat:          data.hat as WormState['hat'],
      shades:       data.shades as WormState['shades'],
      trait:        data.trait as WormState['trait'],
      genome:       data.genome,
      stage:        data.stage as WormStage,
      hatched:      data.hatched,
      mood:         data.mood,
      hunger:       data.hunger,
      isSick:       data.isSick,
      xp:           data.xp,
      createdAt:    data.createdAt,
      lastChecked:  data.lastChecked,
      lowMoodSince: data.lowMoodSince,
      feedCount:    data.feedCount,
      gameCount:    data.gameCount,
      loginStreak:  data.loginStreak,
      lastLoginDay: data.lastLoginDay,
      friends,
      totalFriendMeets: friends.reduce((s, f) => s + f.meetCount, 0),
    };
  } catch {
    return null;
  }
}

async function patchWorm(token: string, state: WormState): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/worms/${token}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hat:          state.hat,
        shades:       state.shades,
        hatched:      state.hatched,
        mood:         state.mood,
        hunger:       state.hunger,
        isSick:       state.isSick,
        xp:           state.xp,
        feedCount:    state.feedCount,
        gameCount:    state.gameCount,
        loginStreak:  state.loginStreak,
        lastLoginDay: state.lastLoginDay,
        lowMoodSince: state.lowMoodSince,
        lastChecked:  state.lastChecked,
      }),
    });
  } catch {
    // Offline — local state is already saved, will re-sync next load
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useWorm(token: string | null) {
  const [worm, setWorm]     = useState<WormState | null>(null);
  const [loading, setLoading] = useState(true);
  const tickRef             = useRef<ReturnType<typeof setInterval> | null>(null);
  const syncTimerRef        = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load worm on mount / token change ──────────────────────────────────
  useEffect(() => {
    if (!token) { setWorm(null); setLoading(false); return; }

    let cancelled = false;

    const load = async () => {
      setLoading(true);

      // 1. Try localStorage first (instant render)
      const raw = localStorage.getItem(STORAGE_KEY);
      let cached: WormState | null = null;
      if (raw) {
        try {
          const parsed: WormState = JSON.parse(raw);
          if (parsed.token === token) cached = parsed;
        } catch { /* corrupt */ }
      }

      if (cached) {
        const now     = Date.now();
        const decayed = applyDecay(cached, now);
        const streaked = updateStreak(decayed);
        if (!cancelled) {
          setWorm(streaked);
          setLoading(false);
        }
      }

      // 2. Fetch from API (source of truth)
      const remote = await fetchWorm(token);
      if (!cancelled && remote) {
        const now     = Date.now();
        const decayed = applyDecay(remote, now);
        const streaked = updateStreak(decayed);
        setWorm(streaked);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(streaked));
      } else if (!cached) {
        // No local, no remote — should not happen in normal flow
        setLoading(false);
      }
      if (!cancelled) setLoading(false);
    };

    load();
    return () => { cancelled = true; };
  }, [token]);

  // ── Persist to localStorage on any worm change ────────────────────────
  useEffect(() => {
    if (worm) localStorage.setItem(STORAGE_KEY, JSON.stringify(worm));
  }, [worm]);

  // ── Debounced PATCH to API after any worm change ──────────────────────
  useEffect(() => {
    if (!worm) return;
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      patchWorm(worm.token, worm);
    }, 2000); // batch writes — sync 2s after last change
    return () => { if (syncTimerRef.current) clearTimeout(syncTimerRef.current); };
  }, [worm]);

  // ── Live decay tick ───────────────────────────────────────────────────
  useEffect(() => {
    if (!worm) return;
    tickRef.current = setInterval(() => {
      setWorm((prev) => prev ? applyDecay(prev, Date.now()) : prev);
    }, TICK_INTERVAL);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [worm !== null]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Actions ───────────────────────────────────────────────────────────

  const clamp = (n: number) => Math.min(100, Math.max(0, n));

  /** Hatch the egg — first tap by the user on the Care PWA */
  const hatch = useCallback(() => {
    setWorm((prev) => {
      if (!prev || prev.hatched) return prev;
      return {
        ...prev,
        hatched: true,
        stage:   computeStage(prev.xp, prev.createdAt, true),
        mood:    clamp(prev.mood + 20),    // excitement boost
        hunger:  clamp(prev.hunger),
      };
    });
  }, []);

  const feed = useCallback(() => {
    setWorm((prev) => {
      if (!prev) return prev;
      const updated: WormState = {
        ...prev,
        hunger: clamp(prev.hunger + 30),
        mood:   clamp(prev.mood   + 5),
        xp:     prev.xp + 2,
        feedCount: prev.feedCount + 1,
      };
      if (updated.feedCount >= 50 && updated.hat === 'none') updated.hat = 'newsboy';
      return updated;
    });
  }, []);

  const cuddle = useCallback(() => {
    setWorm((prev) => {
      if (!prev) return prev;
      return { ...prev, mood: clamp(prev.mood + 20), xp: prev.xp + 3 };
    });
  }, []);

  const completeGame = useCallback((xpGained: number, moodBoost: number) => {
    setWorm((prev) => {
      if (!prev) return prev;
      const newXp    = prev.xp + xpGained;
      const newStage = computeStage(newXp, prev.createdAt, prev.hatched);
      const updated: WormState = {
        ...prev,
        mood:      clamp(prev.mood + moodBoost),
        xp:        newXp,
        gameCount: prev.gameCount + 1,
        stage:     newStage,
      };
      if (updated.gameCount >= 10 && updated.shades === 'none') updated.shades = 'sunglasses2';
      if (updated.stage === 'elder' && updated.hat === 'none') updated.hat = 'tophat';
      return updated;
    });
  }, []);

  const heal = useCallback(() => {
    setWorm((prev) => {
      if (!prev || !prev.isSick) return prev;
      return { ...prev, isSick: false, mood: clamp(prev.mood + 30), lowMoodSince: null };
    });
  }, []);

  const addFriend = useCallback(async (friendToken: string): Promise<AddFriendResult> => {
    if (!worm) return 'invalid';
    if (!friendToken || typeof friendToken !== 'string') return 'invalid';
    if (friendToken === worm.token) return 'self';

    // POST to API — validates the friend token exists
    try {
      const resp = await fetch(`${API_BASE}/api/friends/${worm.token}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendToken }),
      });
      if (resp.status === 404) return 'invalid';
      if (!resp.ok) return 'invalid';
    } catch {
      return 'invalid'; // offline
    }

    const now = Date.now();
    // Compute result before setState — avoids React 18 concurrent mode race
    const alreadyFriends = worm.friends.some((f) => f.token === friendToken);
    const result: AddFriendResult = alreadyFriends ? 'reunited' : 'added';

    setWorm((prev) => {
      if (!prev) return prev;
      const existing = prev.friends.find((f) => f.token === friendToken);

      const updatedFriends = existing
        ? prev.friends.map((f) =>
            f.token === friendToken
              ? { ...f, lastMetAt: now, meetCount: f.meetCount + 1 }
              : f
          )
        : [...prev.friends, { token: friendToken, firstMetAt: now, lastMetAt: now, meetCount: 1 }];

      return {
        ...prev,
        friends: updatedFriends,
        totalFriendMeets: prev.totalFriendMeets + 1,
        mood: clamp(prev.mood + 10),
        xp: prev.xp + 5,
      };
    });

    return result;
  }, [worm]);

  const transmit = useCallback(async (toToken: string): Promise<{ fragment: string; label: string } | null> => {
    if (!worm) return null;
    try {
      const resp = await fetch(`${API_BASE}/api/transmit/${worm.token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toToken }),
      });
      if (!resp.ok) return null;
      const data = await resp.json() as { fragment: string; label: string };
      setWorm((prev) => prev ? { ...prev, xp: prev.xp + 10, mood: clamp(prev.mood + 5) } : prev);
      return data;
    } catch { return null; }
  }, [worm]);

  const absorb = useCallback(async (txId: string): Promise<import('../types').AbsorbResult | null> => {
    if (!worm) return null;
    try {
      const resp = await fetch(`${API_BASE}/api/transmit/${worm.token}/absorb/${txId}`, { method: 'POST' });
      if (!resp.ok) return null;
      const result = await resp.json() as import('../types').AbsorbResult;
      // Refresh worm state from server to get updated genome/trait
      const wResp = await fetch(`${API_BASE}/api/worms/${worm.token}`);
      if (wResp.ok) {
        const updated = await wResp.json() as import('../types').WormState;
        setWorm(updated);
      }
      return result;
    } catch { return null; }
  }, [worm]);

  return { worm, loading, hatch, feed, cuddle, completeGame, heal, addFriend, transmit, absorb };
}
