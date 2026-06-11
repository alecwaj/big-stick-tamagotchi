/**
 * WormSVG — genome-driven, stage-aware worm renderer.
 *
 * Every visual property (body shape, eye style, tail, markings, nubs, mouth,
 * cheeks, glow intensity) is decoded from the 32-char hex genome string.
 * The stage (egg | baby | adult | elder) controls how much of the genome
 * is expressed — a baby shows minimal traits, an elder shows all of them.
 *
 * This file is intentionally self-contained (no external deps beyond types)
 * so it can be copied verbatim into both apps.
 */

import { COLOR_MAP, GLOW_MAP, type WormColor, type WormHat, type WormShades, type WormStage } from '../types';

// ── Genome decode (inline copy — keeps the file self-contained) ──────────────

type BodyShape     = 'round' | 'tapered' | 'lumpy' | 'ribbed';
type EyeStyle      = 'beady' | 'wide' | 'sleepy' | 'compound' | 'hearts';
type TailType      = 'flat' | 'pointed' | 'frilly' | 'club' | 'split';
type MarkingType   = 'none' | 'stripes' | 'spots' | 'rings' | 'gradient' | 'zigzag';
type MarkingColor  = 'complement' | 'dark' | 'bright' | 'metallic' | 'glow';
type NubStyle      = 'none' | 'tiny' | 'wavy' | 'spiky' | 'leafy';
type CheekStyle    = 'none' | 'rosy' | 'freckles' | 'star';
type MouthStyle    = 'smile' | 'smirk' | 'ooh' | 'beam' | 'fangs';
type GlowIntensity = 'low' | 'medium' | 'high' | 'pulse';
type PupilStyle    = 'dot' | 'oval' | 'cross' | 'star' | 'heart';

interface Genome {
  segmentCount:  number;
  bodyShape:     BodyShape;
  eyeStyle:      EyeStyle;
  tailType:      TailType;
  markingType:   MarkingType;
  markingColor:  MarkingColor;
  nubStyle:      NubStyle;
  cheekStyle:    CheekStyle;
  mouthStyle:    MouthStyle;
  glowIntensity: GlowIntensity;
  pupilStyle:    PupilStyle;
}

function pick<T>(arr: T[], byte: number): T { return arr[byte % arr.length]; }
function hexByte(g: string, i: number): number { return parseInt(g.slice(i * 2, i * 2 + 2) || '00', 16); }

function decodeGenome(raw: string): Genome {
  const g = (raw || '').padEnd(32, '0').slice(0, 32);
  return {
    segmentCount: 3 + (hexByte(g, 0) % 7),
    bodyShape:    pick<BodyShape>    (['round','tapered','lumpy','ribbed'],          hexByte(g, 1)),
    eyeStyle:     pick<EyeStyle>     (['beady','wide','sleepy','compound','hearts'], hexByte(g, 2)),
    tailType:     pick<TailType>     (['flat','pointed','frilly','club','split'],    hexByte(g, 3)),
    markingType:  pick<MarkingType>  (['none','stripes','spots','rings','gradient','zigzag'], hexByte(g, 4)),
    markingColor: pick<MarkingColor> (['complement','dark','bright','metallic','glow'],      hexByte(g, 5)),
    nubStyle:     pick<NubStyle>     (['none','tiny','wavy','spiky','leafy'],        hexByte(g, 6)),
    cheekStyle:   pick<CheekStyle>   (['none','rosy','freckles','star'],             hexByte(g, 7)),
    mouthStyle:   pick<MouthStyle>   (['smile','smirk','ooh','beam','fangs'],        hexByte(g, 8)),
    glowIntensity:pick<GlowIntensity>(['low','medium','high','pulse'],               hexByte(g, 9)),
    pupilStyle:   pick<PupilStyle>   (['dot','oval','cross','star','heart'],         hexByte(g, 11)),
  };
}

function visibleSegments(g: Genome, stage: WormStage): number {
  if (stage === 'egg')   return 0;
  if (stage === 'baby')  return 2;
  if (stage === 'adult') return Math.max(4, Math.floor(g.segmentCount * 0.65));
  return g.segmentCount;
}

// ── Marking color resolver ─────────────────────────────────────────────────

function resolveMarkingColor(baseHex: string, mc: MarkingColor): string {
  // Simple heuristic — we work in hex directly
  try {
    const r = parseInt(baseHex.slice(1, 3), 16);
    const g = parseInt(baseHex.slice(3, 5), 16);
    const b = parseInt(baseHex.slice(5, 7), 16);
    switch (mc) {
      case 'dark':         return `rgba(${Math.round(r*0.4)},${Math.round(g*0.4)},${Math.round(b*0.4)},0.7)`;
      case 'bright':       return `rgba(255,255,255,0.35)`;
      case 'metallic':     return `rgba(180,180,200,0.55)`;
      case 'glow':         return `rgba(${r},${g},${b},0.5)`;
      case 'complement':
      default:             return `rgba(${255-r},${255-g},${255-b},0.45)`;
    }
  } catch {
    return 'rgba(255,255,255,0.3)';
  }
}

// ── Hat layer (unchanged from original) ────────────────────────────────────

function HatLayer({ hat, cx }: { hat: WormHat; cx: number }) {
  if (hat === 'none') return null;
  const y = 38;

  if (hat === 'fedora') return (
    <g>
      <ellipse cx={cx} cy={y} rx={26} ry={5} fill="#5a3518" />
      <path d={`M${cx-14},${y} C${cx-16},${y-7} ${cx-11},${y-20} ${cx},${y-22} C${cx+11},${y-20} ${cx+16},${y-7} ${cx+14},${y} Z`} fill="#7a4a28" />
      <path d={`M${cx-4},${y-22} Q${cx},${y-17} ${cx+4},${y-22}`} stroke="#5a3518" strokeWidth={1.5} fill="none" />
      <path d={`M${cx-13},${y-6} C${cx-15},${y-4} ${cx+15},${y-4} ${cx+13},${y-6}`} stroke="#c9a030" strokeWidth={3} fill="none" strokeLinecap="round" />
    </g>
  );
  if (hat === 'panama') return (
    <g>
      <ellipse cx={cx} cy={y} rx={27} ry={5} fill="#b89a50" />
      <path d={`M${cx-13},${y} C${cx-15},${y-7} ${cx-10},${y-19} ${cx},${y-21} C${cx+10},${y-19} ${cx+15},${y-7} ${cx+13},${y} Z`} fill="#e8d5a3" />
      {[y-6,y-11,y-16].map((ly,i) => <line key={i} x1={cx-10+i} y1={ly} x2={cx+10-i} y2={ly} stroke="#c9a96e" strokeWidth={0.8}/>)}
      <path d={`M${cx-13},${y-5} C${cx-15},${y-3} ${cx+15},${y-3} ${cx+13},${y-5}`} stroke="#3a6b3a" strokeWidth={3} fill="none" strokeLinecap="round" />
    </g>
  );
  if (hat === 'bowler') return (
    <g>
      <ellipse cx={cx} cy={y} rx={22} ry={4} fill="#111" />
      <ellipse cx={cx} cy={y-14} rx={16} ry={15} fill="#1e1e1e" />
      <ellipse cx={cx-4} cy={y-22} rx={5} ry={3} fill="rgba(255,255,255,0.06)" />
    </g>
  );
  if (hat === 'trilby') return (
    <g>
      <ellipse cx={cx} cy={y} rx={22} ry={4} fill="#2c1a10" />
      <ellipse cx={cx} cy={y-1} rx={18} ry={3} fill="#3d2518" />
      <path d={`M${cx-12},${y} C${cx-13},${y-6} ${cx-10},${y-16} ${cx},${y-18} C${cx+10},${y-16} ${cx+13},${y-6} ${cx+12},${y} Z`} fill="#3d2518" />
      <path d={`M${cx-11},${y-5} C${cx-13},${y-3} ${cx+13},${y-3} ${cx+11},${y-5}`} stroke="#b8860b" strokeWidth={2.5} fill="none" strokeLinecap="round" />
    </g>
  );
  if (hat === 'akubra') return (
    <g>
      <ellipse cx={cx} cy={y} rx={30} ry={5} fill="#7a5230" />
      <path d={`M${cx-14},${y} C${cx-16},${y-6} ${cx-11},${y-21} ${cx},${y-23} C${cx+11},${y-21} ${cx+16},${y-6} ${cx+14},${y} Z`} fill="#8b6040" />
      <line x1={cx} y1={y} x2={cx} y2={y-23} stroke="#6b4a28" strokeWidth={1.5} />
      <path d={`M${cx-14},${y-5} C${cx-16},${y-3} ${cx+16},${y-3} ${cx+14},${y-5}`} stroke="#3a2010" strokeWidth={2.5} fill="none" strokeLinecap="round" />
    </g>
  );
  if (hat === 'bucket') return (
    <g>
      <ellipse cx={cx} cy={y+3} rx={25} ry={5} fill="#3a6b3a" />
      <rect x={cx-14} y={y-18} width={28} height={21} rx={5} fill="#4a8050" />
      <ellipse cx={cx} cy={y-18} rx={14} ry={4} fill="#4a8050" />
      <circle cx={cx-5} cy={y-8} r={1.5} fill="rgba(0,0,0,0.25)" />
      <circle cx={cx+5} cy={y-8} r={1.5} fill="rgba(0,0,0,0.25)" />
    </g>
  );
  if (hat === 'baseball') return (
    <g>
      <path d={`M${cx-16},${y} C${cx-18},${y-10} ${cx-14},${y-21} ${cx},${y-23} C${cx+14},${y-21} ${cx+18},${y-10} ${cx+16},${y} Z`} fill="#1e3a5f" />
      <path d={`M${cx-12},${y} Q${cx+4},${y+5} ${cx+24},${y-1} Q${cx+26},${y-5} ${cx+16},${y} Z`} fill="#163058" />
      <circle cx={cx} cy={y-23} r={2} fill="#163058" />
    </g>
  );
  if (hat === 'newsboy') return (
    <g>
      <path d={`M${cx-13},${y} Q${cx+2},${y+5} ${cx+22},${y-1} Q${cx+24},${y-4} ${cx+14},${y} Z`} fill="#5c4a2a" />
      <ellipse cx={cx-2} cy={y-14} rx={18} ry={13} fill="#6b5534" />
      {[[-2,y-2,-2,y-28],[-2,y-2,-18,y-16],[-2,y-2,14,y-18]].map(([x1,y1,x2,y2],i) => (
        <line key={i} x1={x1+cx} y1={y1} x2={x2+cx} y2={y2} stroke="rgba(0,0,0,0.18)" strokeWidth={1}/>
      ))}
      <circle cx={cx-2} cy={y-26} r={2} fill="#5c4a2a" />
    </g>
  );
  if (hat === 'beanie') return (
    <g>
      <ellipse cx={cx} cy={y-12} rx={20} ry={14} fill="#ef4444" />
      <rect x={cx-20} y={y-4} width={40} height={8} rx={4} fill="#dc2626" />
      {[-14,-9,-4,1,6,11,16].map((dx) => (
        <line key={dx} x1={cx+dx} y1={y-4} x2={cx+dx} y2={y+4} stroke="rgba(0,0,0,0.15)" strokeWidth={1}/>
      ))}
      <circle cx={cx} cy={y-24} r={4} fill="#fca5a5" />
    </g>
  );
  if (hat === 'cowboy') return (
    <g>
      <ellipse cx={cx} cy={y-6} rx={28} ry={5} fill="#7a3c08" />
      <path d={`M${cx-14},${y-6} Q${cx},${y-34} ${cx+14},${y-6}`} fill="#92400e" />
      <path d={`M${cx-12},${y-10} Q${cx},${y-11} ${cx+12},${y-10}`} stroke="#5a2800" strokeWidth={2} fill="none" />
    </g>
  );
  if (hat === 'boater') return (
    <g>
      <ellipse cx={cx} cy={y} rx={24} ry={4} fill="#b89a50" />
      <rect x={cx-13} y={y-18} width={26} height={18} fill="#e8d5a3" />
      <ellipse cx={cx} cy={y-18} rx={13} ry={4} fill="#ddc88a" />
      <rect x={cx-13} y={y-9} width={26} height={4} fill="#1e3a5f" />
    </g>
  );
  if (hat === 'homburg') return (
    <g>
      <ellipse cx={cx} cy={y} rx={24} ry={5} fill="#2a2a2a" />
      <ellipse cx={cx} cy={y-1} rx={19} ry={3} fill="#1a1a1a" />
      <path d={`M${cx-14},${y} C${cx-16},${y-7} ${cx-11},${y-22} ${cx},${y-24} C${cx+11},${y-22} ${cx+16},${y-7} ${cx+14},${y} Z`} fill="#222" />
      <path d={`M${cx-3},${y-24} Q${cx},${y-19} ${cx+3},${y-24}`} stroke="rgba(255,255,255,0.12)" strokeWidth={1.5} fill="none" />
    </g>
  );
  if (hat === 'beret') return (
    <g>
      <ellipse cx={cx+5} cy={y-11} rx={20} ry={11} fill="#cc2200" transform={`rotate(-8,${cx+5},${y-11})`} />
      <ellipse cx={cx} cy={y-2} rx={13} ry={3} fill="#991a00" />
      <circle cx={cx+12} cy={y-19} r={2} fill="#991a00" />
    </g>
  );
  if (hat === 'snapback') return (
    <g>
      <path d={`M${cx-16},${y} C${cx-18},${y-10} ${cx-14},${y-21} ${cx},${y-23} C${cx+14},${y-21} ${cx+18},${y-10} ${cx+16},${y} Z`} fill="#111" />
      <rect x={cx-16} y={y-3} width={36} height={5} rx={1} fill="#0a0a0a" />
      <text x={cx} y={y-10} textAnchor="middle" fontSize={8} fill="#ff00cc" fontFamily="sans-serif">★</text>
    </g>
  );
  if (hat === 'tophat') return (
    <g>
      <rect x={cx-18} y={y-30} width={36} height={24} rx={2} fill="#1a1a1a" />
      <rect x={cx-22} y={y-8} width={44} height={6} rx={3} fill="#111" />
      <ellipse cx={cx-4} cy={y-26} rx={4} ry={2.5} fill="rgba(255,255,255,0.05)" />
    </g>
  );
  return null;
}

// ── Shades layer ────────────────────────────────────────────────────────────

function ShadesLayer({ shades, cx, cy }: { shades: WormShades; cx: number; cy: number }) {
  if (shades === 'none') return null;
  if (shades === 'round') return (
    <g>
      <circle cx={cx-10} cy={cy} r={7} fill="#1a1a1a" opacity={0.85} />
      <circle cx={cx+10} cy={cy} r={7} fill="#1a1a1a" opacity={0.85} />
      <line x1={cx-3} y1={cy} x2={cx+3} y2={cy} stroke="#1a1a1a" strokeWidth={2} />
      <line x1={cx-17} y1={cy} x2={cx-22} y2={cy-2} stroke="#1a1a1a" strokeWidth={2} />
      <line x1={cx+17} y1={cy} x2={cx+22} y2={cy-2} stroke="#1a1a1a" strokeWidth={2} />
    </g>
  );
  if (shades === 'star') {
    const star = (x: number, y: number) => {
      const pts = [];
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? 7 : 3.5;
        const angle = (i * Math.PI * 2) / 10 - Math.PI / 2;
        pts.push(`${x + r * Math.cos(angle)},${y + r * Math.sin(angle)}`);
      }
      return pts.join(' ');
    };
    return (
      <g>
        <polygon points={star(cx-10, cy)} fill="#fbbf24" opacity={0.9} />
        <polygon points={star(cx+10, cy)} fill="#fbbf24" opacity={0.9} />
        <line x1={cx-3} y1={cy} x2={cx+3} y2={cy} stroke="#92400e" strokeWidth={2} />
      </g>
    );
  }
  if (shades === 'heart') {
    const heart = (x: number, y: number) =>
      `M${x},${y+2} C${x},${y-2} ${x-6},${y-6} ${x-6},${y} C${x-6},${y+5} ${x},${y+8} ${x},${y+8} C${x},${y+8} ${x+6},${y+5} ${x+6},${y} C${x+6},${y-6} ${x},${y-2} ${x},${y+2}Z`;
    return (
      <g>
        <path d={heart(cx-10, cy-2)} fill="#f43f5e" opacity={0.9} />
        <path d={heart(cx+10, cy-2)} fill="#f43f5e" opacity={0.9} />
        <line x1={cx-3} y1={cy} x2={cx+3} y2={cy} stroke="#9f1239" strokeWidth={2} />
      </g>
    );
  }
  if (shades === 'visor') return (
    <g>
      <rect x={cx-22} y={cy-5} width={44} height={10} rx={5} fill="#06b6d4" opacity={0.7} />
      <line x1={cx-22} y1={cy-5} x2={cx-28} y2={cy-3} stroke="#0e7490" strokeWidth={2} />
      <line x1={cx+22} y1={cy-5} x2={cx+28} y2={cy-3} stroke="#0e7490" strokeWidth={2} />
    </g>
  );
  if (shades === 'sunglasses2') return (
    <g>
      <rect x={cx-22} y={cy-6} width={19} height={12} rx={3} fill="#0a0a0a" opacity={0.92} />
      <rect x={cx+3}  y={cy-6} width={19} height={12} rx={3} fill="#0a0a0a" opacity={0.92} />
      <line x1={cx-3} y1={cy} x2={cx+3} y2={cy} stroke="#0a0a0a" strokeWidth={2} />
      <line x1={cx-22} y1={cy} x2={cx-28} y2={cy-2} stroke="#0a0a0a" strokeWidth={2} />
      <line x1={cx+22} y1={cy} x2={cx+28} y2={cy-2} stroke="#0a0a0a" strokeWidth={2} />
    </g>
  );
  return null;
}

// ── Eye renderer ────────────────────────────────────────────────────────────

function Eyes({ eyeStyle, pupilStyle, cx, cy, bodyColor, animated }: {
  eyeStyle: EyeStyle; pupilStyle: PupilStyle;
  cx: number; cy: number; bodyColor: string; animated: boolean;
}) {

  const pupil = (ex: number, ey: number) => {
    if (pupilStyle === 'cross') return (
      <g>
        <line x1={ex-3} y1={ey} x2={ex+3} y2={ey} stroke="white" strokeWidth={2} strokeLinecap="round"/>
        <line x1={ex} y1={ey-3} x2={ex} y2={ey+3} stroke="white" strokeWidth={2} strokeLinecap="round"/>
      </g>
    );
    if (pupilStyle === 'star') return <text x={ex} y={ey+2} textAnchor="middle" fontSize={6} fill="white">★</text>;
    if (pupilStyle === 'heart') return <text x={ex} y={ey+2} textAnchor="middle" fontSize={5} fill="#f43f5e">♥</text>;
    if (pupilStyle === 'oval') return <ellipse cx={ex} cy={ey} rx={2} ry={3.5} fill="white" />;
    // dot (default)
    return <circle cx={ex+1} cy={ey-1} r={1.5} fill="white" />;
  };

  if (eyeStyle === 'beady') return (
    <g className="worm-eye" style={{ transformOrigin: `${cx}px ${cy}px` }}>
      <circle cx={cx-10} cy={cy} r={5} fill="#1a1a1a" />
      <circle cx={cx+10} cy={cy} r={5} fill="#1a1a1a" />
      {pupil(cx-10, cy)}
      {pupil(cx+10, cy)}
    </g>
  );
  if (eyeStyle === 'sleepy') return (
    <g style={{ ...(animated ? { animation: 'blink 3s ease-in-out infinite' } : {}) }}>
      <circle cx={cx-10} cy={cy} r={9} fill="white" />
      <circle cx={cx+10} cy={cy} r={9} fill="white" />
      <circle cx={cx-9}  cy={cy+1} r={5} fill="#1a1a1a" />
      <circle cx={cx+11} cy={cy+1} r={5} fill="#1a1a1a" />
      {pupil(cx-9, cy+1)}
      {pupil(cx+11, cy+1)}
      {/* half-closed eyelid */}
      <path d={`M${cx-19},${cy} Q${cx-10},${cy-6} ${cx-1},${cy}`} fill={bodyColor} />
      <path d={`M${cx+1},${cy} Q${cx+10},${cy-6} ${cx+19},${cy}`} fill={bodyColor} />
    </g>
  );
  if (eyeStyle === 'compound') return (
    <g>
      {/* compound = multiple facets */}
      {[-12,-4,4,12].map((dx, i) => (
        <circle key={i} cx={cx+dx} cy={i%2===0 ? cy : cy+3} r={4} fill="#1a1a1a" />
      ))}
      {[-12,-4,4,12].map((dx, i) => (
        <circle key={`s${i}`} cx={cx+dx+1} cy={(i%2===0 ? cy : cy+3)-1} r={1} fill="rgba(255,255,255,0.6)" />
      ))}
    </g>
  );
  if (eyeStyle === 'hearts') return (
    <g>
      <text x={cx-10} y={cy+4} textAnchor="middle" fontSize={14} fill="#f43f5e">♥</text>
      <text x={cx+10} y={cy+4} textAnchor="middle" fontSize={14} fill="#f43f5e">♥</text>
    </g>
  );
  // wide (default)
  return (
    <g className="worm-eye" style={{ transformOrigin: `${cx}px ${cy}px` }}>
      <circle cx={cx-12} cy={cy} r={9} fill="white" />
      <circle cx={cx+12} cy={cy} r={9} fill="white" />
      <circle cx={cx-10} cy={cy} r={5} fill="#1a1a1a" />
      <circle cx={cx+14} cy={cy} r={5} fill="#1a1a1a" />
      {pupil(cx-10, cy)}
      {pupil(cx+14, cy)}
    </g>
  );
}

// ── Mouth renderer ──────────────────────────────────────────────────────────

function Mouth({ style, cx, cy }: { style: MouthStyle; cx: number; cy: number }) {
  if (style === 'smile') return (
    <path d={`M${cx-10},${cy} Q${cx},${cy+10} ${cx+10},${cy}`} stroke="#1a1a1a" strokeWidth={2.5} fill="none" strokeLinecap="round"/>
  );
  if (style === 'smirk') return (
    <path d={`M${cx-8},${cy+2} Q${cx+2},${cy-2} ${cx+10},${cy}`} stroke="#1a1a1a" strokeWidth={2.5} fill="none" strokeLinecap="round"/>
  );
  if (style === 'ooh') return (
    <ellipse cx={cx} cy={cy+3} rx={6} ry={7} fill="#1a1a1a" />
  );
  if (style === 'beam') return (
    <>
      <path d={`M${cx-12},${cy} Q${cx},${cy+14} ${cx+12},${cy}`} stroke="#1a1a1a" strokeWidth={2.5} fill="none" strokeLinecap="round"/>
      <line x1={cx-12} y1={cy} x2={cx+12} y2={cy} stroke="#1a1a1a" strokeWidth={2} />
    </>
  );
  if (style === 'fangs') return (
    <g>
      <path d={`M${cx-10},${cy} Q${cx},${cy+8} ${cx+10},${cy}`} stroke="#1a1a1a" strokeWidth={2} fill="none" strokeLinecap="round"/>
      <polygon points={`${cx-5},${cy} ${cx-2},${cy+8} ${cx+1},${cy}`} fill="white" />
      <polygon points={`${cx+5},${cy} ${cx+2},${cy+8} ${cx-1},${cy}`} fill="white" />
    </g>
  );
  return null;
}

// ── Cheeks ──────────────────────────────────────────────────────────────────

function Cheeks({ style, cx, cy, bodyColor }: { style: CheekStyle; cx: number; cy: number; bodyColor: string }) {
  if (style === 'none') return null;
  if (style === 'rosy') return (
    <>
      <ellipse cx={cx-20} cy={cy} rx={7} ry={4} fill="#ff6699" opacity={0.4} />
      <ellipse cx={cx+20} cy={cy} rx={7} ry={4} fill="#ff6699" opacity={0.4} />
    </>
  );
  if (style === 'freckles') return (
    <>
      {[-22,-19,-16].map((dx) => <circle key={dx} cx={cx+dx} cy={cy} r={1.5} fill="#8b4513" opacity={0.6}/>)}
      {[16,19,22].map((dx)     => <circle key={dx} cx={cx+dx} cy={cy} r={1.5} fill="#8b4513" opacity={0.6}/>)}
    </>
  );
  if (style === 'star') return (
    <>
      <text x={cx-20} y={cy+3} textAnchor="middle" fontSize={8} fill="#fbbf24" opacity={0.85}>✦</text>
      <text x={cx+20} y={cy+3} textAnchor="middle" fontSize={8} fill="#fbbf24" opacity={0.85}>✦</text>
    </>
  );
  // default subtle glow cheeks
  return (
    <>
      <ellipse cx={cx-20} cy={cy} rx={7} ry={4} fill={bodyColor} opacity={0.6} />
      <ellipse cx={cx+20} cy={cy} rx={7} ry={4} fill={bodyColor} opacity={0.6} />
    </>
  );
}

// ── Nubs (tiny limbs / antennae, adult/elder only) ──────────────────────────

function Nubs({ style, cx, cy, bodyColor }: { style: NubStyle; cx: number; cy: number; bodyColor: string }) {
  if (style === 'none') return null;
  if (style === 'tiny') return (
    <>
      <ellipse cx={cx-36} cy={cy+5} rx={8} ry={5} fill={bodyColor} />
      <ellipse cx={cx+36} cy={cy+5} rx={8} ry={5} fill={bodyColor} />
    </>
  );
  if (style === 'wavy') return (
    <>
      <path d={`M${cx-26},${cy+5} C${cx-34},${cy-2} ${cx-42},${cy+8} ${cx-48},${cy+2}`} stroke={bodyColor} strokeWidth={4} fill="none" strokeLinecap="round"/>
      <path d={`M${cx+26},${cy+5} C${cx+34},${cy-2} ${cx+42},${cy+8} ${cx+48},${cy+2}`} stroke={bodyColor} strokeWidth={4} fill="none" strokeLinecap="round"/>
    </>
  );
  if (style === 'spiky') return (
    <>
      <polygon points={`${cx-26},${cy} ${cx-40},${cy-8} ${cx-38},${cy+5}`} fill={bodyColor} />
      <polygon points={`${cx+26},${cy} ${cx+40},${cy-8} ${cx+38},${cy+5}`} fill={bodyColor} />
    </>
  );
  if (style === 'leafy') return (
    <>
      <ellipse cx={cx-36} cy={cy} rx={10} ry={5} fill="#3a6b3a" transform={`rotate(-20,${cx-36},${cy})`} />
      <ellipse cx={cx+36} cy={cy} rx={10} ry={5} fill="#3a6b3a" transform={`rotate(20,${cx+36},${cy})`} />
    </>
  );
  return null;
}

// ── Segment markings ────────────────────────────────────────────────────────

function SegmentMarkings({ type, mColor, cx, segY, rx, ry }: {
  type: MarkingType; mColor: string; cx: number; segY: number; rx: number; ry: number;
}) {
  if (type === 'none') return null;
  if (type === 'stripes') return (
    <>
      <line x1={cx-rx+4} y1={segY-ry/2} x2={cx+rx-4} y2={segY-ry/2} stroke={mColor} strokeWidth={2} />
      <line x1={cx-rx+4} y1={segY+ry/2} x2={cx+rx-4} y2={segY+ry/2} stroke={mColor} strokeWidth={2} />
    </>
  );
  if (type === 'spots') return (
    <>
      <circle cx={cx-rx/2} cy={segY} r={3} fill={mColor} />
      <circle cx={cx+rx/2} cy={segY} r={3} fill={mColor} />
    </>
  );
  if (type === 'rings') return (
    <ellipse cx={cx} cy={segY} rx={rx-4} ry={ry-2} fill="none" stroke={mColor} strokeWidth={2} />
  );
  if (type === 'gradient') return (
    <ellipse cx={cx} cy={segY} rx={rx} ry={ry} fill={mColor} opacity={0.25} />
  );
  if (type === 'zigzag') {
    const pts = [];
    for (let x = cx - rx + 4; x <= cx + rx - 4; x += 6) {
      pts.push(`${x},${segY + (pts.length % 2 === 0 ? -3 : 3)}`);
    }
    return <polyline points={pts.join(' ')} stroke={mColor} strokeWidth={1.5} fill="none" />;
  }
  return null;
}

// ── Tail renderer ────────────────────────────────────────────────────────────

function Tail({ type, cx, baseY, bodyColor }: { type: TailType; cx: number; baseY: number; bodyColor: string }) {
  if (type === 'flat') return <ellipse cx={cx} cy={baseY+10} rx={10} ry={6} fill={bodyColor} />;
  if (type === 'pointed') return <polygon points={`${cx-8},${baseY} ${cx+8},${baseY} ${cx},${baseY+20}`} fill={bodyColor} />;
  if (type === 'frilly') return (
    <>
      {[-12,-6,0,6,12].map((dx) => (
        <ellipse key={dx} cx={cx+dx} cy={baseY+8} rx={5} ry={7} fill={bodyColor} opacity={0.85} />
      ))}
    </>
  );
  if (type === 'club') return (
    <>
      <rect x={cx-4} y={baseY} width={8} height={12} rx={2} fill={bodyColor} />
      <ellipse cx={cx} cy={baseY+18} rx={10} ry={8} fill={bodyColor} />
    </>
  );
  if (type === 'split') return (
    <>
      <ellipse cx={cx-10} cy={baseY+10} rx={8} ry={5} fill={bodyColor} transform={`rotate(-15,${cx-10},${baseY+10})`} />
      <ellipse cx={cx+10} cy={baseY+10} rx={8} ry={5} fill={bodyColor} transform={`rotate(15,${cx+10},${baseY+10})`} />
    </>
  );
  return null;
}

// ── Egg renderer ────────────────────────────────────────────────────────────

function EggRenderer({ bodyColor, glowColor: _glowColor, hatched, animated, uidPrefix }: {
  bodyColor: string; glowColor: string; hatched: boolean; animated: boolean; uidPrefix: string;
}) {
  const cx = 100;
  const cy = 115;
  return (
    <g>
      <defs>
        <radialGradient id={`${uidPrefix}eggGrad`} cx="35%" cy="25%" r="60%">
          <stop offset="0%" stopColor="white" stopOpacity="0.5" />
          <stop offset="100%" stopColor={bodyColor} stopOpacity="0" />
        </radialGradient>
        {animated && (
          <style>{`
            @keyframes eggBob {
              0%,100% { transform: translateY(0px) rotate(-2deg); }
              50%      { transform: translateY(-6px) rotate(2deg); }
            }
            @keyframes crackFlash {
              0%,90%  { opacity: 0; }
              95%,100% { opacity: 1; }
            }
            .egg-group { transform-origin: ${cx}px ${cy}px; animation: eggBob 2.5s ease-in-out infinite; }
          `}</style>
        )}
      </defs>
      <g className={animated ? 'egg-group' : ''}>
        {/* egg body */}
        <ellipse cx={cx} cy={cy} rx={38} ry={48} fill={bodyColor} />
        <ellipse cx={cx} cy={cy} rx={38} ry={48} fill={`url(#${uidPrefix}eggGrad)`} />
        {/* spots pattern on egg */}
        {[[-14,-18],[14,-10],[-6,8],[16,12],[-18,2]].map(([dx,dy],i) => (
          <circle key={i} cx={cx+dx} cy={cy+dy} r={4} fill="rgba(255,255,255,0.12)" />
        ))}
        {/* crack lines — visible once worm is hatching */}
        {hatched && (
          <g style={{ animation: animated ? 'crackFlash 0.5s steps(1) forwards' : undefined }}>
            <path d={`M${cx},${cy-20} L${cx+8},${cy-8} L${cx-4},${cy+4} L${cx+6},${cy+18}`}
              stroke="rgba(0,0,0,0.5)" strokeWidth={2.5} fill="none" strokeLinecap="round"/>
            <path d={`M${cx-10},${cy-10} L${cx-4},${cy+2} L${cx+2},${cy-4}`}
              stroke="rgba(0,0,0,0.4)" strokeWidth={1.5} fill="none" strokeLinecap="round"/>
          </g>
        )}
        {/* question mark — "mystery inside" */}
        <text x={cx} y={cy+10} textAnchor="middle" fontSize={36} fill="rgba(255,255,255,0.2)" fontFamily="sans-serif">?</text>
      </g>
    </g>
  );
}

// ── Main WormSVG component ──────────────────────────────────────────────────

export interface WormSVGProps {
  color: WormColor;
  hat: WormHat;
  shades: WormShades;
  stage?: WormStage;
  genome?: string;
  hatched?: boolean;       // true = show cracks on egg, triggers hatch anim
  expression?: 'happy' | 'neutral' | 'sad' | 'sick';
  animated?: boolean;
  size?: number;
  instanceId?: string;    // namespace SVG gradient IDs when multiple instances rendered
}

export function WormSVG({
  color,
  hat,
  shades,
  stage = 'baby',
  genome = '',
  hatched = false,
  expression = 'happy',
  animated = true,
  size = 200,
  instanceId = '',
}: WormSVGProps) {
  const bodyColor = COLOR_MAP[color];
  const glowColor = GLOW_MAP[color];
  // Unique prefix for SVG gradient IDs — prevents collisions when multiple
  // WormSVG instances render simultaneously (e.g. creator + friends list)
  const uidPrefix = instanceId ? `${instanceId}-` : `${color}-`;
  const cx = 100;

  const g = decodeGenome(genome);

  // Glow filter intensity
  const glowBlur   = g.glowIntensity === 'low' ? 8 : g.glowIntensity === 'high' ? 22 : 14;
  const glowFilter = `drop-shadow(0 0 ${glowBlur}px ${glowColor}) drop-shadow(0 0 ${Math.round(glowBlur*2.5)}px ${glowColor.replace('0.7','0.25')})`;

  const markingCol = resolveMarkingColor(bodyColor, g.markingColor);
  const segsVisible = visibleSegments(g, stage);

  // ── Build body segments ────────────────────────────────────────────────

  // Segment definitions: each has [cy, rx, ry]
  // We always use a fixed 9-slot layout and slice to segsVisible
  const allSegments: [number, number, number][] = [
    [170, 10,  7],
    [158, 13,  9],
    [145, 17, 11],
    [132, 19, 13],
    [119, 21, 14],
    [106, 22, 14],
    [93,  21, 13],
    [80,  20, 13],
    [67,  18, 12],
  ];

  // Adjust shapes for bodyShape genome
  const shapeOffset = (i: number, base: number): number => {
    if (g.bodyShape === 'lumpy')   return base + (i % 2 === 0 ? 2 : -2);
    if (g.bodyShape === 'tapered') return base - i * 0.6;
    if (g.bodyShape === 'ribbed')  return base;
    return base;
  };

  const segments = allSegments.slice(0, Math.min(segsVisible, allSegments.length));

  // Head position — anchored above top segment
  const topSeg   = segments.length > 0 ? segments[segments.length - 1] : [100, 20, 12] as [number, number, number];
  const headCY   = (topSeg[0] as number) - 30;
  const headRX   = stage === 'baby' ? 28 : stage === 'adult' ? 30 : 32;
  const headRY   = stage === 'baby' ? 26 : stage === 'adult' ? 28 : 30;
  const eyeCY    = headCY - 6;
  const mouthCY  = headCY + 10;
  const cheekCY  = headCY + 8;

  // Sick overlay
  const sickFilter = expression === 'sick' ? 'saturate(0.3) brightness(0.8)' : undefined;

  // Sad expression overrides mouth
  const effectiveMouth: MouthStyle = expression === 'sad' || expression === 'sick'
    ? 'smirk'
    : g.mouthStyle;

  // Nubs only adult+
  const showNubs = stage === 'adult' || stage === 'elder';
  // Markings only adult+
  const showMarkings = stage === 'adult' || stage === 'elder';
  // Elder crown handled by hat === 'tophat'

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      xmlns="http://www.w3.org/2000/svg"
      style={{ overflow: 'visible', filter: glowFilter, ...(sickFilter ? { filter: `${glowFilter} ${sickFilter}` } : {}) }}
    >
      <defs>
        <style>{`
          @keyframes wobble {
            0%, 100% { transform: rotate(-4deg) translateY(0px); }
            25%       { transform: rotate(4deg)  translateY(-4px); }
            50%       { transform: rotate(-2deg) translateY(2px); }
            75%       { transform: rotate(3deg)  translateY(-2px); }
          }
          @keyframes blink {
            0%, 90%, 100% { transform: scaleY(1); }
            95%            { transform: scaleY(0.1); }
          }
          @keyframes pulse {
            0%,100% { opacity: 1; }
            50%     { opacity: 0.6; }
          }
          .worm-body { transform-origin: ${cx}px 120px; ${animated ? 'animation: wobble 1.8s ease-in-out infinite;' : ''} }
          .worm-eye  { transform-origin: center; ${animated ? 'animation: blink 3s ease-in-out infinite;' : ''} }
          ${g.glowIntensity === 'pulse' && animated ? `.worm-body { animation: wobble 1.8s ease-in-out infinite, pulse 2s ease-in-out infinite; }` : ''}
        `}</style>
        <radialGradient id={`${uidPrefix}bodyGrad`} cx="35%" cy="30%" r="55%">
          <stop offset="0%"   stopColor="white"    stopOpacity="0.45" />
          <stop offset="60%"  stopColor="white"    stopOpacity="0.10" />
          <stop offset="100%" stopColor={bodyColor} stopOpacity="0"   />
        </radialGradient>
      </defs>

      {/* ── Egg stage ──────────────────────────────────────────────── */}
      {stage === 'egg' && (
        <EggRenderer bodyColor={bodyColor} glowColor={glowColor} hatched={hatched} animated={animated} uidPrefix={uidPrefix} />
      )}

      {/* ── Baby / Adult / Elder ───────────────────────────────────── */}
      {stage !== 'egg' && (
        <g className="worm-body">

          {/* Tail */}
          <Tail type={g.tailType} cx={cx} baseY={allSegments[0][0]} bodyColor={bodyColor} />

          {/* Body segments */}
          {segments.map(([segY, baseRX, baseRY], i) => {
            const rx = shapeOffset(i, baseRX as number);
            const ry = baseRY as number;
            return (
              <g key={i}>
                <ellipse cx={cx} cy={segY as number} rx={rx} ry={ry} fill={bodyColor} />
                {i > 0 && i < segments.length - 1 && (
                  <ellipse cx={cx} cy={segY as number} rx={rx} ry={3} fill="black" opacity={0.15} />
                )}
                {showMarkings && (
                  <SegmentMarkings type={g.markingType} mColor={markingCol} cx={cx} segY={segY as number} rx={rx} ry={ry} />
                )}
              </g>
            );
          })}

          {/* Body shine */}
          {segments.length > 2 && (
            <ellipse cx={cx} cy={segments[Math.floor(segments.length/2)][0] as number} rx={22} ry={14} fill={`url(#${uidPrefix}bodyGrad)`} />
          )}

          {/* Nubs */}
          {showNubs && <Nubs style={g.nubStyle} cx={cx} cy={(segments[Math.floor(segments.length/2)]?.[0] ?? 115) as number} bodyColor={bodyColor} />}

          {/* Head */}
          <ellipse cx={cx} cy={headCY} rx={headRX} ry={headRY} fill={bodyColor} />
          <ellipse cx={cx} cy={headCY} rx={headRX} ry={headRY} fill={`url(#${uidPrefix}bodyGrad)`} />

          {/* Eyes */}
          <Eyes eyeStyle={g.eyeStyle} pupilStyle={g.pupilStyle} cx={cx} cy={eyeCY} bodyColor={bodyColor} animated={animated} />

          {/* Mouth */}
          <Mouth style={effectiveMouth} cx={cx} cy={mouthCY} />

          {/* Cheeks */}
          <Cheeks style={g.cheekStyle} cx={cx} cy={cheekCY} bodyColor={bodyColor} />

          {/* Cosmetics */}
          <HatLayer   hat={hat}    cx={cx} />
          <ShadesLayer shades={shades} cx={cx} cy={eyeCY} />
        </g>
      )}
    </svg>
  );
}
