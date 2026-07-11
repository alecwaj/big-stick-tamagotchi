import { useState, useEffect, useRef, useCallback } from 'react';
import jsQR from 'jsqr';
import { WormSVG } from './WormSVG';
import type { Transmission, AbsorbResult, WormColor } from '../types';
import { COLOR_MAP } from '../types';

// ── Inline QR Scanner (camera + jsQR) ─────────────────────────────────────

type ScanPhase = 'requesting' | 'scanning' | 'denied';

function QRScannerInline({ onDetected }: { onDetected: (data: string) => void }) {
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
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
      <div style={{ fontSize: 36 }}>📷</div>
      <p style={{ margin: 0, fontSize: 11, color: '#00f5ff', fontFamily: "'Press Start 2P', monospace" }}>requesting camera...</p>
    </div>
  );

  if (phase === 'denied') return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, textAlign: 'center' }}>
      <div style={{ fontSize: 36 }}>🚫</div>
      <p style={{ margin: 0, fontSize: 12, color: '#ff0055' }}>camera access denied</p>
      <p style={{ margin: 0, fontSize: 12, color: 'rgba(180,180,220,0.6)', lineHeight: 1.6 }}>
        Allow camera access in your browser settings and try again.
      </p>
    </div>
  );

  return (
    <div style={{ position: 'relative', flex: 1, overflow: 'hidden', background: '#000', minHeight: 280 }}>
      <video ref={videoRef} playsInline muted
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Viewfinder */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        <div style={{ width: 200, height: 200, border: '2px solid #00f5ff',
          boxShadow: '0 0 0 2000px rgba(0,0,0,0.55), 0 0 20px rgba(0,245,255,0.5)',
          borderRadius: 8, position: 'relative' }}>
          {[
            { top: -2, left: -2, borderTop: '3px solid #00f5ff', borderLeft: '3px solid #00f5ff', borderRadius: '6px 0 0 0' },
            { top: -2, right: -2, borderTop: '3px solid #00f5ff', borderRight: '3px solid #00f5ff', borderRadius: '0 6px 0 0' },
            { bottom: -2, left: -2, borderBottom: '3px solid #00f5ff', borderLeft: '3px solid #00f5ff', borderRadius: '0 0 0 6px' },
            { bottom: -2, right: -2, borderBottom: '3px solid #00f5ff', borderRight: '3px solid #00f5ff', borderRadius: '0 0 6px 0' },
          ].map((s, i) => <div key={i} style={{ position: 'absolute', width: 24, height: 24, ...s }} />)}
          <div style={{ position: 'absolute', left: 0, right: 0, height: 2,
            background: 'linear-gradient(90deg, transparent, #00f5ff, transparent)',
            animation: 'txScanLine 2s ease-in-out infinite',
            boxShadow: '0 0 8px #00f5ff' }} />
        </div>
      </div>
      <div style={{ position: 'absolute', bottom: 16, left: 0, right: 0, textAlign: 'center' }}>
        <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: 'rgba(0,245,255,0.8)', textShadow: '0 0 8px #00f5ff' }}>
          scan their worm QR
        </span>
      </div>
      <style>{`@keyframes txScanLine { 0%,100% { top:0; } 50% { top: calc(100% - 2px); } }`}</style>
    </div>
  );
}

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

const MUTED   = 'rgba(150,150,200,0.55)';
const CYAN    = '#00f5ff';
const CARD_BG = 'rgba(15,0,45,0.85)';
const BORDER  = 'rgba(0,245,255,0.2)';

// Mutation key → visual description shown in the reveal
const MUTATION_LORE: Record<string, string> = {
  eye_shift:     'its eyes have shifted',
  body_morph:    'its body has reshaped',
  glow_surge:    'its glow has intensified',
  mouth_warp:    'its mouth has changed',
  marking_bloom: 'new markings have bloomed',
  pupil_split:   'its pupils have fractured',
  tail_mutation: 'its tail has mutated',
  nub_growth:    'new growth has appeared',
  trait_echo:    'its personality has shifted',
};

interface TransmitScreenProps {
  myToken: string;
  myName: string;
  myColor: WormColor;
  myGenome: string;
  onTransmit: (toToken: string) => Promise<{ fragment: string; label: string } | null>;
  onAbsorb: (txId: string) => Promise<AbsorbResult | null>;
  onClose: () => void;
}

type Tab = 'inbox' | 'send';

interface InboxPayload {
  transmissions: Transmission[];
  unread: number;
}

// ── Small worm portrait ───────────────────────────────────────────────────

function WormPortrait({ color, genome, size = 48 }: { color: WormColor; genome: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'rgba(0,0,0,0.4)',
      border: `1px solid ${COLOR_MAP[color]}44`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden', flexShrink: 0,
    }}>
      <WormSVG
        color={color}
        genome={genome}
        stage="baby"
        expression="happy"
        hat="none"
        shades="none"
        animated={false}
        size={size - 8}
      />
    </div>
  );
}

// ── Mutation reveal overlay ───────────────────────────────────────────────

function MutationReveal({ result, wormName, onDone }: {
  result: AbsorbResult;
  wormName: string;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<'flash' | 'show' | 'done'>('flash');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('show'), 400);
    return () => clearTimeout(t1);
  }, []);

  const lore = MUTATION_LORE[result.mutationKey] ?? 'it has changed';

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: phase === 'flash'
          ? 'rgba(0,245,255,0.35)'
          : 'rgba(6,0,20,0.95)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 32, textAlign: 'center',
        transition: 'background 0.4s ease',
        fontFamily: '-apple-system, sans-serif',
      }}
    >
      <div style={{ fontSize: 52, marginBottom: 20, animation: 'spin 0.6s ease-out' }}>🧬</div>

      <h2 style={{ color: CYAN, fontSize: 18, margin: '0 0 12px', fontWeight: 700 }}>
        mutation absorbed
      </h2>

      <p style={{ color: 'rgba(200,200,255,0.9)', fontSize: 15, margin: '0 0 8px', lineHeight: 1.5 }}>
        {wormName} {lore}
      </p>

      {result.traitChanged && (
        <p style={{ color: '#aaff00', fontSize: 13, margin: '0 0 8px' }}>
          personality shifted → <strong>{result.newTrait}</strong>
        </p>
      )}

      <p style={{ color: MUTED, fontSize: 12, margin: '0 0 32px' }}>
        +{result.xpGained} XP absorbed into the hive
      </p>

      <button
        onClick={onDone}
        style={{
          padding: '14px 36px',
          background: 'linear-gradient(90deg, #7b00ff, #00c8ff)',
          border: 'none', borderRadius: 10,
          color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
        }}
      >
        🪱 continue
      </button>

      <style>{`
        @keyframes spin { from { transform: rotate(-20deg) scale(0.5); opacity: 0; } to { transform: none; opacity: 1; } }
      `}</style>
    </div>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────

export function TransmitScreen({
  myToken, myName,
  onTransmit, onAbsorb, onClose,
}: TransmitScreenProps) {
  const [tab, setTab]             = useState<Tab>('inbox');
  const [inbox, setInbox]         = useState<Transmission[] | null>(null);
  const [unread, setUnread]       = useState(0);
  const [loading, setLoading]     = useState(false);

  // Send state
  const [scanState, setScanState]   = useState<'scanning' | 'sending' | 'sent' | 'error' | 'ratelimit'>('scanning');
  const [sentFragment, setSentFragment] = useState('');
  const [sentToName, setSentToName] = useState('');

  // Absorb state
  const [absorbingId, setAbsorbingId] = useState<string | null>(null);
  const [mutationResult, setMutationResult] = useState<AbsorbResult | null>(null);

  // Fetch inbox
  const fetchInbox = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/transmit/${myToken}/inbox`);
      if (r.ok) {
        const data = await r.json() as InboxPayload;
        setInbox(data.transmissions);
        setUnread(data.unread);
      }
    } finally {
      setLoading(false);
    }
  }, [myToken]);

  useEffect(() => { fetchInbox(); }, [fetchInbox]);

  // ── Send handler — called when a QR is scanned
  const handleScanned = async (qrData: string) => {
    // Extract token from care URL: /care?token=<uuid>
    let toToken: string | null = null;
    try {
      const url = new URL(qrData);
      toToken = url.searchParams.get('token');
    } catch {
      // raw token
      if (/^[0-9a-f-]{36}$/.test(qrData)) toToken = qrData;
    }
    if (!toToken || toToken === myToken) {
      setScanState('error');
      setTimeout(() => setScanState('scanning'), 2000);
      return;
    }
    setScanState('sending');
    const result = await onTransmit(toToken);
    if (!result) {
      setScanState('ratelimit');
      setTimeout(() => setScanState('scanning'), 3000);
      return;
    }
    setSentFragment(result.fragment);
    setSentToName(toToken.slice(0, 6).toUpperCase());
    setScanState('sent');
  };

  // ── Absorb handler
  const handleAbsorb = async (txId: string) => {
    setAbsorbingId(txId);
    const result = await onAbsorb(txId);
    setAbsorbingId(null);
    if (result) {
      setMutationResult(result);
      // Optimistically mark as absorbed in inbox
      setInbox((prev) => prev
        ? prev.map((t) => t.id === txId ? { ...t, mutation_applied: 1, read_at: Date.now() } : t)
        : prev
      );
    }
  };

  if (mutationResult) {
    return (
      <MutationReveal
        result={mutationResult}
        wormName={myName}
        onDone={() => { setMutationResult(null); fetchInbox(); }}
      />
    );
  }

  const screenStyle: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 100,
    background: 'linear-gradient(160deg, #0d0030 0%, #150040 100%)',
    display: 'flex', flexDirection: 'column',
    fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
    color: '#e0e0ff',
    overflowY: 'auto',
  };

  return (
    <div style={screenStyle}>
      {/* Header */}
      <div style={{
        padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12,
        borderBottom: `1px solid ${BORDER}`,
        background: 'rgba(6,0,15,0.7)', backdropFilter: 'blur(8px)',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: MUTED,
          fontSize: 20, cursor: 'pointer', padding: '0 4px',
        }}>←</button>
        <div>
          <h2 style={{ margin: 0, fontSize: 13, color: CYAN, fontFamily: "'Press Start 2P', monospace" }}>
            transmit
          </h2>
          <p style={{ margin: '3px 0 0', fontSize: 10, color: MUTED }}>
            send thought fragments · evolve your worm
          </p>
        </div>
        {unread > 0 && (
          <div style={{
            marginLeft: 'auto',
            background: '#ff0055', color: '#fff',
            borderRadius: 10, padding: '2px 7px', fontSize: 11, fontWeight: 700,
          }}>
            {unread} new
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}` }}>
        {(['inbox', 'send'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, padding: '12px 0',
              background: 'none',
              border: 'none',
              borderBottom: tab === t ? `2px solid ${CYAN}` : '2px solid transparent',
              color: tab === t ? CYAN : MUTED,
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
              letterSpacing: '0.05em',
            }}
          >
            {t === 'inbox' ? `📥 inbox${unread > 0 ? ` (${unread})` : ''}` : '📡 transmit'}
          </button>
        ))}
      </div>

      {/* ── INBOX TAB ── */}
      {tab === 'inbox' && (
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {loading && !inbox && (
            <p style={{ color: MUTED, fontSize: 12, textAlign: 'center', padding: 32 }}>
              receiving transmissions...
            </p>
          )}

          {inbox?.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 20px', color: MUTED }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📡</div>
              <p style={{ fontSize: 13, margin: 0 }}>no transmissions yet</p>
              <p style={{ fontSize: 11, margin: '6px 0 0', color: 'rgba(150,150,200,0.4)' }}>
                get a friend to send you a thought fragment
              </p>
            </div>
          )}

          {inbox?.map((tx) => {
            const absorbed  = tx.mutation_applied === 1;
            const isNew     = !tx.read_at && !absorbed;
            const absorbing = absorbingId === tx.id;

            return (
              <div
                key={tx.id}
                style={{
                  background: CARD_BG,
                  border: `1px solid ${isNew ? 'rgba(0,245,255,0.4)' : BORDER}`,
                  borderRadius: 12,
                  padding: '14px 16px',
                  display: 'flex', flexDirection: 'column', gap: 10,
                  boxShadow: isNew ? '0 0 12px rgba(0,245,255,0.08)' : 'none',
                }}
              >
                {/* Sender row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <WormPortrait color={tx.from_color} genome="" size={36} />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: COLOR_MAP[tx.from_color] }}>
                      {tx.from_name}
                    </span>
                    <span style={{ fontSize: 10, color: MUTED, marginLeft: 8 }}>
                      {new Date(tx.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {isNew && (
                    <div style={{
                      fontSize: 8,  background: '#00f5ff22', color: CYAN,
                      border: '1px solid rgba(0,245,255,0.3)',
                      borderRadius: 6, padding: '2px 6px',
                    }}>NEW</div>
                  )}
                </div>

                {/* Fragment */}
                <p style={{
                  margin: 0, fontSize: 14, color: 'rgba(220,220,255,0.9)',
                  fontStyle: 'italic', lineHeight: 1.5,
                  borderLeft: `2px solid ${COLOR_MAP[tx.from_color]}66`,
                  paddingLeft: 10,
                }}>
                  "{tx.fragment}"
                </p>

                {/* Mutation label */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 10, color: MUTED }}>contains:</span>
                  <span style={{
                    fontSize: 10, color: '#aaff00',
                    background: 'rgba(170,255,0,0.08)',
                    border: '1px solid rgba(170,255,0,0.2)',
                    borderRadius: 6, padding: '2px 7px',
                  }}>
                    🧬 {MUTATION_LORE[tx.mutation_key] ?? tx.mutation_key}
                  </span>
                </div>

                {/* CTA */}
                {absorbed ? (
                  <p style={{ margin: 0, fontSize: 11, color: MUTED, fontStyle: 'italic' }}>
                    ✓ absorbed
                  </p>
                ) : (
                  <button
                    onClick={() => handleAbsorb(tx.id)}
                    disabled={absorbing}
                    style={{
                      padding: '11px 0',
                      background: absorbing ? 'rgba(0,245,255,0.06)' : 'linear-gradient(90deg, #7b00ff88, #00c8ff88)',
                      border: '1px solid rgba(0,245,255,0.35)',
                      borderRadius: 8, color: absorbing ? MUTED : '#e0e0ff',
                      fontSize: 13, fontWeight: 600, cursor: absorbing ? 'default' : 'pointer',
                      letterSpacing: '0.02em',
                    }}
                  >
                    {absorbing ? 'absorbing...' : '🧬 absorb into worm'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── SEND TAB ── */}
      {tab === 'send' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

          {scanState === 'sent' ? (
            /* Success state */
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              padding: 32, textAlign: 'center', gap: 16,
            }}>
              <div style={{ fontSize: 52 }}>📡</div>
              <p style={{ margin: 0, fontSize: 15, color: '#00f5ff', fontWeight: 700 }}>transmitted</p>
              <p style={{
                margin: 0, fontSize: 14, color: 'rgba(200,200,255,0.85)',
                fontStyle: 'italic', lineHeight: 1.6,
                borderLeft: '2px solid rgba(0,245,255,0.4)', paddingLeft: 12,
                textAlign: 'left', maxWidth: 280,
              }}>
                "{sentFragment}"
              </p>
              <p style={{ margin: 0, fontSize: 11, color: MUTED }}>+10 XP · fragment sent to #{sentToName}</p>
              <button
                onClick={() => setScanState('scanning')}
                style={{
                  marginTop: 8, padding: '12px 28px',
                  background: 'none', border: `1px solid ${BORDER}`,
                  borderRadius: 10, color: MUTED, fontSize: 13, cursor: 'pointer',
                }}
              >
                scan another
              </button>
            </div>

          ) : scanState === 'sending' ? (
            /* Transmitting spinner */
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 16,
            }}>
              <div style={{ fontSize: 40, animation: 'pulse 1s ease-in-out infinite' }}>📡</div>
              <p style={{ margin: 0, fontSize: 12, color: CYAN, fontFamily: "'Press Start 2P', monospace" }}>
                transmitting...
              </p>
            </div>

          ) : scanState === 'ratelimit' ? (
            /* Rate limit warning */
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32, textAlign: 'center',
            }}>
              <div style={{ fontSize: 40 }}>🚧</div>
              <p style={{ margin: 0, fontSize: 13, color: '#ffaa00', fontWeight: 600 }}>transmission limit reached</p>
              <p style={{ margin: 0, fontSize: 12, color: MUTED, lineHeight: 1.6 }}>
                You've already sent 3 fragments to this worm today.{' '}
                Find someone else to transmit to.
              </p>
            </div>

          ) : scanState === 'error' ? (
            /* Bad QR */
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 16,
            }}>
              <div style={{ fontSize: 40 }}>⚠️</div>
              <p style={{ margin: 0, fontSize: 12, color: '#ff0055' }}>invalid worm QR</p>
              <p style={{ margin: 0, fontSize: 11, color: MUTED }}>returning to scanner...</p>
            </div>

          ) : (
            /* Live scanner */
            <>
              <div style={{ padding: '12px 20px 8px' }}>
                <p style={{ margin: 0, fontSize: 11, color: MUTED, lineHeight: 1.6 }}>
                  Point your camera at another worm owner's QR code to transmit a thought fragment.
                  You must be in the same place.
                </p>
              </div>
              <QRScannerInline onDetected={handleScanned} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
