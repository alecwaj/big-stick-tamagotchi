import { useState, useEffect, useCallback } from 'react';
import type { GameProps } from './gameTypes';
import { GameResultScreen } from './GameResult';

const FOODS = ['🍕', '🍩', '🌮', '🍎'];
const FOOD_COLORS = ['#ff6600', '#ff00cc', '#aaff00', '#ff0055'];
const TOTAL_ROUNDS = 5;
const SHOW_MS = 600;
const GAP_MS  = 200;

type Phase = 'intro' | 'showing' | 'input' | 'correct' | 'wrong' | 'win';

function buildSequence(round: number): number[] {
  const seq = [];
  for (let i = 0; i < round + 1; i++) seq.push(Math.floor(Math.random() * 4));
  return seq;
}

export function MemoryMunch({ onComplete, onExit }: GameProps) {
  const [phase, setPhase]             = useState<Phase>('intro');
  const [round, setRound]             = useState(1);
  const [sequence, setSequence]       = useState<number[]>([]);
  const [highlighted, setHighlighted] = useState<number | null>(null);
  const [playerInput, setPlayerInput] = useState<number[]>([]);
  const [showResult, setShowResult]   = useState(false);
  const [completedRounds, setCompletedRounds] = useState(0);

  // ── Start / new round ──
  const startRound = useCallback((r: number) => {
    const seq = buildSequence(r); // round 1 = length 2, round 5 = length 6
    setSequence(seq);
    setPlayerInput([]);
    setPhase('showing');

    // Play the sequence with highlights
    seq.forEach((foodIdx, i) => {
      setTimeout(() => setHighlighted(foodIdx), i * (SHOW_MS + GAP_MS));
      setTimeout(() => setHighlighted(null),    i * (SHOW_MS + GAP_MS) + SHOW_MS);
    });
    // Switch to input phase after sequence
    setTimeout(() => { setHighlighted(null); setPhase('input'); }, seq.length * (SHOW_MS + GAP_MS) + 200);
  }, []);

  useEffect(() => { startRound(round); }, []); // eslint-disable-line

  // ── Player tap ──
  const handleTap = useCallback((idx: number) => {
    if (phase !== 'input') return;

    const newInput = [...playerInput, idx];
    const pos = newInput.length - 1;

    if (newInput[pos] !== sequence[pos]) {
      // Wrong
      setHighlighted(idx);
      setPhase('wrong');
      setTimeout(() => { setHighlighted(null); setShowResult(true); }, 800);
      return;
    }

    setPlayerInput(newInput);

    if (newInput.length === sequence.length) {
      // Completed this round
      const newCompleted = completedRounds + 1;
      setCompletedRounds(newCompleted);
      setPhase('correct');

      if (round >= TOTAL_ROUNDS) {
        setTimeout(() => { setPhase('win'); setShowResult(true); }, 800);
      } else {
        setTimeout(() => {
          setRound((r) => r + 1);
          startRound(round + 1);
        }, 900);
      }
    }
  }, [phase, playerInput, sequence, round, completedRounds, startRound]);

  const won       = phase === 'win' || completedRounds === TOTAL_ROUNDS;
  const xpGained  = Math.max(5, completedRounds * 5);
  const moodBoost = won ? 25 : Math.max(5, completedRounds * 4);

  const statusText = {
    intro:   'get ready...',
    showing: 'watch carefully...',
    input:   'your turn!',
    correct: '✓ correct!',
    wrong:   '✗ wrong!',
    win:     'perfect memory!',
  }[phase];

  const statusColor = {
    intro:   'rgba(150,150,200,0.6)',
    showing: '#00f5ff',
    input:   '#aaff00',
    correct: '#aaff00',
    wrong:   '#ff0055',
    win:     '#fbbf24',
  }[phase];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 40,
      background: 'linear-gradient(160deg, #06000f 0%, #1a000f 100%)',
      display: 'flex', flexDirection: 'column',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      color: '#e0e0ff', userSelect: 'none',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 20px', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(6,0,15,0.7)',
        borderBottom: '1px solid rgba(255,0,204,0.12)',
      }}>
        <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: '#ff00cc', textShadow: '0 0 8px #ff00cc' }}>
          🧠 memory munch
        </span>
        <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: '#fbbf24' }}>
          {round}/{TOTAL_ROUNDS}
        </span>
        <button onClick={onExit} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, color: 'rgba(200,200,220,0.5)', fontSize: 12, padding: '5px 12px', cursor: 'pointer' }}>
          quit
        </button>
      </div>

      {/* Round progress dots */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '12px 0 0', flexShrink: 0 }}>
        {Array.from({ length: TOTAL_ROUNDS }).map((_, i) => (
          <div key={i} style={{
            width: 8, height: 8, borderRadius: '50%',
            background: i < completedRounds ? '#aaff00' : i === completedRounds ? '#ff00cc' : 'rgba(255,255,255,0.1)',
            boxShadow: i < completedRounds ? '0 0 6px #aaff00' : i === completedRounds ? '0 0 6px #ff00cc' : 'none',
            transition: 'all 0.3s',
          }} />
        ))}
      </div>

      {/* Status */}
      <div style={{ textAlign: 'center', padding: '16px 0 8px', flexShrink: 0 }}>
        <span style={{
          fontFamily: "'Press Start 2P', monospace", fontSize: 8,
          color: statusColor, textShadow: `0 0 8px ${statusColor}`,
          transition: 'color 0.2s',
        }}>
          {statusText}
        </span>
      </div>

      {/* Sequence preview dots */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 4, padding: '0 0 16px', flexShrink: 0, minHeight: 20 }}>
        {sequence.map((foodIdx, i) => (
          <div key={i} style={{
            width: 10, height: 10, borderRadius: '50%',
            background: i < playerInput.length ? '#aaff00' : FOOD_COLORS[foodIdx] + '55',
            border: `1px solid ${FOOD_COLORS[foodIdx]}44`,
            transition: 'background 0.2s',
          }} />
        ))}
      </div>

      {/* Food grid */}
      <div style={{
        flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr',
        gap: 12, padding: '8px 24px 28px',
        alignContent: 'center',
      }}>
        {FOODS.map((food, idx) => {
          const isHighlighted = highlighted === idx;
          const color = FOOD_COLORS[idx];
          const isDisabled = phase !== 'input';

          return (
            <button
              key={idx}
              onPointerDown={(e) => { e.preventDefault(); if (!isDisabled) handleTap(idx); }}
              style={{
                borderRadius: 12,
                border: `2px solid ${isHighlighted ? color : color + '33'}`,
                background: isHighlighted ? `${color}30` : `${color}08`,
                cursor: isDisabled ? 'default' : 'pointer',
                boxShadow: isHighlighted ? `0 0 24px ${color}aa, inset 0 0 12px ${color}22` : `0 0 6px ${color}18`,
                transform: isHighlighted ? 'scale(1.04)' : 'scale(1)',
                transition: 'all 0.12s ease',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 56, lineHeight: 1,
                minHeight: 110,
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {food}
            </button>
          );
        })}
      </div>

      {showResult && (
        <GameResultScreen
          result={{ xpGained, moodBoost, score: completedRounds, won }}
          gameName="Memory Munch"
          onContinue={() => onComplete({ xpGained, moodBoost, score: completedRounds, won })}
        />
      )}
    </div>
  );
}
