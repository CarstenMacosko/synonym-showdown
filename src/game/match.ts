// Word matching: word forms ("joyful" == "joyfully") and spelling forgiveness.

import { primary, type StarterWord } from './words.ts';

/** How forgiving the game is about spelling. Ranked always uses 'strict'. */
export type Forgiveness = 'strict' | 'typos' | 'soundalike';

/** Lowercase letters only: "Short-Lived " -> "shortlived". */
export function key(word: string): string {
  return word
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents (clichéd -> cliched)
    .replace(/[^a-z]/g, '');
}

// Suffix rules, tried in order; the first one that fits is applied.
const SUFFIXES: [string, string][] = [
  ['iness', 'y'],
  ['ness', ''],
  ['ily', 'y'],
  ['ly', ''],
  ['iest', 'y'],
  ['ier', 'y'],
  ['ies', 'y'],
  ['ied', 'y'],
  ['ing', ''],
  ['est', ''],
  ['ed', ''],
  ['er', ''],
  ['s', ''],
];

/**
 * A rough "root" of a word, so different forms of one word compare equal:
 * happy / happier / happily / happiness -> "happi", joyful / joyfully -> "joyful".
 * It doesn't need to be a real word, only consistent.
 */
export function stem(word: string): string {
  let s = key(word);
  if (s.length <= 3) return s;
  let stripped = false;
  for (const [suffix, repl] of SUFFIXES) {
    if (s.endsWith(suffix) && !(suffix === 's' && s.endsWith('ss'))) {
      const base = s.slice(0, -suffix.length) + repl;
      if (base.length >= 3) {
        s = base;
        stripped = true;
        break;
      }
    }
  }
  if (stripped && /([b-df-hj-np-tv-z])\1$/.test(s)) s = s.slice(0, -1); // bigg -> big
  if (s.length > 3 && s.endsWith('e')) s = s.slice(0, -1); // brave -> brav
  if (s.endsWith('y')) s = s.slice(0, -1) + 'i'; // happy -> happi
  return s;
}

/** Classic edit distance: how many single-letter changes turn a into b. */
export function editDistance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/** Typos allowed for a word of this length: short words must be exact. */
function typoAllowance(len: number): number {
  if (len <= 4) return 0;
  if (len <= 7) return 1;
  return 2;
}

/**
 * A simple "how it sounds" key: unify letters that make the same sound and
 * collapse every vowel group to one marker. "chearful", "cheerfal" -> same key as "cheerful".
 */
export function soundKey(word: string): string {
  let s = key(word);
  s = s
    .replace(/^kn/, 'n')
    .replace(/^wr/, 'r')
    .replace(/ph/g, 'f')
    .replace(/ck/g, 'k')
    .replace(/c(?=[eiy])/g, 's')
    .replace(/c/g, 'k')
    .replace(/q/g, 'k')
    .replace(/x/g, 'ks')
    .replace(/z/g, 's')
    .replace(/gh/g, '')
    .replace(/(?!^)y/g, 'a') // y inside a word acts as a vowel
    .replace(/[aeiou]+/g, 'a')
    .replace(/(.)\1+/g, '$1');
  return s.replace(/a$/, ''); // silent trailing vowel
}

function sameWord(guess: string, target: string, forgiveness: Forgiveness): boolean {
  const g = stem(guess);
  const t = stem(target);
  if (g === t || key(guess) === key(target)) return true;
  if (forgiveness === 'strict') return false;
  const allowed = typoAllowance(key(target).length);
  if (allowed > 0 && (editDistance(key(guess), key(target)) <= allowed || editDistance(g, t) <= allowed)) {
    return true;
  }
  if (forgiveness === 'soundalike' && key(target).length >= 4) {
    return soundKey(guess) === soundKey(target);
  }
  return false;
}

/**
 * If `guess` matches one of the starter's synonyms, return that synonym's main spelling.
 * Exact/form matches win over fuzzy ones so "cool" never gets read as a typo of "coal".
 */
export function findSynonym(guess: string, starter: StarterWord, forgiveness: Forgiveness): string | null {
  const g = stem(guess);
  const spellings = (entry: string) => entry.split('/');
  const exact = starter.synonyms.find((e) => spellings(e).some((s) => stem(s) === g || key(s) === key(guess)));
  if (exact) return primary(exact);
  if (forgiveness === 'strict') return null;
  const fuzzy = starter.synonyms.find((e) => spellings(e).some((s) => sameWord(guess, s, forgiveness)));
  return fuzzy ? primary(fuzzy) : null;
}

/** Is `guess` some form/spelling of `word`? Used for "already said" and "that's the starter word". */
export function isSameWord(guess: string, word: string, forgiveness: Forgiveness): boolean {
  return sameWord(guess, word, forgiveness);
}
