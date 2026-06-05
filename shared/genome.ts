/**
 * Genome System — deterministic worm appearance from a 32-char hex seed.
 *
 * The genome string is generated once at creation time and stored in the DB.
 * Every visual trait is derived from it, so the worm always looks identical
 * across devices and sessions — no randomness at render time.
 *
 * Genome layout (32 hex chars = 128 bits):
 *   chars 0–1  : segmentCount gene  (3–9 segments at elder)
 *   chars 2–3  : bodyShape gene     (round | tapered | lumpy | ribbed)
 *   chars 4–5  : eyeStyle gene      (beady | wide | sleepy | compound | hearts)
 *   chars 6–7  : tailType gene      (flat | pointed | frilly | club | split)
 *   chars 8–9  : markingType gene   (none | stripes | spots | rings | gradient | zigzag)
 *   chars 10–11: markingColor gene  (complement | dark | bright | metallic | glow)
 *   chars 12–13: nubStyle gene      (none | tiny | wavy | spiky | leafy)
 *   chars 14–15: cheekStyle gene    (none | rosy | freckles | star)
 *   chars 16–17: mouthStyle gene    (smile | smirk | ooh | beam | fangs)
 *   chars 18–19: glowIntensity gene (low | medium | high | pulse)
 *   chars 20–21: colorMutation gene (pure | hueshift+10 | hueshift+25 | desaturate | oversaturate)
 *   chars 22–23: pupilStyle gene    (dot | oval | cross | star | heart)
 *   chars 24–31: reserved / future traits
 */

export type BodyShape    = 'round' | 'tapered' | 'lumpy' | 'ribbed';
export type EyeStyle     = 'beady' | 'wide' | 'sleepy' | 'compound' | 'hearts';
export type TailType     = 'flat' | 'pointed' | 'frilly' | 'club' | 'split';
export type MarkingType  = 'none' | 'stripes' | 'spots' | 'rings' | 'gradient' | 'zigzag';
export type MarkingColor = 'complement' | 'dark' | 'bright' | 'metallic' | 'glow';
export type NubStyle     = 'none' | 'tiny' | 'wavy' | 'spiky' | 'leafy';
export type CheekStyle   = 'none' | 'rosy' | 'freckles' | 'star';
export type MouthStyle   = 'smile' | 'smirk' | 'ooh' | 'beam' | 'fangs';
export type GlowIntensity = 'low' | 'medium' | 'high' | 'pulse';
export type ColorMutation = 'pure' | 'hueshift10' | 'hueshift25' | 'desaturate' | 'oversaturate';
export type PupilStyle   = 'dot' | 'oval' | 'cross' | 'star' | 'heart';

export interface DecodedGenome {
  segmentCount:   number;         // 3–9
  bodyShape:      BodyShape;
  eyeStyle:       EyeStyle;
  tailType:       TailType;
  markingType:    MarkingType;
  markingColor:   MarkingColor;
  nubStyle:       NubStyle;
  cheekStyle:     CheekStyle;
  mouthStyle:     MouthStyle;
  glowIntensity:  GlowIntensity;
  colorMutation:  ColorMutation;
  pupilStyle:     PupilStyle;
}

// ── helpers ────────────────────────────────────────────────────────────────

function pick<T>(arr: T[], byte: number): T {
  return arr[byte % arr.length];
}

function hexByte(genome: string, offset: number): number {
  return parseInt(genome.slice(offset * 2, offset * 2 + 2), 16);
}

// ── decode ─────────────────────────────────────────────────────────────────

export function decodeGenome(genome: string): DecodedGenome {
  const g = genome.padEnd(32, '0').slice(0, 32);

  const segRaw = hexByte(g, 0);
  // map 0-255 → 3 to 9
  const segmentCount = 3 + (segRaw % 7);

  return {
    segmentCount,
    bodyShape:     pick<BodyShape>    (['round','tapered','lumpy','ribbed'],          hexByte(g, 1)),
    eyeStyle:      pick<EyeStyle>     (['beady','wide','sleepy','compound','hearts'],  hexByte(g, 2)),
    tailType:      pick<TailType>     (['flat','pointed','frilly','club','split'],     hexByte(g, 3)),
    markingType:   pick<MarkingType>  (['none','stripes','spots','rings','gradient','zigzag'], hexByte(g, 4)),
    markingColor:  pick<MarkingColor> (['complement','dark','bright','metallic','glow'],       hexByte(g, 5)),
    nubStyle:      pick<NubStyle>     (['none','tiny','wavy','spiky','leafy'],         hexByte(g, 6)),
    cheekStyle:    pick<CheekStyle>   (['none','rosy','freckles','star'],              hexByte(g, 7)),
    mouthStyle:    pick<MouthStyle>   (['smile','smirk','ooh','beam','fangs'],         hexByte(g, 8)),
    glowIntensity: pick<GlowIntensity>(['low','medium','high','pulse'],                hexByte(g, 9)),
    colorMutation: pick<ColorMutation>(['pure','hueshift10','hueshift25','desaturate','oversaturate'], hexByte(g, 10)),
    pupilStyle:    pick<PupilStyle>   (['dot','oval','cross','star','heart'],          hexByte(g, 11)),
  };
}

// ── generate ───────────────────────────────────────────────────────────────

export function generateGenome(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    // Node.js fallback
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodeCrypto = require('crypto');
    const buf: Buffer = nodeCrypto.randomBytes(16);
    for (let i = 0; i < 16; i++) bytes[i] = buf[i];
  }
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ── evolutionary stage scaling ─────────────────────────────────────────────

/**
 * Returns how many body segments are VISIBLE for the current stage.
 * The elder count is the full genome segment count.
 * Baby shows only the first 2, adult 4-5, elder up to segmentCount.
 */
export function visibleSegments(genome: DecodedGenome, stage: 'egg' | 'baby' | 'adult' | 'elder'): number {
  switch (stage) {
    case 'egg':   return 0;
    case 'baby':  return 2;
    case 'adult': return Math.max(4, Math.floor(genome.segmentCount * 0.65));
    case 'elder': return genome.segmentCount;
  }
}

/**
 * Base size multiplier per stage.
 */
export function stageScale(stage: 'egg' | 'baby' | 'adult' | 'elder'): number {
  switch (stage) {
    case 'egg':   return 0.7;
    case 'baby':  return 0.75;
    case 'adult': return 0.90;
    case 'elder': return 1.0;
  }
}
