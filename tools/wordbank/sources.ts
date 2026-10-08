// Loaders for the free word-data sources downloaded by download.ts.
//
//  - Open English WordNet 2025 (CC BY 4.0): word meanings ("synsets") with definitions and related meanings.
//  - Moby Thesaurus (public domain): very broad, unsorted lists of related words.
//  - SCOWL v2 (permissive, credit required): how common a word is, as a "size" level 35 (common) … 85 (rare).

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export const SOURCES_DIR = join(import.meta.dirname, 'sources');

export type Pos = 'adj' | 'noun' | 'verb' | 'adv';

export interface Synset {
  id: string;
  pos: Pos;
  definition: string;
  examples: string[];
  members: string[];
  /** Adjective clusters: closely similar meanings. */
  similar: string[];
  also: string[];
  hypernym: string[];
  /** Filled in by loadWordNet: more specific meanings (reverse of hypernym). */
  hyponym: string[];
}

export interface WordNet {
  synsets: Map<string, Synset>;
  /** lemma -> synset ids, in WordNet's order (most common meaning first). */
  senses: Map<string, string[]>;
}

const POS: Record<string, Pos> = { a: 'adj', s: 'adj', n: 'noun', v: 'verb', r: 'adv' };

export function loadWordNet(): WordNet {
  const dir = join(SOURCES_DIR, 'oewn');
  const synsets = new Map<string, Synset>();
  const senses = new Map<string, string[]>();
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.json') || file === 'frames.json') continue;
    const data = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    if (file.startsWith('entries-')) {
      for (const [lemma, byPos] of Object.entries<Record<string, { sense: { synset: string }[] }>>(data)) {
        const ids = Object.values(byPos).flatMap((e) => e.sense.map((s) => s.synset));
        senses.set(lemma.toLowerCase(), [...(senses.get(lemma.toLowerCase()) ?? []), ...ids]);
      }
    } else {
      for (const [id, s] of Object.entries<any>(data)) {
        synsets.set(id, {
          id,
          pos: POS[s.partOfSpeech],
          definition: s.definition?.[0] ?? '',
          examples: s.example ?? [],
          members: s.members,
          similar: s.similar ?? [],
          also: s.also ?? [],
          hypernym: s.hypernym ?? [],
          hyponym: [],
        });
      }
    }
  }
  for (const s of synsets.values()) for (const h of s.hypernym) synsets.get(h)?.hyponym.push(s.id);
  return { synsets, senses };
}

/** headword -> related words, from the Moby Thesaurus. */
export function loadMoby(): Map<string, string[]> {
  const moby = new Map<string, string[]>();
  for (const line of readFileSync(join(SOURCES_DIR, 'mthesaur.txt'), 'latin1').split(/\r?\n/)) {
    const [head, ...rest] = line.split(',');
    if (head && rest.length) moby.set(head.toLowerCase(), rest);
  }
  return moby;
}

/** word -> smallest SCOWL size it appears in (35 = very common … 85 = rare). Missing = not in SCOWL. */
export function loadScowl(): Map<string, number> {
  const file = join(SOURCES_DIR, 'wordlist-rel-2026.02.25', 'data', 'scowl-pre.txt');
  const sizes = new Map<string, number>();
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    // e.g. "35 [12dicts] [ukfreq] 40 [3esl] …: happy <aj>: happier, happiest"
    const m = /^(\d+)[^:]*: ([^<:]+?) </.exec(line);
    if (!m) continue;
    const size = Number(m[1]);
    const word = m[2].trim();
    if (word !== word.toLowerCase()) continue; // skip proper nouns / acronyms
    if (size < (sizes.get(word) ?? 99)) sizes.set(word, size);
  }
  return sizes;
}
