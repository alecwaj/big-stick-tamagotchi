export type WormColor   = 'pink' | 'green' | 'purple' | 'orange' | 'blue' | 'red' | 'yellow';
export type WormHat =
  | 'none'
  | 'fedora'
  | 'panama'
  | 'bowler'
  | 'trilby'
  | 'akubra'
  | 'bucket'
  | 'baseball'
  | 'newsboy'
  | 'beanie'
  | 'cowboy'
  | 'boater'
  | 'homburg'
  | 'beret'
  | 'snapback'
  | 'tophat';
export type WormShades  = 'none' | 'round' | 'star' | 'heart' | 'visor' | 'sunglasses2';
export type WormTrait   = 'sleepy' | 'hyper' | 'grumpy' | 'chill' | 'bubbly' | 'spooky';
export type WormStage   = 'egg' | 'baby' | 'adult' | 'elder';
export type WormExpression = 'happy' | 'neutral' | 'sad' | 'sick';

// Each worm friend entry — retained for future benefits
export interface WormFriend {
  token: string;         // their owner_token (their worm's identity)
  firstMetAt: number;   // ms timestamp of first meeting
  lastMetAt: number;    // ms timestamp of most recent meeting
  meetCount: number;    // total number of times you've scanned each other
}

export type AddFriendResult = 'added' | 'reunited' | 'self' | 'invalid';

export interface WormState {
  id: string;
  token: string;
  name: string;
  color: WormColor;
  hat: WormHat;
  shades: WormShades;
  trait: WormTrait;
  stage: WormStage;
  genome: string;         // 32-char hex — drives visual evolution
  hatched: boolean;       // false = still in egg, true = hatched
  mood: number;          // 0–100
  hunger: number;        // 0–100
  isSick: boolean;
  xp: number;
  createdAt: number;     // ms timestamp
  lastChecked: number;   // ms timestamp — used for decay
  lowMoodSince: number | null;
  feedCount: number;
  gameCount: number;
  loginStreak: number;
  lastLoginDay: string;  // ISO date string YYYY-MM-DD
  friends: WormFriend[];
  totalFriendMeets: number; // lifetime meeting counter for future milestones
}

export const COLOR_MAP: Record<WormColor, string> = {
  pink:   '#ff00cc',
  green:  '#aaff00',
  purple: '#cc00ff',
  orange: '#ff6600',
  blue:   '#00f5ff',
  red:    '#ff0055',
  yellow: '#ffff00',
};

export const GLOW_MAP: Record<WormColor, string> = {
  pink:   'rgba(255, 0, 204, 0.7)',
  green:  'rgba(170, 255, 0, 0.7)',
  purple: 'rgba(204, 0, 255, 0.7)',
  orange: 'rgba(255, 102, 0, 0.7)',
  blue:   'rgba(0, 245, 255, 0.7)',
  red:    'rgba(255, 0, 85, 0.7)',
  yellow: 'rgba(255, 255, 0, 0.7)',
};

// Decay rates per millisecond
export const MOOD_DECAY_PER_MS   = 5   / (60 * 60 * 1000);  // 5pt/hr
export const HUNGER_DECAY_PER_MS = 8   / (60 * 60 * 1000);  // 8pt/hr
export const SICK_THRESHOLD_MS   = 4 * 60 * 60 * 1000;       // 4 hours

// XP + age thresholds
export const ADULT_XP_THRESHOLD  = 500;
export const ELDER_XP_THRESHOLD  = 2000;
export const ADULT_AGE_MS        = 3  * 24 * 60 * 60 * 1000;  // 3 days
export const ELDER_AGE_MS        = 14 * 24 * 60 * 60 * 1000;  // 14 days
