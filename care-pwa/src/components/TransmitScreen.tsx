import { useState, useEffect, useCallback } from 'react';
import { WormSVG } from './WormSVG';
import type { WormFriend, Transmission, AbsorbResult, WormColor } from '../types';
import { COLOR_MAP } from '../types';

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
  myStage: string;
  friends: WormFriend[];
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
  myToken, myName, myColor, myGenome,
  friends, onTransmit, onAbsorb, onClose,
}: TransmitScreenProps) {
  const [tab, setTab]             = useState<Tab>('inbox');
  const [inbox, setInbox]         = useState<Transmission[] | null>(null);
  const [unread, setUnread]       = useState(0);
  const [loading, setLoading]     = useState(false);

  // Send state
  const [selectedFriend, setSelectedFriend] = useState<WormFriend | null>(null);
  const [sendState, setSendState]   = useState<'idle' | 'sending' | 'sent' | 'error' | 'ratelimit'>('idle');
  const [sentFragment, setSentFragment] = useState('');

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

  // ── Send handler
  const handleSend = async () => {
    if (!selectedFriend) return;
    setSendState('sending');
    const result = await onTransmit(selectedFriend.token);
    if (!result) {
      // Check if rate limited
      setSendState('error');
      setTimeout(() => setSendState('idle'), 2500);
      return;
    }
    setSentFragment(result.fragment);
    setSendState('sent');
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
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* My worm */}
          <div style={{
            background: CARD_BG, border: `1px solid ${BORDER}`,
            borderRadius: 12, padding: 16,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <WormPortrait color={myColor} genome={myGenome} size={52} />
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: COLOR_MAP[myColor] }}>{myName}</p>
              <p style={{ margin: '3px 0 0', fontSize: 10, color: MUTED }}>transmitting from</p>
            </div>
          </div>

          {/* Friend picker */}
          <div>
            <p style={{ margin: '0 0 10px', fontSize: 11, color: MUTED, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              choose recipient
            </p>
            {friends.length === 0 ? (
              <div style={{
                background: CARD_BG, border: `1px solid ${BORDER}`,
                borderRadius: 12, padding: '24px 16px', textAlign: 'center',
              }}>
                <p style={{ margin: 0, fontSize: 13, color: MUTED }}>no worm connections yet</p>
                <p style={{ margin: '6px 0 0', fontSize: 11, color: 'rgba(150,150,200,0.35)' }}>
                  scan a friend's QR in the connections tab first
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {friends.map((f) => {
                  const wf = f as WormFriend & { name?: string; color?: WormColor };
                  const friendName  = wf.name  ?? f.token.slice(0, 8).toUpperCase();
                  const friendColor = wf.color ?? 'blue';
                  const selected    = selectedFriend?.token === f.token;

                  return (
                    <button
                      key={f.token}
                      onClick={() => { setSelectedFriend(f); setSendState('idle'); }}
                      style={{
                        background: selected ? 'rgba(0,245,255,0.08)' : CARD_BG,
                        border: `1px solid ${selected ? 'rgba(0,245,255,0.5)' : BORDER}`,
                        borderRadius: 10, padding: '12px 14px',
                        display: 'flex', alignItems: 'center', gap: 12,
                        cursor: 'pointer', textAlign: 'left',
                        boxShadow: selected ? '0 0 10px rgba(0,245,255,0.08)' : 'none',
                      }}
                    >
                      <WormPortrait color={friendColor} genome="" size={40} />
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: COLOR_MAP[friendColor] }}>
                          {friendName}
                        </p>
                        <p style={{ margin: '2px 0 0', fontSize: 10, color: MUTED }}>
                          met {f.meetCount}×
                        </p>
                      </div>
                      {selected && <span style={{ color: CYAN, fontSize: 16 }}>✓</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Transmission lore */}
          <div style={{
            background: 'rgba(120,0,255,0.07)',
            border: '1px solid rgba(120,0,255,0.25)',
            borderRadius: 12, padding: '14px 16px',
          }}>
            <p style={{ margin: '0 0 6px', fontSize: 11, color: 'rgba(200,180,255,0.7)', letterSpacing: '0.05em' }}>
              HOW IT WORKS
            </p>
            <p style={{ margin: 0, fontSize: 12, color: 'rgba(180,160,255,0.8)', lineHeight: 1.6 }}>
              A random thought fragment is drawn from the hive and sent to their worm. 
              When they absorb it, their worm mutates — a genome byte shifts, a trait evolves. 
              You earn +10 XP for transmitting. They earn +30 XP for absorbing.
            </p>
          </div>

          {/* Send button */}
          {sendState === 'sent' ? (
            <div style={{
              background: 'rgba(0,245,255,0.06)',
              border: '1px solid rgba(0,245,255,0.3)',
              borderRadius: 12, padding: 20, textAlign: 'center',
            }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>📡</div>
              <p style={{ margin: '0 0 6px', fontSize: 14, color: CYAN, fontWeight: 600 }}>transmitted</p>
              <p style={{ margin: '0 0 16px', fontSize: 13, color: 'rgba(200,200,255,0.8)', fontStyle: 'italic', lineHeight: 1.5 }}>
                "{sentFragment}"
              </p>
              <button
                onClick={() => { setSendState('idle'); setSelectedFriend(null); }}
                style={{
                  background: 'none', border: `1px solid ${BORDER}`,
                  borderRadius: 8, color: MUTED, fontSize: 12, cursor: 'pointer',
                  padding: '8px 20px',
                }}
              >
                send another
              </button>
            </div>
          ) : (
            <button
              onClick={handleSend}
              disabled={!selectedFriend || sendState === 'sending'}
              style={{
                padding: '16px 0',
                background: selectedFriend && sendState !== 'sending'
                  ? 'linear-gradient(90deg, #7b00ff, #00c8ff)'
                  : 'rgba(255,255,255,0.05)',
                border: 'none', borderRadius: 12,
                color: selectedFriend ? '#fff' : MUTED,
                fontSize: 15, fontWeight: 700, cursor: selectedFriend ? 'pointer' : 'default',
                letterSpacing: '0.03em',
                transition: 'all 0.2s',
              }}
            >
              {sendState === 'sending' ? 'transmitting...' :
               sendState === 'error'   ? '⚠ failed — try again' :
               selectedFriend          ? '📡 transmit thought fragment' :
               'select a worm to transmit to'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
