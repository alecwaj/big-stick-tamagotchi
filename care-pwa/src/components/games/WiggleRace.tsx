import { useState, useEffect, useRef, useCallback } from 'react';
import type { GameProps } from './gameTypes';
import { GameResultScreen } from './GameResult';

const RACE_DURATION = 10;
const CPU_ADVANCE_PER_TICK = 0.65; // % per 100ms → ~6.5% per second → 65% in 10s
const PLAYER_ADVANCE_PER_TAP = 2.2; // need ~46 taps to win

type Phase = 'countdown' | 'racing' | 'done';

export function WiggleRace({ onComplete, onExit }: GameProps) {
  const [phase, setPhase]         = useState<Phase>('countdown');
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft]   = useState(RACE_DURATION);
  const [playerPos, setPlayerPos] = useState(0);
  const [cpuPos, setCpuPos]       = useState(0);
  const [tapCount, setTapCount]   = useState(0);
  const [showResult, setShowResult] = useState(false);

  const playerPosRef = useRef(0);
  const cpuPosRef    = useRef(0);
  const wonRef       = useRef(false);

  // ── Countdown ──
  useEffect(() => {
    if (phase !== 'countdown') return;
    if (countdown === 0) { setPhase('racing'); return; }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, countdown]);

  // ── Race timer ──
  useEffect(() => {
    if (phase !== 'racing') return;
    if (timeLeft === 0) { setPhase('done'); return; }
    const t = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, timeLeft]);

  // ── CPU movement (100ms ticks) ──
  useEffect(() => {
    if (phase !== 'racing') return;
    const iv = setInterval(() => {
      setCpuPos((prev) => {
        const next = Math.min(100, prev + CPU_ADVANCE_PER_TICK);
        cpuPosRef.current = next;
        return next;
      });
    }, 100);
    return () => clearInterval(iv);
  }, [phase]);

  // ── End of race → compute result ──
  useEffect(() => {
    if (phase !== 'done') return;
    wonRef.current = playerPosRef.current >= cpuPosRef.current;
    setTimeout(() => setShowResult(true), 400);
  }, [phase]);

  const handleTap = useCallback(() => {
    if (phase !== 'racing') return;
    setTapCount((c) => c + 1);
    setPlayerPos((prev) => {
      const next = Math.min(100, prev + PLAYER_ADVANCE_PER_TAP);
      playerPosRef.current = next;
      return next;
    });
    // Check instant win after ref is updated (avoids setState-inside-updater)
    if (playerPosRef.current >= 100) setPhase('done');
  }, [phase]);

  const won = wonRef.current;
  const xpGained   = won ? 15 : 6;
  const moodBoost  = won ? 15 : 5;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 40,
      background: 'linear-gradient(160deg, #06000f 0%, #0a001a 100%)',
      display: 'flex', flexDirection: 'column',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      color: '#e0e0ff',
      userSelect: 'none',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid rgba(0,245,255,0.1)',
        background: 'rgba(6,0,15,0.7)',
      }}>
        <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: '#00f5ff', textShadow: '0 0 8px #00f5ff' }}>
          🏁 wiggle race
        </span>
        {phase === 'racing' && (
          <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 18, color: timeLeft <= 3 ? '#ff0055' : '#aaff00', textShadow: `0 0 10px ${timeLeft <= 3 ? '#ff0055' : '#aaff00'}` }}>
            {timeLeft}s
          </span>
        )}
        <button onClick={onExit} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, color: 'rgba(200,200,220,0.5)', fontSize: 12, padding: '5px 12px', cursor: 'pointer' }}>
          quit
        </button>
      </div>

      {/* Countdown overlay */}
      {phase === 'countdown' && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: countdown === 0 ? 52 : 72,
            color: countdown === 0 ? '#aaff00' : '#00f5ff',
            textShadow: `0 0 30px currentColor`,
            animation: 'countPulse 0.5s ease-out',
          }}>
            {countdown === 0 ? 'GO!' : countdown}
          </span>
        </div>
      )}

      {/* Race area */}
      {(phase === 'racing' || phase === 'done') && !showResult && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 0, padding: '0 20px' }}>
          {/* Tap counter */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 10, color: 'rgba(150,150,200,0.5)' }}>
              taps: {tapCount}
            </span>
          </div>

          {/* Track: Player */}
          <Track label="YOU" emoji="🪱" position={playerPos} color="#00f5ff" />
          <div style={{ height: 20 }} />
          {/* Track: CPU */}
          <Track label="CPU" emoji="👾" position={cpuPos} color="#ff00cc" />
        </div>
      )}

      {/* Tap button */}
      {phase === 'racing' && (
        <div style={{ padding: '16px 20px 32px', flexShrink: 0 }}>
          <button
            onPointerDown={(e) => { e.preventDefault(); handleTap(); }}
            style={{
              width: '100%', height: 110,
              borderRadius: 12,
              border: '2px solid rgba(0,245,255,0.5)',
              background: 'rgba(0,245,255,0.08)',
              color: '#00f5ff',
              fontFamily: "'Press Start 2P', monospace",
              fontSize: 16,
              cursor: 'pointer',
              boxShadow: '0 0 20px rgba(0,245,255,0.2)',
              WebkitTapHighlightColor: 'transparent',
              letterSpacing: '0.06em',
              lineHeight: 1.8,
            }}
          >
            TAP TAP TAP
          </button>
        </div>
      )}

      {showResult && (
        <GameResultScreen
          result={{ xpGained, moodBoost, score: tapCount, won }}
          gameName="Wiggle Race"
          onContinue={() => onComplete({ xpGained, moodBoost, score: tapCount, won })}
        />
      )}

      <style>{`
        @keyframes countPulse {
          from { transform: scale(1.4); opacity: 0.5; }
          to   { transform: scale(1);   opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function Track({ label, emoji, position, color }: { label: string; emoji: string; position: number; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: color, textShadow: `0 0 6px ${color}` }}>
        {label}
      </span>
      <div style={{
        position: 'relative', height: 48,
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${color}33`,
        borderRadius: 8, overflow: 'hidden',
      }}>
        {/* Finish line */}
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 3, background: color, opacity: 0.6, boxShadow: `0 0 6px ${color}` }} />
        {/* Stars on track */}
        {[20, 40, 60, 80].map((x) => (
          <div key={x} style={{ position: 'absolute', left: `${x}%`, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.1)', fontSize: 8 }}>✦</div>
        ))}
        {/* Runner */}
        <div style={{
          position: 'absolute',
          left: `calc(${position}% - 20px)`,
          top: '50%', transform: 'translateY(-50%)',
          fontSize: 28, lineHeight: 1,
          filter: `drop-shadow(0 0 6px ${color})`,
          transition: 'left 0.08s linear',
        }}>
          {emoji}
        </div>
      </div>
    </div>
  );
}
