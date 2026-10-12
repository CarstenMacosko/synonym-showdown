// Player avatars: a doodled face built from a few choices. Shared by the browser (drawing, editor) and the
// server (which only accepts known options).

export const AVATAR_COLORS = [
  '#4dabf7', // blue
  '#ff8787', // red
  '#69db7c', // green
  '#ffd43b', // yellow
  '#da77f2', // purple
  '#ffa94d', // orange
  '#38d9a9', // teal
  '#f783ac', // pink
  '#a9e34b', // lime
  '#748ffc', // indigo
  '#ced4da', // grey
  '#b08968', // brown
] as const;

export const TEXTURES = ['hachure', 'cross-hatch', 'zigzag', 'dots', 'solid', 'dashed', 'zigzag-line', 'shiny'] as const;
export const SHAPES = ['round', 'square', 'blob', 'tall', 'wide', 'diamond'] as const;
export const EYES = ['dots', 'happy', 'wide', 'sleepy', 'wink', 'glasses', 'shades', 'star'] as const;
export const MOUTHS = ['smile', 'grin', 'flat', 'o', 'tongue', 'smirk', 'teeth', 'vampire'] as const;
export const HATS = ['none', 'cap', 'beanie', 'crown', 'tophat', 'party', 'wizard', 'headphones', 'bow', 'propeller', 'halo', 'horns', 'santa'] as const;
export const EXTRAS = ['none', 'blush', 'freckles', 'mustache', 'bandaid', 'bowtie', 'monocle'] as const;

export interface AvatarConfig {
  /** Index into AVATAR_COLORS for the face. */
  color: number;
  /** Index into AVATAR_COLORS for hats and accessories. */
  accent: number;
  texture: (typeof TEXTURES)[number];
  shape: (typeof SHAPES)[number];
  eyes: (typeof EYES)[number];
  mouth: (typeof MOUTHS)[number];
  hat: (typeof HATS)[number];
  extra: (typeof EXTRAS)[number];
}

export const AVATAR_PARTS = {
  texture: TEXTURES,
  shape: SHAPES,
  eyes: EYES,
  mouth: MOUTHS,
  hat: HATS,
  extra: EXTRAS,
} as const;

type Part = keyof typeof AVATAR_PARTS;

/** Parts earned with account points (from solo runs and online games). Everything else is free. */
export const UNLOCK_POINTS: { [P in Part]?: Partial<Record<AvatarConfig[P], number>> } = {
  hat: { propeller: 5, tophat: 50, santa: 75, crown: 100, wizard: 250, halo: 500 },
  eyes: { shades: 25 },
  mouth: { vampire: 300 },
  shape: { diamond: 1000 },
  extra: { monocle: 5000 },
  texture: { shiny: 10000 },
};

/** What a player gets back when they wear something they haven't earned. */
const PLAIN: { [P in Part]: AvatarConfig[P] } = {
  hat: 'none',
  eyes: 'dots',
  mouth: 'smile',
  shape: 'round',
  extra: 'none',
  texture: 'hachure',
};

/** Points needed for an option (0 = free for everyone). */
export function unlockCost(part: Part, option: string): number {
  return (UNLOCK_POINTS[part] as Record<string, number> | undefined)?.[option] ?? 0;
}

/** The first part of a face the player hasn't earned yet, if any. */
export function lockedPart(a: AvatarConfig, points: number): { part: Part; option: string; cost: number } | null {
  for (const part of Object.keys(PLAIN) as Part[]) {
    const cost = unlockCost(part, a[part]);
    if (cost > points) return { part, option: a[part], cost };
  }
  return null;
}

/** The face with anything the player hasn't earned yet swapped for the plain option. */
export function lockAvatar(a: AvatarConfig, points: number): AvatarConfig {
  const out = { ...a };
  for (const part of Object.keys(PLAIN) as Part[]) {
    if (unlockCost(part, a[part]) > points) (out as Record<Part, string>)[part] = PLAIN[part];
  }
  return out;
}

/** Small deterministic hash, so a name always gets the same default face. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A plain face for players who haven't customized theirs (stable per name/id). */
export function defaultAvatar(seed: string, colorHex?: string): AvatarConfig {
  const h = hash(seed);
  const byHex = colorHex ? AVATAR_COLORS.indexOf(colorHex as (typeof AVATAR_COLORS)[number]) : -1;
  return {
    color: byHex >= 0 ? byHex : h % AVATAR_COLORS.length,
    accent: (h >>> 4) % AVATAR_COLORS.length,
    texture: 'hachure',
    shape: 'round',
    eyes: 'dots',
    mouth: 'smile',
    hat: 'none',
    extra: 'none',
  };
}

/** A random face. Pass `points` to only use parts that player has unlocked (bots can wear anything). */
export function randomAvatar(rng: () => number = Math.random, points = Infinity): AvatarConfig {
  const pick = <P extends Part>(part: P, skipFirst = false) => {
    const all = AVATAR_PARTS[part] as readonly string[] as readonly AvatarConfig[P][];
    const xs = all.slice(skipFirst ? 1 : 0).filter((o) => unlockCost(part, o) <= points);
    return xs[Math.floor(rng() * xs.length)];
  };
  return {
    color: Math.floor(rng() * AVATAR_COLORS.length),
    accent: Math.floor(rng() * AVATAR_COLORS.length),
    texture: pick('texture'),
    shape: pick('shape'),
    eyes: pick('eyes'),
    mouth: pick('mouth'),
    // Most random faces get a hat; it's the fun part.
    hat: rng() < 0.8 ? pick('hat', true) : 'none',
    extra: rng() < 0.5 ? pick('extra', true) : 'none',
  };
}

/** Accept only known options (anything from a browser is untrusted). */
export function sanitizeAvatar(x: unknown): AvatarConfig | null {
  if (!x || typeof x !== 'object') return null;
  const a = x as Record<string, unknown>;
  const color = (v: unknown) => (Number.isInteger(v) && (v as number) >= 0 && (v as number) < AVATAR_COLORS.length ? (v as number) : null);
  const one = <T extends string>(v: unknown, opts: readonly T[]) => (opts.includes(v as T) ? (v as T) : null);
  const out = {
    color: color(a.color),
    accent: color(a.accent),
    texture: one(a.texture, TEXTURES),
    shape: one(a.shape, SHAPES),
    eyes: one(a.eyes, EYES),
    mouth: one(a.mouth, MOUTHS),
    hat: one(a.hat, HATS),
    extra: one(a.extra, EXTRAS),
  };
  return Object.values(out).some((v) => v === null) ? null : (out as AvatarConfig);
}
