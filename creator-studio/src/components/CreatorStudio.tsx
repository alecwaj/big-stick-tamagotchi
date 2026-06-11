import { useState, useEffect } from 'react';
import { QRCodeSVG as QRCode } from 'qrcode.react';
import { WormSVG } from './WormSVG';
import {
  COLOR_MAP,
  GLOW_MAP,
  type WormColor,
  type WormHat,
  type WormShades,
  type WormTrait,
  type WormConfig,
  type CreatedWorm,
} from '../types';

// ── Genome generator (browser crypto) ────────────────────────────────────
function generateGenome(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ── API base ──────────────────────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

// ── Option data ───────────────────────────────────────────────────

const COLORS: WormColor[] = ['pink', 'green', 'purple', 'orange', 'blue', 'red', 'yellow'];

const HATS: { value: WormHat; label: string }[] = [
  { value: 'none',     label: 'None' },
  { value: 'fedora',   label: 'Fedora' },
  { value: 'panama',   label: 'Panama' },
  { value: 'bowler',   label: 'Bowler' },
  { value: 'trilby',   label: 'Trilby' },
  { value: 'akubra',   label: 'Akubra' },
  { value: 'bucket',   label: 'Bucket' },
  { value: 'baseball', label: 'Baseball' },
  { value: 'newsboy',  label: 'Newsboy' },
  { value: 'beanie',   label: 'Beanie' },
  { value: 'cowboy',   label: 'Cowboy' },
  { value: 'boater',   label: 'Boater' },
  { value: 'homburg',  label: 'Homburg' },
  { value: 'beret',    label: 'Beret' },
  { value: 'snapback', label: 'Snapback' },
  { value: 'tophat',   label: 'Top Hat' },
];

const SHADES: { value: WormShades; label: string }[] = [
  { value: 'none',  label: 'None' },
  { value: 'round', label: 'Round' },
  { value: 'star',  label: 'Star' },
  { value: 'heart', label: 'Heart' },
  { value: 'visor', label: 'Visor' },
];

const TRAITS: { value: WormTrait; label: string; emoji: string }[] = [
  { value: 'sleepy', label: 'Sleepy', emoji: '😴' },
  { value: 'hyper',  label: 'Hyper',  emoji: '⚡' },
  { value: 'grumpy', label: 'Grumpy', emoji: '😤' },
  { value: 'chill',  label: 'Chill',  emoji: '😎' },
  { value: 'bubbly', label: 'Bubbly', emoji: '🫧' },
  { value: 'spooky', label: 'Spooky', emoji: '👻' },
];

// ── Helpers ───────────────────────────────────────────────────────

const PWA_BASE = import.meta.env.VITE_PWA_URL ?? API_BASE.replace(':3001', ':5174');
function buildCareUrl(token: string): string {
  return `${PWA_BASE}/care?token=${token}`;
}

async function createWorm(config: WormConfig): Promise<CreatedWorm> {
  const resp = await fetch(`${API_BASE}/api/worms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name:   config.name,
      color:  config.color,
      hat:    config.hat,
      shades: config.shades,
      trait:  config.trait,
      genome: config.genome,
    }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? 'Failed to create worm');
  }
  const data = await resp.json() as { id: string; ownerToken: string; careUrl: string };
  return { id: data.id, ownerToken: data.ownerToken, config };
}

// ── Design tokens ─────────────────────────────────────────────────

const SURFACE  = 'rgba(255,255,255,0.03)';
const BORDER   = 'rgba(0,245,255,0.18)';
const CYAN     = '#00f5ff';
const MUTED    = 'rgba(150,150,200,0.55)';

// ── Sub-components ────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="pixel"
      style={{ margin: '0 0 12px 0', fontSize: 7, letterSpacing: '0.1em', color: CYAN, textShadow: `0 0 8px ${CYAN}` }}
    >
      {children}
    </p>
  );
}

function Divider() {
  return <div style={{ height: 1, background: BORDER, margin: '4px 0' }} />;
}

function ColorPicker({ value, onChange }: { value: WormColor; onChange: (c: WormColor) => void }) {
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      {COLORS.map((c) => {
        const isSelected = value === c;
        return (
          <button
            key={c}
            onClick={() => onChange(c)}
            title={c}
            style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              background: COLOR_MAP[c],
              border: isSelected ? `3px solid ${COLOR_MAP[c]}` : '3px solid rgba(255,255,255,0.1)',
              boxShadow: isSelected
                ? `0 0 0 2px #06000f, 0 0 0 4px ${COLOR_MAP[c]}, 0 0 16px ${GLOW_MAP[c]}`
                : 'none',
              cursor: 'pointer',
              transition: 'all 0.15s',
              transform: isSelected ? 'scale(1.2)' : 'scale(1)',
            }}
          />
        );
      })}
    </div>
  );
}

function PillPicker<T extends string>({
  options,
  value,
  onChange,
  accentColor = CYAN,
}: {
  options: { value: T; label: string; emoji?: string }[];
  value: T;
  onChange: (v: T) => void;
  accentColor?: string;
}) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {options.map((opt) => {
        const isSelected = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              padding: '7px 14px',
              borderRadius: 3,
              border: `1px solid ${isSelected ? accentColor : 'rgba(255,255,255,0.12)'}`,
              background: isSelected ? `rgba(0,245,255,0.10)` : SURFACE,
              color: isSelected ? accentColor : MUTED,
              fontWeight: isSelected ? 700 : 400,
              fontSize: 12,
              cursor: 'pointer',
              transition: 'all 0.15s',
              boxShadow: isSelected ? `0 0 8px rgba(0,245,255,0.25)` : 'none',
              letterSpacing: '0.02em',
            }}
          >
            {opt.emoji && <span style={{ marginRight: 5 }}>{opt.emoji}</span>}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Success screen ────────────────────────────────────────────────

function SuccessScreen({ worm, onReset }: { worm: CreatedWorm; onReset: () => void }) {
  const careUrl = buildCareUrl(worm.ownerToken);
  const [copied, setCopied] = useState(false);
  const [showEggCracks, setShowEggCracks] = useState(false);
  const wormGlow  = GLOW_MAP[worm.config.color];
  const wormColor = COLOR_MAP[worm.config.color];

  // After 2.5s show cracks on egg — teasing what's inside
  useEffect(() => {
    const t = setTimeout(() => setShowEggCracks(true), 2500);
    return () => clearTimeout(t);
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(careUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ textAlign: 'center' }}>
      <h2
        className="pixel"
        style={{
          fontSize: 13,
          margin: '0 0 4px 0',
          color: wormColor,
          textShadow: `0 0 12px ${wormGlow}, 0 0 30px ${wormGlow}`,
          lineHeight: 1.6,
        }}
      >
        {worm.config.name} is incubating!
      </h2>
      <p style={{ color: MUTED, margin: '0 0 32px 0', fontSize: 12 }}>
        Scan the QR code on your phone — your worm will hatch when you tap it.
      </p>

      <div style={{ display: 'flex', gap: 56, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
        {/* Egg preview — shows the mystery egg, not the worm yet */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <WormSVG
            color={worm.config.color}
            hat="none"
            shades="none"
            stage="egg"
            genome={worm.config.genome}
            hatched={showEggCracks}
            size={180}
          />
          <p className="pixel" style={{ fontSize: 7, color: MUTED, margin: 0 }}>
            {showEggCracks ? 'something stirs...' : 'something is inside...'}
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div className="qr-frame">
            <QRCode value={careUrl} size={180} level="M" bgColor="#0a0020" fgColor="#00f5ff" />
          </div>

          <button
            onClick={handleCopy}
            style={{
              padding: '10px 24px',
              borderRadius: 3,
              border: `1px solid ${BORDER}`,
              background: SURFACE,
              color: copied ? CYAN : MUTED,
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
              width: '100%',
              transition: 'all 0.2s',
              boxShadow: copied ? `0 0 8px rgba(0,245,255,0.3)` : 'none',
            }}
          >
            {copied ? '✓ Copied!' : 'Copy link'}
          </button>

          <p style={{ fontSize: 10, color: 'rgba(150,150,200,0.35)', margin: 0, maxWidth: 200, wordBreak: 'break-all' }}>
            {careUrl}
          </p>
        </div>
      </div>

      <button
        onClick={onReset}
        style={{
          marginTop: 48,
          padding: '10px 28px',
          borderRadius: 3,
          border: '1px solid rgba(255,255,255,0.08)',
          background: 'transparent',
          color: MUTED,
          fontSize: 12,
          cursor: 'pointer',
          letterSpacing: '0.02em',
        }}
      >
        ← create another
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────

const DEFAULT_CONFIG: WormConfig = {
  name: '',
  color: 'blue',
  hat: 'none',
  shades: 'none',
  trait: 'chill',
  genome: '',
};

export function CreatorStudio() {
  const [config, setConfig]     = useState<WormConfig>(DEFAULT_CONFIG);
  const [nameError, setNameError] = useState('');
  const [loading, setLoading]   = useState(false);
  const [created, setCreated]   = useState<CreatedWorm | null>(null);

  const update = <K extends keyof WormConfig>(key: K, value: WormConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
    if (key === 'name') setNameError('');
  };

  const handleHatch = async () => {
    if (!config.name.trim()) {
      setNameError('name required');
      return;
    }
    setLoading(true);
    try {
      const genome = generateGenome();
      const worm = await createWorm({ ...config, name: config.name.trim(), genome });
      setCreated(worm);
    } catch (err) {
      console.error(err);
      setNameError('server error — is the API running?');
    } finally {
      setLoading(false);
    }
  };

  if (created) {
    return (
      <SuccessScreen
        worm={created}
        onReset={() => { setCreated(null); setConfig(DEFAULT_CONFIG); }}
      />
    );
  }

  const wormColor = COLOR_MAP[config.color];
  const wormGlow  = GLOW_MAP[config.color];

  return (
    <div style={{ display: 'flex', gap: 48, alignItems: 'flex-start', flexWrap: 'wrap' }}>

      {/* ── Live preview ── */}
      <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, position: 'sticky', top: 32 }}>
        <div
          style={{
            background: `radial-gradient(circle at 40% 35%, ${wormColor}18 0%, rgba(6,0,15,0.8) 65%)`,
            border: `1px solid ${wormColor}44`,
            boxShadow: `0 0 24px ${wormGlow.replace('0.7','0.2')}, inset 0 0 30px rgba(0,0,0,0.5)`,
            borderRadius: 8,
            padding: 28,
            minWidth: 230,
            minHeight: 230,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'box-shadow 0.4s, border-color 0.4s, background 0.4s',
          }}
        >
          <WormSVG color={config.color} hat={config.hat} shades={config.shades} size={180} />
        </div>

        {config.name && (
          <p
            className="pixel"
            style={{ fontSize: 8, color: wormColor, textShadow: `0 0 8px ${wormGlow}`, margin: 0, textAlign: 'center', maxWidth: 200, lineHeight: 1.8 }}
          >
            {config.name}
          </p>
        )}
        {config.trait && (
          <span
            style={{
              background: `${wormColor}18`,
              color: wormColor,
              border: `1px solid ${wormColor}55`,
              borderRadius: 3,
              padding: '5px 12px',
              fontSize: 11,
              letterSpacing: '0.04em',
              textTransform: 'capitalize',
            }}
          >
            {TRAITS.find((t) => t.value === config.trait)?.emoji} {config.trait}
          </span>
        )}
      </div>

      {/* ── Form ── */}
      <div
        style={{
          flex: '1 1 300px',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
          background: SURFACE,
          border: `1px solid ${BORDER}`,
          borderRadius: 8,
          padding: 28,
          backdropFilter: 'blur(6px)',
        }}
      >
        {/* Name */}
        <div>
          <SectionLabel>Name</SectionLabel>
          <input
            type="text"
            className={`neon-input${nameError ? ' error' : ''}`}
            value={config.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="what's your worm called?"
            maxLength={30}
          />
          {nameError && (
            <p className="pixel" style={{ margin: '8px 0 0 2px', color: '#ff0055', fontSize: 7, textShadow: '0 0 6px rgba(255,0,85,0.5)' }}>
              {nameError}
            </p>
          )}
        </div>

        <Divider />

        {/* Color */}
        <div>
          <SectionLabel>Color</SectionLabel>
          <ColorPicker value={config.color} onChange={(c) => update('color', c)} />
        </div>

        <Divider />

        {/* Hat */}
        <div>
          <SectionLabel>Hat</SectionLabel>
          <PillPicker options={HATS} value={config.hat} onChange={(v) => update('hat', v)} />
        </div>

        <Divider />

        {/* Shades */}
        <div>
          <SectionLabel>Shades</SectionLabel>
          <PillPicker options={SHADES} value={config.shades} onChange={(v) => update('shades', v)} />
        </div>

        <Divider />

        {/* Trait */}
        <div>
          <SectionLabel>Personality</SectionLabel>
          <PillPicker options={TRAITS} value={config.trait} onChange={(v) => update('trait', v)} />
        </div>

        {/* CTA */}
        <button
          className="hatch-btn"
          onClick={handleHatch}
          disabled={loading}
        >
          {loading ? 'hatching...' : '🪱 hatch my worm'}
        </button>
      </div>
    </div>
  );
}
