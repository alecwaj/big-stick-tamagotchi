import { useState } from 'react';

const STORAGE_KEY = 'airvana_onboarded';

interface OnboardingModalProps {
  wormName: string;
  onDone: () => void;
}

const steps = [
  {
    emoji: '🪱',
    title: 'A worm has chosen you',
    body: 'Someone at the studio just invited this worm into your mind. It\'s yours now. Forever.',
  },
  {
    emoji: '🍕',
    title: 'Feed it. Often.',
    body: 'Tap Feed to give it energy. Tap Cuddle to boost its mood. A hungry worm is a grumpy worm.',
  },
  {
    emoji: '🧬',
    title: 'Watch it evolve',
    body: 'HOST → ENTERING → CONSUMING → AIRVANA. The more you care for it, the deeper it goes.',
  },
  {
    emoji: '📲',
    title: 'Keep this page',
    body: 'Bookmark or add to your home screen. Your token is saved — you can always return to your worm.',
  },
];

export function OnboardingModal({ wormName, onDone }: OnboardingModalProps) {
  const [step, setStep] = useState(0);
  const [exiting, setExiting] = useState(false);

  const current = steps[step];
  const isLast = step === steps.length - 1;

  const handleNext = () => {
    if (isLast) {
      setExiting(true);
      setTimeout(() => {
        localStorage.setItem(STORAGE_KEY, '1');
        onDone();
      }, 300);
    } else {
      setStep((s) => s + 1);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 999,
        background: 'rgba(6,0,20,0.88)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
        opacity: exiting ? 0 : 1,
        transition: 'opacity 0.3s ease',
      }}
    >
      <div
        style={{
          background: 'linear-gradient(160deg, #12003a 0%, #1a0050 100%)',
          border: '1px solid rgba(0,245,255,0.4)',
          boxShadow: '0 0 40px rgba(0,245,255,0.15), 0 0 80px rgba(120,0,255,0.1)',
          borderRadius: 16,
          maxWidth: 340,
          width: '100%',
          padding: '36px 28px 28px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0,
          textAlign: 'center',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        {/* Worm name badge */}
        <div style={{
          fontSize: 10,
          color: 'rgba(0,245,255,0.6)',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          marginBottom: 24,
          fontFamily: "'Press Start 2P', monospace",
        }}>
          {wormName}
        </div>

        {/* Emoji */}
        <div style={{ fontSize: 52, marginBottom: 20, lineHeight: 1 }}>
          {current.emoji}
        </div>

        {/* Title */}
        <h2 style={{
          margin: '0 0 12px',
          fontSize: 17,
          fontWeight: 700,
          color: '#e0e0ff',
          lineHeight: 1.3,
        }}>
          {current.title}
        </h2>

        {/* Body */}
        <p style={{
          margin: '0 0 32px',
          fontSize: 14,
          color: 'rgba(180,180,230,0.8)',
          lineHeight: 1.6,
        }}>
          {current.body}
        </p>

        {/* Step dots */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
          {steps.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === step ? 20 : 6,
                height: 6,
                borderRadius: 3,
                background: i === step
                  ? '#00f5ff'
                  : i < step
                    ? 'rgba(0,245,255,0.35)'
                    : 'rgba(255,255,255,0.15)',
                transition: 'all 0.3s ease',
              }}
            />
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={handleNext}
          style={{
            width: '100%',
            padding: '14px 0',
            background: isLast
              ? 'linear-gradient(90deg, #7b00ff, #00c8ff)'
              : 'rgba(0,245,255,0.12)',
            border: isLast
              ? 'none'
              : '1px solid rgba(0,245,255,0.3)',
            borderRadius: 10,
            color: isLast ? '#fff' : '#00f5ff',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            letterSpacing: '0.03em',
            transition: 'all 0.2s ease',
          }}
        >
          {isLast ? '🪱 enter the hive' : 'next →'}
        </button>

        {/* Skip */}
        {!isLast && (
          <button
            onClick={() => { setExiting(true); setTimeout(() => { localStorage.setItem(STORAGE_KEY, '1'); onDone(); }, 300); }}
            style={{
              marginTop: 12,
              background: 'none',
              border: 'none',
              color: 'rgba(150,150,200,0.45)',
              fontSize: 11,
              cursor: 'pointer',
              padding: '4px 8px',
            }}
          >
            skip
          </button>
        )}
      </div>
    </div>
  );
}

/** Returns true if this is the user's first visit via QR (token was in the URL) */
export function shouldShowOnboarding(wasQRScan: boolean): boolean {
  if (!wasQRScan) return false;
  return !localStorage.getItem(STORAGE_KEY);
}
