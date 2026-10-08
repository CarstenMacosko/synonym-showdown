// Loaders for the two "voting" sources used by grade.ts:
//
//  - Wiktionary, via the kaikki.org extract (CC BY-SA 4.0): synonyms listed under each meaning of a word,
//    the broader "Thesaurus:" page lists, and antonyms.
//  - GloVe word vectors (Stanford, public domain): every word as 300 numbers; words used in similar
//    contexts get similar numbers, so cosine similarity ≈ "how close in meaning".
//
// Both files are large, so the first run extracts just what we need into sources/cache/ (fast after that).

import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { createGunzip } from 'node:zlib';
import { SOURCES_DIR } from './sources.ts';

const CACHE_DIR = join(SOURCES_DIR, 'cache');

export interface WiktionarySense {
  pos: string;
  gloss: string;
  tags: string[];
  synonyms: string[];
}

export interface WiktionaryEntry {
  /** Meanings, only kept for the words we ask for in full (the starters). */
  senses: WiktionarySense[];
  /** Synonyms not tied to one meaning (mostly from the word's Thesaurus: page). */
  thesaurus: string[];
  /** Every synonym of the word, from any meaning or list. */
  all: string[];
  antonyms: string[];
}

const OLD_TAGS = new Set(['archaic', 'obsolete', 'rare', 'dated', 'dialectal', 'nonstandard', 'humorous']);
const single = (w: string) => /^[a-z](?:[a-z'-]*[a-z])?$/.test(w);
const clean = (list: { word?: string }[] | undefined) =>
  [...new Set((list ?? []).map((x) => (x.word ?? '').toLowerCase().trim()).filter(single))];

async function* lines(file: string, gz: boolean) {
  const input = gz ? createReadStream(file).pipe(createGunzip()) : createReadStream(file);
  yield* createInterface({ input, crlfDelay: Infinity });
}

/**
 * Synonym/antonym lists for every English word in Wiktionary, plus full meanings for `detailed` words.
 * Cached in sources/cache/wiktionary.json (delete it to rebuild).
 */
export async function loadWiktionary(detailed: Set<string>): Promise<Map<string, WiktionaryEntry>> {
  const cacheFile = join(CACHE_DIR, 'wiktionary.json');
  if (existsSync(cacheFile)) {
    const cached = JSON.parse(readFileSync(cacheFile, 'utf8'));
    if (cached.detailed.join() === [...detailed].sort().join()) return new Map(Object.entries(cached.entries));
  }
  console.log('Reading Wiktionary (about a minute, first run only)…');
  const entries = new Map<string, WiktionaryEntry>();
  for await (const line of lines(join(SOURCES_DIR, 'wiktionary-en.jsonl.gz'), true)) {
    // Cheap pre-filter: most entries have no synonyms or antonyms at all.
    if (!line.includes('"synonyms"') && !line.includes('"antonyms"')) continue;
    const d = JSON.parse(line);
    const word = String(d.word).toLowerCase();
    if (!single(word)) continue;
    const e = entries.get(word) ?? { senses: [], thesaurus: [], all: [], antonyms: [] };
    const senses: WiktionarySense[] = (d.senses ?? [])
      .map((s: any) => ({ pos: d.pos, gloss: (s.glosses ?? []).at(-1) ?? '', tags: s.tags ?? [], synonyms: clean(s.synonyms) }))
      // Meanings nobody uses any more would let in words like "begladden".
      .filter((s: WiktionarySense) => !s.tags.some((t) => OLD_TAGS.has(t)));
    if (detailed.has(word)) e.senses.push(...senses);
    e.thesaurus = [...new Set([...e.thesaurus, ...clean(d.synonyms)])];
    e.all = [...new Set([...e.all, ...e.thesaurus, ...senses.flatMap((s) => s.synonyms)])].filter((w) => w !== word);
    e.antonyms = [...new Set([...e.antonyms, ...clean(d.antonyms), ...(d.senses ?? []).flatMap((s: any) => clean(s.antonyms))])];
    entries.set(word, e);
  }
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(cacheFile, JSON.stringify({ detailed: [...detailed].sort(), entries: Object.fromEntries(entries) }));
  return entries;
}

export interface Vectors {
  vec: Map<string, Float32Array>;
  /** Frequency rank in GloVe's training text (0 = "the"); very common words make useless decoys. */
  rank: Map<string, number>;
}

/**
 * GloVe vectors for the given words (normalized to length 1).
 * Cached as sources/cache/glove.bin (raw numbers) + glove-index.json (which word is where).
 */
export async function loadVectors(words: Set<string>): Promise<Vectors> {
  const DIM = 300;
  const binFile = join(CACHE_DIR, 'glove.bin');
  const indexFile = join(CACHE_DIR, 'glove-index.json');
  let index: { words: string[]; rank: number[]; absent: string[] } = { words: [], rank: [], absent: [] };
  let data = new Float32Array(0);
  if (existsSync(indexFile) && existsSync(binFile)) {
    index = JSON.parse(readFileSync(indexFile, 'utf8'));
    const buf = readFileSync(binFile);
    data = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
  }
  const known = new Set([...index.words, ...index.absent]);
  const missing = [...words].filter((w) => !known.has(w));
  if (missing.length) {
    console.log(`Reading GloVe vectors for ${missing.length} words (about 30 seconds)…`);
    const want = new Set(missing);
    const added: number[] = [];
    let n = 0;
    for await (const line of lines(join(SOURCES_DIR, 'glove.6B.300d.txt'), false)) {
      const space = line.indexOf(' ');
      const word = line.slice(0, space);
      const rank = n++;
      if (!want.has(word)) continue;
      const v = line.slice(space + 1).split(' ').map(Number);
      const len = Math.hypot(...v);
      for (const x of v) added.push(x / len);
      index.words.push(word);
      index.rank.push(rank);
      want.delete(word);
    }
    index.absent.push(...want);
    const merged = new Float32Array(data.length + added.length);
    merged.set(data);
    merged.set(added, data.length);
    data = merged;
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(binFile, Buffer.from(data.buffer));
    writeFileSync(indexFile, JSON.stringify(index));
  }
  const out: Vectors = { vec: new Map(), rank: new Map() };
  index.words.forEach((w, i) => {
    if (!words.has(w)) return;
    out.vec.set(w, data.subarray(i * DIM, (i + 1) * DIM));
    out.rank.set(w, index.rank[i]);
  });
  return out;
}

/** Cosine similarity of two normalized vectors (1 = same direction, 0 = unrelated). */
export function cosine(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/** Average of several vectors, normalized; used as the "center" of a meaning. */
export function centroid(vs: Float32Array[]): Float32Array | null {
  if (!vs.length) return null;
  const c = new Float32Array(vs[0].length);
  for (const v of vs) for (let i = 0; i < v.length; i++) c[i] += v[i];
  const len = Math.hypot(...c);
  return len ? c.map((x) => x / len) : null;
}
