import { useEffect, useRef } from 'react';
import { CreatorStudio } from './components/CreatorStudio';
import './App.css';

// ── Animated starfield ────────────────────────────────────────────
function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let animId: number;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const stars = Array.from({ length: 260 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      size: Math.random() * 1.6 + 0.3,
      baseOpacity: Math.random() * 0.7 + 0.2,
      twinkleSpeed: Math.random() * 0.03 + 0.005,
      twinkleOffset: Math.random() * Math.PI * 2,
      color: ['255,255,255', '200,180,255', '180,230,255'][Math.floor(Math.random() * 3)],
    }));

    let t = 0;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      t += 0.016;
      stars.forEach((star) => {
        const brightness = star.baseOpacity * (0.5 + 0.5 * Math.sin(t * star.twinkleSpeed * 60 + star.twinkleOffset));
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${star.color}, ${brightness})`;
        ctx.fill();
      });
      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }}
    />
  );
}

// ── Nebula blobs (CSS, behind content) ───────────────────────────
function Nebula() {
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', width: 600, height: 600,
        borderRadius: '50%', top: '-10%', left: '-5%',
        background: 'radial-gradient(circle, rgba(120,0,255,0.22) 0%, transparent 70%)',
        animation: 'nebulaShift 12s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute', width: 500, height: 500,
        borderRadius: '50%', bottom: '5%', right: '-8%',
        background: 'radial-gradient(circle, rgba(0,180,255,0.20) 0%, transparent 70%)',
        animation: 'nebulaShift 16s ease-in-out infinite reverse',
      }} />
      <div style={{
        position: 'absolute', width: 400, height: 400,
        borderRadius: '50%', top: '40%', left: '55%',
        background: 'radial-gradient(circle, rgba(255,0,150,0.15) 0%, transparent 70%)',
        animation: 'nebulaShift 20s ease-in-out infinite',
      }} />
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────
export default function App() {
  return (
    <div
      className="scanlines"
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(160deg, #0d0030 0%, #150040 50%, #0a001f 100%)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: '#e0e0ff',
        position: 'relative',
      }}
    >
      <Starfield />
      <Nebula />

      {/* All real content sits above the background layers */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <header
          style={{
            padding: '20px 40px',
            borderBottom: '1px solid rgba(0,245,255,0.45)',
            boxShadow: '0 1px 20px rgba(0,245,255,0.18)',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            background: 'rgba(6,0,15,0.7)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <span style={{ fontSize: 26 }}>🪱</span>
          <div>
            <h1
              className="pixel"
              style={{ margin: 0, fontSize: 14, color: '#00f5ff', textShadow: '0 0 10px #00f5ff, 0 0 20px rgba(0,245,255,0.5)', letterSpacing: '0.04em' }}
            >
              Airvana Studio
            </h1>
            <p style={{ margin: '5px 0 0 0', fontSize: 12, color: 'rgba(200,200,255,0.85)' }}>
              Find your forever worm for those pesky thoughts
            </p>
            <p style={{ margin: '3px 0 0 0', fontSize: 10, color: 'rgba(150,150,200,0.55)', fontStyle: 'italic' }}>
              The worm chooses you · the worm chooses you · the worm chooses you
            </p>
          </div>
        </header>

        <main style={{ maxWidth: 940, margin: '0 auto', padding: '48px 40px' }}>
          <CreatorStudio />
        </main>
      </div>
    </div>
  );
}
