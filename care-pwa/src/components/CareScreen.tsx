import { type WormState, type WormExpression, type WormTrait, COLOR_MAP, GLOW_MAP } from '../types';
import { WormSVG } from './WormSVG';
import { StatBar } from './StatBar';
import { ActionButton } from './ActionButton';
import { useState, useEffect, useRef, useCallback } from 'react';

interface CareScreenProps {
  worm: WormState;
  onFeed: () => void;
  onCuddle: () => void;
  onOpenGames: () => void;
  onOpenFriends: () => void;
  onHeal: () => void;
  onHatch: () => void;
}

// ── Trait lore ─────────────────────────────────────────────────────────────

const TRAIT_LORE: Record<WormTrait, string> = {
  sleepy:  'Neural Pathways: Clearing',
  hyper:   'Synapses: Fully Colonised',
  grumpy:  'Resisting Airvana',
  chill:   'Thought Replacement: 94%',
  bubbly:  'Hive Signal: Strong',
  spooky:  'Portal: Nearly Open',
};

// ── Stage config ──────────────────────────────────────────────────────────

const STAGE_LABEL: Record<WormState['stage'], string> = {
  egg: 'HOST', baby: 'ENTERING', adult: 'CONSUMING', elder: 'AIRVANA',
};
const STAGE_COLOR: Record<WormState['stage'], string> = {
  egg: '#ff6699', baby: '#00f5ff', adult: '#aaff00', elder: '#fbbf24',
};

// ── Genome trait reveal — hidden until stage milestones ───────────────────

const TRAIT_UNLOCK_STAGE: Record<string, WormState['stage']> = {
  // baby: just show basic identity
  eyeStyle:     'baby',
  mouthStyle:   'baby',
  // adult: markings + nubs appear visually anyway
  markingType:  'adult',
  nubStyle:     'adult',
  cheekStyle:   'adult',
  bodyShape:    'adult',
  // elder: full genome revealed
  tailType:     'elder',
  glowIntensity:'elder',
  pupilStyle:   'elder',
};

function traitUnlocked(traitKey: string, stage: WormState['stage']): boolean {
  const unlock = TRAIT_UNLOCK_STAGE[traitKey];
  if (!unlock) return true;
  const order = ['egg', 'baby', 'adult', 'elder'];
  return order.indexOf(stage) >= order.indexOf(unlock);
}

// ── Floating particle ─────────────────────────────────────────────────────

interface Particle {
  id: number;
  emoji: string;
  x: number;
  y: number;
}

let _pid = 0;

function ParticleLayer({ particles }: { particles: Particle[] }) {
  return (
    <>
      {particles.map((p) => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: p.x,
            top: p.y,
            fontSize: 22,
            pointerEvents: 'none',
            zIndex: 20,
            animation: 'floatUp 0.9s ease-out forwards',
          }}
        >
          {p.emoji}
        </div>
      ))}
    </>
  );
}

// ── XP bar ────────────────────────────────────────────────────────────────

function XpBar({ xp, stage }: { xp: number; stage: WormState['stage'] }) {
  if (stage === 'elder') return null;
  const [floor, ceil] = stage === 'baby' ? [0, 500] : stage === 'adult' ? [500, 2000] : [0, 500];
  const pct = Math.min(100, Math.round(((xp - floor) / (ceil - floor)) * 100));
  const label = stage === 'baby' ? 'CONSUMPTION' : 'BRAIN SPACE REMAINING';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: 'rgba(150,150,200,0.5)', whiteSpace: 'nowrap' }}>
        {label} {pct}%
      </span>
      <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`, borderRadius: 2,
          background: 'linear-gradient(90deg, #cc00ff, #00f5ff)',
          boxShadow: '0 0 4px rgba(0,245,255,0.4)',
          transition: 'width 0.4s ease',
        }} />
      </div>
      {pct >= 90 && (
        <span style={{ fontSize: 10, animation: 'pulse 1s ease-in-out infinite' }}>🧠</span>
      )}
    </div>
  );
}

// ── Stage badge ───────────────────────────────────────────────────────────

function StageBadge({ stage }: { stage: WormState['stage'] }) {
  const color = STAGE_COLOR[stage];
  return (
    <span style={{
      fontFamily: "'Press Start 2P', monospace", fontSize: 7, color,
      textShadow: `0 0 8px ${color}`, border: `1px solid ${color}55`,
      background: `${color}12`, borderRadius: 3, padding: '4px 8px', letterSpacing: '0.06em',
    }}>
      {STAGE_LABEL[stage]}
    </span>
  );
}

// ── Genome reveal panel ────────────────────────────────────────────────────

function GenomeReveal({ worm }: { worm: WormState }) {
  const [open, setOpen] = useState(false);
  const color = COLOR_MAP[worm.color];

  // Parse genome into display traits
  function hexByte(g: string, i: number): number { return parseInt(g.slice(i*2, i*2+2) || '00', 16); }
  function pick<T>(arr: T[], byte: number): T { return arr[byte % arr.length]; }
  const g = (worm.genome || '').padEnd(32,'0').slice(0,32);

  const traits: { key: string; label: string; value: string }[] = [
    { key: 'eyeStyle',      label: 'Eyes',     value: pick(['beady','wide','sleepy','compound','hearts'], hexByte(g,2)) },
    { key: 'mouthStyle',    label: 'Mouth',    value: pick(['smile','smirk','ooh','beam','fangs'], hexByte(g,8)) },
    { key: 'bodyShape',     label: 'Form',     value: pick(['round','tapered','lumpy','ribbed'], hexByte(g,1)) },
    { key: 'markingType',   label: 'Markings', value: pick(['none','stripes','spots','rings','gradient','zigzag'], hexByte(g,4)) },
    { key: 'nubStyle',      label: 'Nubs',     value: pick(['none','tiny','wavy','spiky','leafy'], hexByte(g,6)) },
    { key: 'cheekStyle',    label: 'Cheeks',   value: pick(['none','rosy','freckles','star'], hexByte(g,7)) },
    { key: 'tailType',      label: 'Tail',     value: pick(['flat','pointed','frilly','club','split'], hexByte(g,3)) },
    { key: 'glowIntensity', label: 'Aura',     value: pick(['low','medium','high','pulse'], hexByte(g,9)) },
    { key: 'pupilStyle',    label: 'Pupils',   value: pick(['dot','oval','cross','star','heart'], hexByte(g,11)) },
  ];

  const unlockedCount = traits.filter(t => traitUnlocked(t.key, worm.stage)).length;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          fontFamily: "'Press Start 2P', monospace", fontSize: 6,
          background: `${color}10`, border: `1px solid ${color}30`,
          borderRadius: 3, color: `${color}99`, padding: '3px 7px',
          cursor: 'pointer', letterSpacing: '0.04em',
        }}
      >
        NEURAL {unlockedCount}/{traits.length}
      </button>

      {open && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 60,
          background: 'rgba(6,0,15,0.97)',
          display: 'flex', flexDirection: 'column',
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}>
          <div style={{
            padding: '16px 20px', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderBottom: '1px solid rgba(0,245,255,0.12)',
          }}>
            <p style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color, textShadow: `0 0 8px ${color}`, margin: 0 }}>
              {worm.name}&apos;s neural map
            </p>
            <button onClick={() => setOpen(false)} style={{
              background: 'none', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 4, color: 'rgba(200,200,220,0.5)', fontSize: 12, padding: '6px 14px', cursor: 'pointer',
            }}>
              ← close
            </button>
          </div>

          <div style={{ flex: 1, overflow: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: 'rgba(150,150,200,0.4)', margin: '0 0 8px', lineHeight: 2 }}>
              {worm.stage === 'baby' ? 'more traits unlock as your worm grows...' :
               worm.stage === 'adult' ? 'deeper pathways unlock at airvana...' :
               worm.stage === 'elder' ? 'the mind has been fully replaced. airvana achieved.' :
               'accept the worm to begin the mapping.'}
            </p>
            {traits.map((t) => {
              const unlocked = traitUnlocked(t.key, worm.stage);
              return (
                <div key={t.key} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 14px',
                  background: unlocked ? `${color}08` : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${unlocked ? color + '25' : 'rgba(255,255,255,0.05)'}`,
                  borderRadius: 6,
                }}>
                  <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: unlocked ? 'rgba(150,150,200,0.7)' : 'rgba(150,150,200,0.25)', letterSpacing: '0.06em' }}>
                    {t.label}
                  </span>
                  <span style={{
                    fontFamily: "'Press Start 2P', monospace", fontSize: 8,
                    color: unlocked ? color : 'rgba(100,100,140,0.4)',
                    textShadow: unlocked ? `0 0 8px ${color}` : 'none',
                    letterSpacing: '0.04em',
                  }}>
                    {unlocked ? t.value : '???'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

// ── Hatch sequence ────────────────────────────────────────────────────────

function HatchSequence({ worm, onComplete }: { worm: WormState; onComplete: () => void }) {
  const [phase, setPhase] = useState<'whisper' | 'cracking' | 'burst' | 'reveal'>('whisper');
  const color = COLOR_MAP[worm.color];
  const glow  = GLOW_MAP[worm.color];

  useEffect(() => {
    // Phase timeline: whisper(1.8s) → cracking(1.4s) → burst(0.6s) → reveal(forever)
    const t1 = setTimeout(() => setPhase('cracking'), 1800);
    const t2 = setTimeout(() => setPhase('burst'),    3200);
    const t3 = setTimeout(() => setPhase('reveal'),   3800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'linear-gradient(160deg, #06000f 0%, #0a0020 50%, #060010 100%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 24, color: '#e0e0ff',
      }}
      onClick={phase === 'reveal' ? onComplete : undefined}
    >
      {/* Whisper phase — name appears glitching before shell breaks */}
      {phase === 'whisper' && (
        <>
          <p style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: 'rgba(150,150,200,0.4)', margin: 0, animation: 'fadeIn 0.5s ease' }}>
            a signal from the hive...
          </p>
          <div style={{ position: 'relative' }}>
            <WormSVG color={worm.color} hat="none" shades="none" stage="egg" genome={worm.genome} animated size={220} />
            <p style={{
              position: 'absolute', bottom: -32, left: '50%', transform: 'translateX(-50%)',
              fontFamily: "'Press Start 2P', monospace", fontSize: 9,
              color, textShadow: `0 0 12px ${glow}, 0 0 30px ${glow}`,
              margin: 0, whiteSpace: 'nowrap',
              animation: 'glitchName 1.8s ease-in-out',
            }}>
              ...I am {worm.name}...
            </p>
          </div>
        </>
      )}

      {/* Cracking phase — egg shows cracks, shaking */}
      {phase === 'cracking' && (
        <>
          <p style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: 'rgba(150,150,200,0.5)', margin: 0 }}>
            acceptance beginning
          </p>
          <div style={{ animation: 'shake 0.15s ease-in-out infinite' }}>
            <WormSVG color={worm.color} hat="none" shades="none" stage="egg" genome={worm.genome} hatched animated size={220} />
          </div>
          <p style={{
            fontFamily: "'Press Start 2P', monospace", fontSize: 9,
            color, textShadow: `0 0 12px ${glow}`, margin: 0,
          }}>
            {worm.name}
          </p>
        </>
      )}

      {/* Burst phase — flash of light */}
      {phase === 'burst' && (
        <div style={{
          position: 'fixed', inset: 0,
          background: color,
          animation: 'burstFlash 0.6s ease-out forwards',
          zIndex: 101,
        }} />
      )}

      {/* Reveal phase — worm appears, tap to continue */}
      {phase === 'reveal' && (
        <>
          <p style={{
            fontFamily: "'Press Start 2P', monospace", fontSize: 7,
            color: 'rgba(150,150,200,0.5)', margin: 0,
            animation: 'fadeIn 0.4s ease',
          }}>
            🧠 the worm has entered
          </p>
          <div style={{ animation: 'popIn 0.5s cubic-bezier(0.34,1.56,0.64,1)' }}>
            <WormSVG color={worm.color} hat={worm.hat} shades={worm.shades} stage="baby" genome={worm.genome} expression="happy" animated size={220} />
          </div>
          <p style={{
            fontFamily: "'Press Start 2P', monospace", fontSize: 11,
            color, textShadow: `0 0 14px ${glow}, 0 0 35px ${glow}`,
            margin: 0, animation: 'popIn 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.1s both',
          }}>
            {worm.name}
          </p>
          <p style={{
            fontFamily: "'Press Start 2P', monospace", fontSize: 6,
            color: 'rgba(150,150,200,0.4)', margin: 0, lineHeight: 2,
            animation: 'fadeIn 0.5s ease 0.4s both',
          }}>
            {TRAIT_LORE[worm.trait]}
          </p>
          <p style={{
            fontFamily: "'Press Start 2P', monospace", fontSize: 6,
            color: 'rgba(150,150,200,0.25)', margin: '8px 0 0',
            animation: 'fadeIn 0.5s ease 0.8s both',
          }}>
            tap to accept airvana
          </p>
        </>
      )}

      <style>{`
        @keyframes glitchName {
          0%   { opacity: 0; transform: translateX(-50%) skewX(0deg); }
          15%  { opacity: 0.3; transform: translateX(calc(-50% + 3px)) skewX(5deg); }
          20%  { opacity: 0.8; transform: translateX(calc(-50% - 2px)) skewX(-3deg); }
          30%  { opacity: 0.4; transform: translateX(calc(-50% + 4px)) skewX(4deg); }
          40%  { opacity: 1;   transform: translateX(-50%) skewX(0deg); }
          100% { opacity: 1;   transform: translateX(-50%) skewX(0deg); }
        }
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          25%     { transform: translateX(-6px) rotate(-2deg); }
          75%     { transform: translateX(6px) rotate(2deg); }
        }
        @keyframes burstFlash {
          0%   { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes popIn {
          from { transform: scale(0.4); opacity: 0; }
          to   { transform: scale(1);   opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ── Main CareScreen ───────────────────────────────────────────────────────

function deriveExpression(worm: WormState): WormExpression {
  if (worm.isSick)      return 'sick';
  if (worm.mood < 30)   return 'sad';
  if (worm.mood > 75)   return 'happy';
  return 'neutral';
}

export function CareScreen({ worm, onFeed, onCuddle, onOpenGames, onOpenFriends, onHeal, onHatch }: CareScreenProps) {
  const color = COLOR_MAP[worm.color];
  const glow  = GLOW_MAP[worm.color];
  const expr  = deriveExpression(worm);

  // ── Hatch sequence state ──────────────────────────────────────────────
  const [showHatchSequence, setShowHatchSequence] = useState(false);
  const [justHatched, setJustHatched] = useState(false);

  // ── Particles ─────────────────────────────────────────────────────────
  const [particles, setParticles] = useState<Particle[]>([]);
  const wormRef = useRef<HTMLDivElement>(null);

  const spawnParticles = useCallback((emojis: string[]) => {
    const rect = wormRef.current?.getBoundingClientRect();
    const cx   = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const cy   = rect ? rect.top  + rect.height / 2 : window.innerHeight / 2;
    const newPs: Particle[] = emojis.map((emoji) => ({
      id:    _pid++,
      emoji,
      x: cx + (Math.random() - 0.5) * 80 - 11,
      y: cy + (Math.random() - 0.5) * 60 - 11,
    }));
    setParticles((prev) => [...prev, ...newPs]);
    setTimeout(() => {
      setParticles((prev) => prev.filter((p) => !newPs.some((n) => n.id === p.id)));
    }, 950);
  }, []);

  // ── Idle ambient events ───────────────────────────────────────────────
  const [idleAnim, setIdleAnim] = useState<'none' | 'wink' | 'wiggle' | 'sneeze'>('none');
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleIdle = useCallback(() => {
    const delay = 8000 + Math.random() * 12000; // 8–20s
    idleTimerRef.current = setTimeout(() => {
      if (worm.stage === 'egg' || worm.isSick) { scheduleIdle(); return; }
      const roll = Math.random();
      if (roll < 0.4)       setIdleAnim('wink');
      else if (roll < 0.75) setIdleAnim('wiggle');
      else {
        setIdleAnim('sneeze');
        // Sneeze spawns a particle
        setTimeout(() => spawnParticles(['💨']), 300);
      }
      setTimeout(() => { setIdleAnim('none'); scheduleIdle(); }, 1200);
    }, delay);
  }, [worm.stage, worm.isSick, spawnParticles]);

  useEffect(() => {
    scheduleIdle();
    return () => { if (idleTimerRef.current) clearTimeout(idleTimerRef.current); };
  }, [scheduleIdle]);

  // ── Secret whistle — tap worm body 7 times fast ───────────────────────
  const whistleTapsRef = useRef(0);
  const whistleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [whistleActive, setWhistleActive] = useState(false);

  const handleWormTap = useCallback(() => {
    whistleTapsRef.current += 1;
    if (whistleTimerRef.current) clearTimeout(whistleTimerRef.current);
    whistleTimerRef.current = setTimeout(() => { whistleTapsRef.current = 0; }, 1500);
    if (whistleTapsRef.current >= 7) {
      whistleTapsRef.current = 0;
      setWhistleActive(true);
      spawnParticles(['✨','🌀','⭐','💫','✨']);
      setTimeout(() => setWhistleActive(false), 2000);
    }
  }, [spawnParticles]);

  // ── Action handlers with particles ────────────────────────────────────
  const handleFeed = useCallback(() => {
    onFeed();
    spawnParticles(['🍕','😋','✨']);
  }, [onFeed, spawnParticles]);

  const handleCuddle = useCallback(() => {
    onCuddle();
    spawnParticles(['💜','🤗','💫']);
  }, [onCuddle, spawnParticles]);

  const handleHatch = useCallback(() => {
    setShowHatchSequence(true);
    onHatch();
  }, [onHatch]);

  // ── Egg screen ────────────────────────────────────────────────────────
  if (worm.stage === 'egg' && !justHatched) {
    if (showHatchSequence) {
      return (
        <HatchSequence
          worm={worm}
          onComplete={() => { setShowHatchSequence(false); setJustHatched(true); }}
        />
      );
    }
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', height: '100dvh',
        alignItems: 'center', justifyContent: 'center', gap: 24,
        background: 'linear-gradient(160deg, #06000f 0%, #0a0020 50%, #060010 100%)',
        color: '#e0e0ff',
      }}>
        <p style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color, textShadow: `0 0 10px ${glow}`, margin: 0 }}>
          {worm.name}
        </p>
        <p style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: 'rgba(150,150,200,0.5)', margin: 0 }}>
          tap to accept the worm
        </p>
        <button onClick={handleHatch} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }} aria-label="Hatch your worm">
          <WormSVG color={worm.color} hat="none" shades="none" stage="egg" genome={worm.genome ?? ''} animated size={220} />
        </button>
        <p style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: 'rgba(150,150,200,0.35)', margin: 0 }}>
          no thoughts are good thoughts
        </p>
      </div>
    );
  }

  // Idle animation modifier for the worm SVG expression
  const displayExpr: WormExpression = idleAnim === 'wink' ? 'happy'
    : idleAnim === 'sneeze' ? 'neutral'
    : expr;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100dvh',
      background: 'linear-gradient(160deg, #06000f 0%, #0a0020 50%, #060010 100%)',
      color: '#e0e0ff',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      overflow: 'hidden', position: 'relative',
    }}>

      {/* ── Particles layer ── */}
      <ParticleLayer particles={particles} />

      {/* ── Nebula blobs ── */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0 }}>
        <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', top: '-15%', left: '-10%',
          background: `radial-gradient(circle, ${color}18 0%, transparent 70%)`, transition: 'background 0.6s' }} />
        <div style={{ position: 'absolute', width: 350, height: 350, borderRadius: '50%', bottom: '0', right: '-10%',
          background: 'radial-gradient(circle, rgba(0,120,255,0.10) 0%, transparent 70%)' }} />
      </div>

      {/* ── Header ── */}
      <div style={{
        position: 'relative', zIndex: 1, padding: '14px 20px 10px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderBottom: '1px solid rgba(0,245,255,0.1)',
        background: 'rgba(6,0,15,0.6)', backdropFilter: 'blur(8px)', flexShrink: 0,
      }}>
        <div>
          <p style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 10, margin: '0 0 2px', color, textShadow: `0 0 10px ${glow}`, lineHeight: 1.4 }}>
            {worm.name}
          </p>
          <p style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 5, margin: 0, color: `${color}70`, letterSpacing: '0.04em' }}>
            {TRAIT_LORE[worm.trait]}
          </p>
          {worm.isSick && (
            <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: '#ff0055', textShadow: '0 0 6px rgba(255,0,85,0.7)', animation: 'pulse 1s ease-in-out infinite' }}>
              😷 sick
            </span>
          )}
          {whistleActive && (
            <p style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, margin: '4px 0 0', color: '#fbbf24', textShadow: '0 0 8px #fbbf24', animation: 'pulse 0.3s ease-in-out infinite' }}>
              ★ ★ ★
            </p>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <StageBadge stage={worm.stage} />
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <GenomeReveal worm={worm} />
            <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: 'rgba(150,150,200,0.4)' }}>
              🔥 {worm.loginStreak}d
            </span>
            <button onClick={onOpenFriends} style={{
              fontFamily: "'Press Start 2P', monospace", fontSize: 6,
              background: 'rgba(255,0,204,0.1)', border: '1px solid rgba(255,0,204,0.35)',
              borderRadius: 3, color: '#ff00cc', padding: '4px 8px', cursor: 'pointer', lineHeight: 1.4,
            }}>
              🪱 {worm.friends.length}
            </button>
          </div>
        </div>
      </div>

      {/* ── Worm hero ── */}
      <div style={{
        position: 'relative', zIndex: 1, flex: '1 1 0',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: 0, padding: '8px 0',
      }}>
        <div
          ref={wormRef}
          onClick={handleWormTap}
          style={{
            background: `radial-gradient(circle at 45% 40%, ${color}14 0%, transparent 65%)`,
            border: `1px solid ${color}22`,
            borderRadius: 16, padding: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 0 30px ${glow.replace('0.7','0.1')}`,
            transition: 'all 0.5s ease',
            cursor: 'pointer',
            animation: idleAnim === 'wiggle' ? 'quickWiggle 0.6s ease-in-out' :
                       idleAnim === 'sneeze' ? 'sneeze 0.5s ease-in-out' : undefined,
          }}
        >
          <WormSVG
            color={worm.color}
            hat={worm.hat}
            shades={worm.shades}
            stage={worm.stage}
            genome={worm.genome ?? ''}
            expression={displayExpr}
            animated={idleAnim !== 'wiggle'}
            size={200}
          />
        </div>
      </div>

      {/* ── Stats panel ── */}
      <div style={{ position: 'relative', zIndex: 1, padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0 }}>
        <StatBar label="MOOD"  value={worm.mood}   color={color}    glowColor={glow}                      icon="💜" />
        <StatBar label="FOOD"  value={worm.hunger} color="#aaff00"  glowColor="rgba(170,255,0,0.6)"        icon="🍕" />
        <XpBar xp={worm.xp} stage={worm.stage} />
      </div>

      {/* ── Action buttons ── */}
      <div style={{
        position: 'relative', zIndex: 1, padding: '8px 12px',
        display: 'flex', gap: 8, flexShrink: 0,
        paddingBottom: 'max(20px, env(safe-area-inset-bottom, 20px))',
      }}>
        <ActionButton label="FEED"   emoji="🍕" color={color} glowColor={glow} onClick={handleFeed} />
        <ActionButton label="PLAY"   emoji="🎮" color={color} glowColor={glow} onClick={onOpenGames} />
        <ActionButton label="CUDDLE" emoji="🤗" color={color} glowColor={glow} onClick={handleCuddle} />
        {worm.isSick && (
          <ActionButton label="HEAL" emoji="💊" color="#ff0055" glowColor="rgba(255,0,85,0.7)" onClick={onHeal} />
        )}
      </div>

      <style>{`
        @keyframes floatUp {
          0%   { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-70px) scale(1.3); }
        }
        @keyframes quickWiggle {
          0%,100% { transform: rotate(0deg); }
          15%     { transform: rotate(-8deg) scale(1.05); }
          35%     { transform: rotate(8deg)  scale(1.08); }
          55%     { transform: rotate(-6deg) scale(1.04); }
          75%     { transform: rotate(5deg)  scale(1.03); }
        }
        @keyframes sneeze {
          0%,100% { transform: translateY(0); }
          20%     { transform: translateY(-4px); }
          40%     { transform: translateY(0) scale(1.04); }
          60%     { transform: translateY(-8px) scale(0.97); }
          80%     { transform: translateY(2px) scale(1.02); }
        }
        @keyframes pulse {
          0%,100% { opacity: 1; }
          50%     { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
