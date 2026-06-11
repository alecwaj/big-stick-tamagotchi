import { useState, useEffect, useRef, useCallback } from 'react';
import type { GameProps } from './gameTypes';
import { GameResultScreen } from './GameResult';

const GAME_DURATION = 20;
const SPAWN_INTERVAL_MS = 1100;
const ITEM_SIZE = 52;

interface FallingItem {
  id: number;
  x: number;    // % from left
  y: number;    // % from top
  speed: number; // % per second
  type: 'bug' | 'rock';
}

// nextId is now per-component-instance via ref (see BugCatch impl)
function makeSpawner() {
  let id = 0;
  return (): FallingItem => ({
    id: id++,
    x: 8 + Math.random() * 80,
    y: -8,
    speed: 14 + Math.random() * 12,
    type: Math.random() < 0.68 ? 'bug' : 'rock',
  });
}

type Phase = 'countdown' | 'playing' | 'done';

export function BugCatch({ onComplete, onExit }: GameProps) {
  const spawnItem = useRef(makeSpawner()).current;
  const [phase, setPhase]         = useState<Phase>('countdown');
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft]   = useState(GAME_DURATION);
  const [items, setItems]         = useState<FallingItem[]>([]);
  const [score, setScore]         = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [splats, setSplats]       = useState<{ id: number; x: number; y: number; type: 'bug' | 'rock' }[]>([]);

  const scoreRef     = useRef(0);
  const lastTickRef  = useRef<number>(0);
  const rafRef       = useRef<number>(0);
  const spawnTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Countdown ──
  useEffect(() => {
    if (phase !== 'countdown') return;
    if (countdown === 0) { setPhase('playing'); return; }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, countdown]);

  // ── Game timer ──
  useEffect(() => {
    if (phase !== 'playing') return;
    if (timeLeft === 0) { setPhase('done'); return; }
    const t = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, timeLeft]);

  // ── RAF loop: move items ──
  useEffect(() => {
    if (phase !== 'playing') return;
    lastTickRef.current = performance.now();

    const loop = (now: number) => {
      const dt = (now - lastTickRef.current) / 1000; // seconds
      lastTickRef.current = now;
      setItems((prev) =>
        prev
          .map((item) => ({ ...item, y: item.y + item.speed * dt }))
          .filter((item) => item.y < 108)
      );
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [phase]);

  // ── Spawn loop ──
  useEffect(() => {
    if (phase !== 'playing') return;
    setItems([spawnItem()]);
    spawnTimerRef.current = setInterval(() => setItems((prev) => [...prev, spawnItem()]), SPAWN_INTERVAL_MS);
    return () => { if (spawnTimerRef.current) clearInterval(spawnTimerRef.current); };
  }, [phase]);

  // ── Done → show result ──
  useEffect(() => {
    if (phase !== 'done') return;
    setTimeout(() => setShowResult(true), 300);
  }, [phase]);

  const handleTap = useCallback((item: FallingItem, itemEl: HTMLElement) => {
    if (phase !== 'playing') return;
    const rect = itemEl.getBoundingClientRect();
    const cx   = ((rect.left + rect.width  / 2) / window.innerWidth)  * 100;
    const cy   = ((rect.top  + rect.height / 2) / window.innerHeight) * 100;

    setItems((prev) => prev.filter((i) => i.id !== item.id));
    setSplats((prev) => [...prev, { id: item.id, x: cx, y: cy, type: item.type }]);
    setTimeout(() => setSplats((prev) => prev.filter((s) => s.id !== item.id)), 500);

    if (item.type === 'bug') {
      scoreRef.current += 1;
      setScore((s) => s + 1);
    } else {
      scoreRef.current = Math.max(0, scoreRef.current - 1);
      setScore((s) => Math.max(0, s - 1));
    }
  }, [phase]);

  const won      = scoreRef.current >= 8;
  const xpGained = Math.min(20, scoreRef.current * 2);
  const moodBoost = won ? 20 : 8;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 40,
      background: 'linear-gradient(160deg, #030010 0%, #001a08 100%)',
      display: 'flex', flexDirection: 'column',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      color: '#e0e0ff', overflow: 'hidden',
      userSelect: 'none',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 20px', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(0,0,8,0.7)',
        borderBottom: '1px solid rgba(170,255,0,0.12)',
        zIndex: 2,
      }}>
        <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: '#aaff00', textShadow: '0 0 8px #aaff00' }}>
          🐛 bug catch
        </span>
        <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 14, color: '#aaff00', textShadow: '0 0 8px #aaff00' }}>
          {score}
        </span>
        {phase === 'playing' && (
          <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 12, color: timeLeft <= 5 ? '#ff0055' : 'rgba(200,200,220,0.5)' }}>
            {timeLeft}s
          </span>
        )}
        <button onClick={onExit} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, color: 'rgba(200,200,220,0.5)', fontSize: 12, padding: '5px 12px', cursor: 'pointer' }}>
          quit
        </button>
      </div>

      {/* Countdown */}
      {phase === 'countdown' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
          <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 72, color: '#aaff00', textShadow: '0 0 30px #aaff00', animation: 'countPulse 0.5s ease-out' }}>
            {countdown === 0 ? 'GO!' : countdown}
          </span>
          <p style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: 'rgba(150,150,200,0.5)', lineHeight: 2 }}>tap bugs · dodge rocks</p>
        </div>
      )}

      {/* Play area */}
      {(phase === 'playing' || phase === 'done') && !showResult && (
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {/* Stars bg */}
          {[...Array(20)].map((_, i) => (
            <div key={i} style={{ position: 'absolute', left: `${(i * 47) % 100}%`, top: `${(i * 31) % 100}%`, color: 'rgba(255,255,255,0.06)', fontSize: 8, pointerEvents: 'none' }}>✦</div>
          ))}

          {/* Falling items */}
          {items.map((item) => (
            <button
              key={item.id}
              onPointerDown={(e) => { e.preventDefault(); handleTap(item, e.currentTarget); }}
              style={{
                position: 'absolute',
                left: `${item.x}%`,
                top: `${item.y}%`,
                transform: 'translate(-50%, -50%)',
                width: ITEM_SIZE, height: ITEM_SIZE,
                borderRadius: '50%',
                border: `2px solid ${item.type === 'bug' ? 'rgba(170,255,0,0.3)' : 'rgba(255,100,0,0.3)'}`,
                background: item.type === 'bug' ? 'rgba(170,255,0,0.08)' : 'rgba(255,100,0,0.08)',
                cursor: 'pointer',
                fontSize: 28, lineHeight: `${ITEM_SIZE}px`,
                WebkitTapHighlightColor: 'transparent',
                boxShadow: item.type === 'bug' ? '0 0 10px rgba(170,255,0,0.25)' : '0 0 10px rgba(255,100,0,0.25)',
              }}
            >
              {item.type === 'bug' ? '🐛' : '🪨'}
            </button>
          ))}

          {/* Splat effects */}
          {splats.map((s) => (
            <div key={s.id} style={{
              position: 'absolute',
              left: `${s.x}%`, top: `${s.y}%`,
              transform: 'translate(-50%,-50%)',
              fontSize: 32, pointerEvents: 'none',
              animation: 'splatOut 0.5s ease-out forwards',
            }}>
              {s.type === 'bug' ? '✨' : '💢'}
            </div>
          ))}
        </div>
      )}

      {showResult && (
        <GameResultScreen
          result={{ xpGained, moodBoost, score, won }}
          gameName="Bug Catch"
          onContinue={() => onComplete({ xpGained, moodBoost, score, won })}
        />
      )}

      <style>{`
        @keyframes countPulse {
          from { transform: scale(1.4); opacity: 0.5; }
          to   { transform: scale(1);   opacity: 1; }
        }
        @keyframes splatOut {
          from { transform: translate(-50%,-50%) scale(0.5); opacity: 1; }
          to   { transform: translate(-50%,-50%) scale(1.8); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
