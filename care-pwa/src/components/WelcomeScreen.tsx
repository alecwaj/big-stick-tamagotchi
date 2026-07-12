import { useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
const PWA_BASE = import.meta.env.VITE_PWA_URL ?? window.location.origin;

export function WelcomeScreen() {
  const [name, setName]       = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const findByName = async () => {
    const trimmed = name.trim();
    if (!trimmed) { setError('the hive needs a name'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/lookup?name=${encodeURIComponent(trimmed)}`);
      if (!res.ok) { setError('no airhead found. have you accepted?'); setLoading(false); return; }
      const data = await res.json() as { ownerToken: string };
      // Navigate to the care URL with the token
      window.location.href = `${PWA_BASE}/care?token=${data.ownerToken}`;
    } catch {
      setError('hive signal lost — check your connection');
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(160deg, #06000f 0%, #0a0020 50%, #060010 100%)',
      color: '#e0e0ff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      padding: 32,
      textAlign: 'center',
      gap: 28,
    }}>
      {/* Animated worm egg */}
      <div style={{
        width: 110, height: 130,
        borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
        background: 'linear-gradient(135deg, #cc00ff44, #00f5ff22)',
        border: '2px solid rgba(0,245,255,0.3)',
        boxShadow: '0 0 30px rgba(0,245,255,0.2), 0 0 60px rgba(204,0,255,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 44,
        animation: 'eggFloat 3s ease-in-out infinite',
      }}>
        🪱
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h1 style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: 12, margin: 0, color: '#00f5ff',
          textShadow: '0 0 12px #00f5ff, 0 0 30px rgba(0,245,255,0.4)',
          lineHeight: 1.8,
        }}>
          Airvana
        </h1>
        <p style={{ margin: 0, color: 'rgba(150,150,200,0.6)', fontSize: 13, lineHeight: 1.6 }}>
          The hive is waiting for you.
        </p>
      </div>

      {/* How to start */}
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(0,245,255,0.15)',
        borderRadius: 8, padding: '18px 22px',
        maxWidth: 300, width: '100%',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <p style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: 7, color: '#00f5ff',
          textShadow: '0 0 6px #00f5ff', margin: 0, lineHeight: 2,
        }}>
          First time?
        </p>
        <ol style={{ margin: 0, paddingLeft: 20, color: 'rgba(180,180,220,0.7)', fontSize: 12, lineHeight: 2, textAlign: 'left' }}>
          <li>Visit the <strong style={{ color: '#e0e0ff' }}>Acceptance Studio</strong> on the big screen</li>
          <li>Choose your worm</li>
          <li>Scan the QR and accept</li>
        </ol>
      </div>

      {/* Divider */}
      <p style={{ color: 'rgba(150,150,200,0.3)', fontSize: 11 }}>— returning airhead? —</p>

      {/* Rejoin by name */}
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(0,245,255,0.15)',
        borderRadius: 8, padding: '18px 22px',
        maxWidth: 300, width: '100%',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <p style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: 7, color: '#00f5ff',
          textShadow: '0 0 6px #00f5ff', margin: 0, lineHeight: 2,
        }}>
          Find my worm
        </p>
        <input
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); setError(''); }}
          onKeyDown={(e) => e.key === 'Enter' && findByName()}
          placeholder="enter your worm's name"
          disabled={loading}
          style={{
            width: '100%', padding: '12px 14px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(0,245,255,0.2)',
            borderRadius: 4, color: '#e0e0ff',
            fontSize: 14, outline: 'none',
            fontFamily: 'inherit',
          }}
        />
        {error && (
          <p style={{ margin: 0, color: '#ff0055', fontSize: 11, lineHeight: 1.5 }}>{error}</p>
        )}
        <button
          onClick={findByName}
          disabled={loading}
          style={{
            padding: '12px',
            background: loading ? 'rgba(0,245,255,0.04)' : 'rgba(0,245,255,0.08)',
            border: '1px solid rgba(0,245,255,0.3)',
            borderRadius: 4, color: '#00f5ff',
            fontFamily: "'Press Start 2P', monospace", fontSize: 7,
            cursor: loading ? 'default' : 'pointer',
            transition: 'all 0.15s',
          }}
        >
          {loading ? 'searching...' : 'find my worm →'}
        </button>
      </div>

      <style>{`
        @keyframes eggFloat {
          0%, 100% { transform: translateY(0px) rotate(-2deg); }
          50%       { transform: translateY(-12px) rotate(2deg); }
        }
        input::placeholder { color: rgba(150,150,200,0.3); }
        input:focus { border-color: rgba(0,245,255,0.5) !important; }
      `}</style>
    </div>
  );
}
