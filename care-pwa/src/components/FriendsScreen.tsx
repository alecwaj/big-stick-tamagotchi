import { useState, useEffect, useRef, useCallback } from 'react';
import jsQR from 'jsqr';
import { QRCodeSVG } from 'qrcode.react';
import type { WormFriend, AddFriendResult } from '../types';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
const PWA_BASE = import.meta.env.VITE_PWA_URL ?? API_BASE.replace(':3001', ':5174');

interface FriendsScreenProps {
  myToken: string;
  friends: WormFriend[];
  onAddFriend: (token: string) => AddFriendResult | Promise<AddFriendResult>;
  onClose: () => void;
}

type Tab = 'myqr' | 'scan' | 'list';
type ScanPhase = 'requesting' | 'scanning' | 'success' | 'self' | 'invalid' | 'denied';

function buildCareUrl(token: string) {
  return `${PWA_BASE}/care?token=${token}`;
}

function shortToken(token: string) {
  return token.slice(0, 8).toUpperCase();
}

function formatDate(ms: number) {
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ── QR Scanner ───────────────────────────────────────────────────

function QRScanner({ onDetected }: { onDetected: (data: string) => void }) {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<ScanPhase>('requesting');

  useEffect(() => {
    let cancelled = false;

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        const video = videoRef.current!;
        video.srcObject = stream;
        video.play();
        setPhase('scanning');

        const tick = () => {
          if (cancelled) return;
          const canvas = canvasRef.current;
          const ctx    = canvas?.getContext('2d');
          if (!canvas || !ctx) { rafRef.current = requestAnimationFrame(tick); return; }

          if (video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.width  = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);
            const img  = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
            if (code?.data) { onDetected(code.data); return; }
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      })
      .catch(() => { if (!cancelled) setPhase('denied'); });

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [onDetected]);

  if (phase === 'requesting') return (
    <div style={centreStyle}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>📷</div>
      <p style={pixelStyle(8, '#00f5ff')}>requesting camera...</p>
    </div>
  );

  if (phase === 'denied') return (
    <div style={centreStyle}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>🚫</div>
      <p style={pixelStyle(7, '#ff0055')}>camera access denied</p>
      <p style={{ color: 'rgba(180,180,220,0.6)', fontSize: 12, textAlign: 'center', marginTop: 8 }}>
        Allow camera access in your browser settings and try again.
      </p>
    </div>
  );

  return (
    <div style={{ position: 'relative', width: '100%', flex: 1, overflow: 'hidden', background: '#000' }}>
      <video
        ref={videoRef}
        playsInline
        muted
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
      {/* Hidden canvas for jsQR processing */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Viewfinder overlay */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        <div style={{
          width: 220, height: 220,
          border: '2px solid #00f5ff',
          boxShadow: '0 0 0 2000px rgba(0,0,0,0.55), 0 0 20px rgba(0,245,255,0.5)',
          borderRadius: 8,
          position: 'relative',
        }}>
          {/* Corner brackets */}
          {[
            { top: -2, left: -2, borderTop: '3px solid #00f5ff', borderLeft: '3px solid #00f5ff', borderRadius: '6px 0 0 0' },
            { top: -2, right: -2, borderTop: '3px solid #00f5ff', borderRight: '3px solid #00f5ff', borderRadius: '0 6px 0 0' },
            { bottom: -2, left: -2, borderBottom: '3px solid #00f5ff', borderLeft: '3px solid #00f5ff', borderRadius: '0 0 0 6px' },
            { bottom: -2, right: -2, borderBottom: '3px solid #00f5ff', borderRight: '3px solid #00f5ff', borderRadius: '0 0 6px 0' },
          ].map((s, i) => (
            <div key={i} style={{ position: 'absolute', width: 24, height: 24, ...s }} />
          ))}
          {/* Scan line */}
          <div style={{
            position: 'absolute', left: 0, right: 0, height: 2,
            background: 'linear-gradient(90deg, transparent, #00f5ff, transparent)',
            animation: 'scanLine 2s ease-in-out infinite',
            boxShadow: '0 0 8px #00f5ff',
          }} />
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: 20, left: 0, right: 0, textAlign: 'center' }}>
        <span style={pixelStyle(7, 'rgba(0,245,255,0.8)')}>point at their QR code</span>
      </div>

      <style>{`
        @keyframes scanLine {
          0%, 100% { top: 0; }
          50%       { top: calc(100% - 2px); }
        }
      `}</style>
    </div>
  );
}

// ── Success flash ─────────────────────────────────────────────────

function MeetFlash({ result, friendToken, onDismiss }: { result: AddFriendResult; friendToken: string; onDismiss: () => void }) {
  const isNew = result === 'added';
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 10,
      background: 'rgba(6,0,15,0.97)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 20, padding: 32, textAlign: 'center',
    }}>
      <div style={{ fontSize: 72, lineHeight: 1, animation: 'popIn 0.4s cubic-bezier(0.34,1.56,0.64,1)' }}>
        {isNew ? '🐛' : '🎉'}
      </div>
      <p style={pixelStyle(13, isNew ? '#aaff00' : '#ff00cc')}>
        {isNew ? 'new worm friend!' : 'reunited!'}
      </p>
      <div style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(0,245,255,0.2)',
        borderRadius: 8, padding: '12px 24px',
      }}>
        <p style={pixelStyle(8, '#00f5ff')}>WORM #{shortToken(friendToken)}</p>
        <p style={{ color: 'rgba(150,150,200,0.6)', fontSize: 11, margin: '6px 0 0' }}>
          {isNew ? 'added to your friends' : 'meet count updated'}
        </p>
      </div>
      <p style={{ color: 'rgba(150,150,200,0.5)', fontSize: 11 }}>+10 mood · +5 XP</p>
      <button onClick={onDismiss} style={{
        fontFamily: "'Press Start 2P', monospace", fontSize: 8,
        padding: '12px 24px', borderRadius: 4,
        border: '1px solid rgba(0,245,255,0.4)',
        background: 'rgba(0,245,255,0.08)',
        color: '#00f5ff', cursor: 'pointer',
        boxShadow: '0 0 12px rgba(0,245,255,0.2)',
      }}>
        awesome →
      </button>
      <style>{`
        @keyframes popIn {
          from { transform: scale(0.3); opacity: 0; }
          to   { transform: scale(1);   opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ── Friend list item ──────────────────────────────────────────────

function FriendRow({ friend, index }: { friend: WormFriend; index: number }) {
  const colors = ['#00f5ff', '#aaff00', '#ff00cc', '#ff6600', '#cc00ff'];
  const color  = colors[index % colors.length];
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '12px 16px',
      background: 'rgba(255,255,255,0.02)',
      border: `1px solid ${color}22`,
      borderRadius: 8,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: '50%',
        background: `${color}18`,
        border: `2px solid ${color}44`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20, flexShrink: 0,
      }}>
        🐛
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ ...pixelStyle(8, color), margin: '0 0 4px' }}>
          #{shortToken(friend.token)}
        </p>
        <p style={{ margin: 0, fontSize: 11, color: 'rgba(150,150,200,0.5)' }}>
          first met {formatDate(friend.firstMetAt)}
        </p>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <p style={pixelStyle(10, color)}>{friend.meetCount}×</p>
        <p style={{ margin: 0, fontSize: 10, color: 'rgba(150,150,200,0.4)' }}>
          {formatDate(friend.lastMetAt)}
        </p>
      </div>
    </div>
  );
}

// ── Main screen ───────────────────────────────────────────────────

export function FriendsScreen({ myToken, friends, onAddFriend, onClose }: FriendsScreenProps) {
  const [tab, setTab]                   = useState<Tab>('myqr');
  const [scanResult, setScanResult]     = useState<{ result: AddFriendResult; token: string } | null>(null);
  const [scanError, setScanError]       = useState<string | null>(null);
  const [scanKey, setScanKey]           = useState(0); // remount scanner on retry

  const handleDetected = useCallback(async (data: string) => {
    setScanError(null);
    try {
      // Accept both full URLs and raw UUIDs
      let token: string | null = null;
      try {
        token = new URL(data).searchParams.get('token');
      } catch {
        // Not a URL — check if it looks like a UUID
        if (/^[0-9a-f-]{36}$/i.test(data)) token = data;
      }
      if (!token) { setScanError('Not a worm QR code. Try again.'); setScanKey((k) => k + 1); return; }
      const result = await onAddFriend(token);
      if (result === 'invalid') { setScanError('Not a worm QR code. Try again.'); setScanKey((k) => k + 1); return; }
      setScanResult({ result, token });
    } catch {
      setScanError('Could not read that QR code.');
    }
  }, [onAddFriend]);

  const handleDismiss = () => {
    setScanResult(null);
    setScanKey((k) => k + 1); // restart scanner
  };

  const sortedFriends = [...friends].sort((a, b) => b.lastMetAt - a.lastMetAt);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      background: 'linear-gradient(160deg, #06000f 0%, #0a0020 100%)',
      display: 'flex', flexDirection: 'column',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      color: '#e0e0ff',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid rgba(0,245,255,0.12)',
        background: 'rgba(6,0,15,0.8)', backdropFilter: 'blur(8px)',
      }}>
        <div>
          <p style={pixelStyle(9, '#00f5ff')}>👥 worm friends</p>
          <p style={{ margin: '4px 0 0', fontSize: 11, color: 'rgba(150,150,200,0.5)' }}>
            {friends.length} {friends.length === 1 ? 'friend' : 'friends'} · {friends.reduce((s, f) => s + f.meetCount, 0)} total meets
          </p>
        </div>
        <button onClick={onClose} style={{
          background: 'none', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 4, color: 'rgba(200,200,220,0.5)',
          fontSize: 12, padding: '6px 14px', cursor: 'pointer',
        }}>
          ← back
        </button>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 0, flexShrink: 0,
        borderBottom: '1px solid rgba(0,245,255,0.1)',
      }}>
        {([
          { id: 'myqr' as Tab, label: 'MY QR',   emoji: '🔲' },
          { id: 'scan' as Tab, label: 'SCAN',     emoji: '📷' },
          { id: 'list' as Tab, label: `FRIENDS`,  emoji: '🐛' },
        ]).map(({ id, label, emoji }) => (
          <button key={id} onClick={() => setTab(id)} style={{
            flex: 1, padding: '12px 4px',
            background: tab === id ? 'rgba(0,245,255,0.08)' : 'transparent',
            border: 'none',
            borderBottom: tab === id ? '2px solid #00f5ff' : '2px solid transparent',
            color: tab === id ? '#00f5ff' : 'rgba(150,150,200,0.5)',
            fontFamily: "'Press Start 2P', monospace", fontSize: 7,
            cursor: 'pointer', letterSpacing: '0.04em',
            transition: 'all 0.15s',
          }}>
            <span style={{ display: 'block', fontSize: 18, marginBottom: 4 }}>{emoji}</span>
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', position: 'relative' }}>

        {/* MY QR tab */}
        {tab === 'myqr' && (
          <div style={{ ...centreStyle, padding: '32px 24px', gap: 24 }}>
            <p style={pixelStyle(7, 'rgba(150,150,200,0.6)')}>show this to a friend</p>
            <div style={{
              padding: 20,
              background: '#0a0020',
              border: '2px solid #00f5ff',
              borderRadius: 12,
              boxShadow: '0 0 24px rgba(0,245,255,0.3)',
            }}>
              <QRCodeSVG value={buildCareUrl(myToken)} size={210} bgColor="#0a0020" fgColor="#00f5ff" level="M" />
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={pixelStyle(8, '#00f5ff')}>#{shortToken(myToken)}</p>
              <p style={{ margin: '6px 0 0', fontSize: 11, color: 'rgba(150,150,200,0.5)' }}>
                they scan this · you scan theirs
              </p>
            </div>
          </div>
        )}

        {/* SCAN tab */}
        {tab === 'scan' && (
          <>
            <QRScanner key={scanKey} onDetected={handleDetected} />
            {scanError && (
              <div style={{ padding: '10px 20px', background: 'rgba(255,0,85,0.1)', borderTop: '1px solid rgba(255,0,85,0.3)', flexShrink: 0 }}>
                <p style={{ margin: 0, color: '#ff0055', fontSize: 12, textAlign: 'center' }}>{scanError}</p>
              </div>
            )}
            {scanResult && (
              <MeetFlash
                result={scanResult.result}
                friendToken={scanResult.token}
                onDismiss={handleDismiss}
              />
            )}
          </>
        )}

        {/* FRIENDS LIST tab */}
        {tab === 'list' && (
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sortedFriends.length === 0 ? (
              <div style={{ ...centreStyle, padding: 48, gap: 16 }}>
                <div style={{ fontSize: 48 }}>🐛</div>
                <p style={pixelStyle(7, 'rgba(150,150,200,0.4)')}>no friends yet</p>
                <p style={{ color: 'rgba(150,150,200,0.4)', fontSize: 12, textAlign: 'center' }}>
                  scan a worm friend's QR code to add them
                </p>
              </div>
            ) : (
              sortedFriends.map((f, i) => <FriendRow key={f.token} friend={f} index={i} />)
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Style helpers ─────────────────────────────────────────────────

const centreStyle: React.CSSProperties = {
  flex: 1, display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center',
};

function pixelStyle(size: number, color: string): React.CSSProperties {
  return {
    fontFamily: "'Press Start 2P', monospace",
    fontSize: size, color,
    textShadow: `0 0 8px ${color}`,
    margin: 0, lineHeight: 1.6,
  };
}
