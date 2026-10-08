// Step 3: for every starter word, collect every plausible synonym from WordNet + Moby into
// candidates/<word>.json. This is deliberately generous; the review step decides what actually counts.
// Run: npm run words:candidates

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { stem } from '../../src/game/match.ts';
import type { Tier } from '../../src/game/words.ts';
import { loadMoby, loadScowl, loadWordNet, type Pos, type Synset, type WordNet } from './sources.ts';
import { STARTER_TIERS } from './starters.ts';

export const CANDIDATES_DIR = join(import.meta.dirname, 'candidates');

/** Where a candidate came from, strongest evidence first. */
export type Source = 'wn-same' | 'wn-similar' | 'wn-narrower' | 'wn-also' | 'wn-broader' | 'moby';
const SOURCE_RANK: Source[] = ['wn-same', 'wn-similar', 'wn-narrower', 'wn-also', 'wn-broader', 'moby'];

export interface Sense {
  id: string;
  pos: Pos;
  definition: string;
  examples: string[];
}

export interface Candidate {
  word: string;
  sources: Source[];
  /** SCOWL size: 35 = very common … 80 = rare; null = not in SCOWL. */
  scowl: number | null;
  /** WordNet senses of the starter this candidate is linked to. */
  senses: string[];
}

export interface CandidateFile {
  word: string;
  tier: Tier;
  senses: Sense[];
  candidates: Candidate[];
}

/** Players type single words, so keep single words and hyphenated compounds only. */
function playable(w: string): boolean {
  return /^[a-z](?:[a-z'-]*[a-z])?$/.test(w);
}

// Moby lists for common words run to thousands of entries; this keeps the review focused.
const MAX_CANDIDATES = 400;
const MAX_MOBY_SCOWL = 60;

function build(word: string, tier: Tier, wn: WordNet, moby: Map<string, string[]>, scowl: Map<string, number>): CandidateFile {
  const found = new Map<string, Candidate>();
  const starterStem = stem(word);
  const add = (raw: string, source: Source, senseId?: string) => {
    const w = raw.toLowerCase().replace(/_/g, ' ').trim();
    if (!playable(w) || stem(w) === starterStem) return;
    const c = found.get(w) ?? { word: w, sources: [], scowl: scowl.get(w) ?? null, senses: [] };
    if (!c.sources.includes(source)) c.sources.push(source);
    if (senseId && !c.senses.includes(senseId)) c.senses.push(senseId);
    found.set(w, c);
  };

  const senses: Sense[] = [];
  const synset = (id: string): Synset | undefined => wn.synsets.get(id);
  for (const id of new Set(wn.senses.get(word) ?? [])) {
    const s = synset(id);
    if (!s) continue;
    senses.push({ id, pos: s.pos, definition: s.definition, examples: s.examples.slice(0, 2) });
    s.members.forEach((m) => add(m, 'wn-same', id));
    for (const rel of s.similar) synset(rel)?.members.forEach((m) => add(m, 'wn-similar', id));
    for (const rel of s.also) synset(rel)?.members.forEach((m) => add(m, 'wn-also', id));
    for (const rel of s.hyponym) synset(rel)?.members.forEach((m) => add(m, 'wn-narrower', id));
    for (const rel of s.hypernym) synset(rel)?.members.forEach((m) => add(m, 'wn-broader', id));
  }
  for (const m of moby.get(word) ?? []) {
    const w = m.toLowerCase();
    // Moby is noisy: only keep its words that are reasonably common, or already backed by WordNet.
    if (found.has(w) || (scowl.get(w) ?? 99) <= MAX_MOBY_SCOWL) add(w, 'moby');
  }

  const rank = (c: Candidate) => Math.min(...c.sources.map((s) => SOURCE_RANK.indexOf(s)));
  const candidates = [...found.values()]
    // Words outside SCOWL entirely are usually archaic or technical, unless WordNet ties them to the word directly.
    .filter((c) => c.scowl !== null || c.sources.includes('wn-same') || c.sources.includes('wn-similar'))
    .sort((a, b) => rank(a) - rank(b) || (a.scowl ?? 99) - (b.scowl ?? 99) || a.word.localeCompare(b.word))
    .slice(0, MAX_CANDIDATES);
  return { word, tier, senses, candidates };
}

if (import.meta.main) {
  console.log('Loading sources…');
  const [wn, moby, scowl] = [loadWordNet(), loadMoby(), loadScowl()];
  mkdirSync(CANDIDATES_DIR, { recursive: true });
  const thin: string[] = [];
  for (const [tier, list] of Object.entries(STARTER_TIERS) as [Tier, string[]][]) {
    for (const word of list) {
      const file = build(word, tier, wn, moby, scowl);
      writeFileSync(join(CANDIDATES_DIR, `${word}.json`), JSON.stringify(file, null, 1));
      if (file.candidates.length < 25) thin.push(`${word} (${file.candidates.length})`);
    }
  }
  console.log(`Wrote ${Object.values(STARTER_TIERS).flat().length} candidate files to ${CANDIDATES_DIR}`);
  if (thin.length) console.log('Few candidates:', thin.join(', '));
}
