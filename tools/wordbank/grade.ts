// Step 4 (free version): grade every starter's synonyms by letting the sources vote.
//
//   evidence  WordNet same meaning / similar meaning / related meanings, Wiktionary meaning lists,
//             Wiktionary thesaurus pages, reverse links (the candidate lists the starter), Moby
//   veto      antonyms (WordNet + Wiktionary), very rare words, forms of the starter itself
//   tiebreak  GloVe similarity: how close the two words are in meaning, from how they're used in text
//
// Output: graded/<word>.json (committed; hand-editable), with uncertain rulings listed under "flagged"
// so a human (or Claude) only has to look at those.
//
//   npm run words:grade                 grade all 300 starters
//   npm run words:grade -- happy run    grade all, then print these words in detail

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { stem } from '../../src/game/match.ts';
import type { Tier } from '../../src/game/words.ts';
import { CANDIDATES_DIR, type CandidateFile, type Source } from './candidates.ts';
import { centroid, cosine, loadVectors, loadWiktionary, type Vectors, type WiktionaryEntry } from './evidence.ts';
import { loadMoby, loadScowl, loadWordNet, type Pos, type WordNet } from './sources.ts';
import { STARTER_TIERS } from './starters.ts';

export const GRADED_DIR = join(import.meta.dirname, 'graded');

type Evidence = Source | 'wik-sense' | 'wik-thes' | 'wik-reverse' | 'moby-reverse' | 'via-synonym';

// How much each kind of evidence counts toward a word being a real synonym.
const WEIGHT: Record<Evidence, number> = {
  'wn-same': 3,
  'wik-sense': 3,
  'wn-similar': 2,
  'wik-thes': 1.5,
  'wik-reverse': 1.5,
  moby: 1,
  'moby-reverse': 0.5,
  'wn-also': 0.75,
  'wn-narrower': 0.75,
  'wn-broader': 0.5,
  'via-synonym': 0, // counted separately: 0.75 for each strong synonym that lists the word, up to 3
};
const HOP_WEIGHT = 0.6;
const HOP_MAX = 3;
// Words this common ("go", "do", "thing") have too many meanings to pass synonyms along reliably.
const COMMON_RANK = 1000;
const STRONG: Evidence[] = ['wn-same', 'wik-sense'];

// Score cut-offs for closeness 1 / 2 / 3.
const CUT = { close: 6, solid: 3.5, distant: 2 };

export interface GradedWord {
  word: string;
  closeness: 1 | 2 | 3;
  score: number;
  /** GloVe similarity to the starter, or null if GloVe doesn't know the word. */
  similarity: number | null;
  evidence: Evidence[];
}

export interface GradedSense {
  label: string;
  definition: string;
  pos: 'adjective' | 'noun' | 'verb' | 'adverb';
  words: GradedWord[];
}

export interface GradedFile {
  word: string;
  tier: Tier;
  senses: GradedSense[];
  decoys: string[];
  /** Rulings the sources disagree on; worth a human (or Claude) look. */
  flagged: { word: string; ruling: string; reason: string }[];
}

const POS_NAME: Record<Pos, GradedSense['pos']> = { adj: 'adjective', noun: 'noun', verb: 'verb', adv: 'adverb' };
const WIK_POS: Record<string, Pos> = { adj: 'adj', noun: 'noun', verb: 'verb', adv: 'adv' };
const playable = (w: string) => /^[a-z](?:[a-z'-]*[a-z])?$/.test(w);
const round = (x: number) => Math.round(x * 100) / 100;

interface Sources {
  wn: WordNet;
  moby: Map<string, string[]>;
  scowl: Map<string, number>;
  wik: Map<string, WiktionaryEntry>;
  vectors: Vectors;
  /** Parts of speech each word has in WordNet. */
  wnPos: Map<string, Set<Pos>>;
  /** Common words by part of speech, for picking bluff decoys. */
  decoyPool: Map<Pos, string[]>;
}

const MAX_SENSES = 6;

function grade(c: CandidateFile, src: Sources): GradedFile {
  const { wn, moby, scowl, wik, wnPos } = src;
  const vec = src.vectors.vec;
  const s = c.word;
  const sStem = stem(s);
  const wikS = wik.get(s);

  // ---- gather evidence ----
  const ev = new Map<string, Set<Evidence>>();
  const wnSense = new Map<string, string>(); // word -> WordNet sense id it's linked to
  const add = (w: string, e: Evidence) => {
    if (!playable(w) || stem(w) === sStem) return;
    ev.set(w, (ev.get(w) ?? new Set()).add(e));
  };
  for (const cand of c.candidates) {
    cand.sources.forEach((e) => add(cand.word, e));
    if (cand.senses.length && (cand.sources.includes('wn-same') || cand.sources.includes('wn-similar'))) {
      wnSense.set(cand.word, cand.senses[0]);
    }
  }
  // The starter's parts of speech come from WordNet when it knows the word (Wiktionary lists rare uses
  // like "happy" as a verb, which would let in "happify").
  const starterPos = new Set<Pos>(c.senses.length ? c.senses.map((x) => x.pos) : (wikS?.senses.map((x) => WIK_POS[x.pos]).filter(Boolean) ?? []));
  const wikSenseOf = new Map<string, number>(); // word -> index of the Wiktionary meaning listing it
  wikS?.senses.forEach((sense, i) =>
    starterPos.has(WIK_POS[sense.pos]) && sense.synonyms.forEach((w) => {
      add(w, 'wik-sense');
      if (!wikSenseOf.has(w)) wikSenseOf.set(w, i);
    }),
  );
  wikS?.thesaurus.forEach((w) => add(w, 'wik-thes'));
  for (const w of ev.keys()) {
    if (wik.get(w)?.all.includes(s)) ev.get(w)!.add('wik-reverse');
    if (moby.get(w)?.includes(s)) ev.get(w)!.add('moby-reverse');
  }

  // ---- vetoes ----
  const antonyms = new Set([...(wikS?.antonyms ?? []), ...(wn.antonyms.get(s) ?? [])]);
  for (const w of ev.keys()) if (wik.get(w)?.antonyms.includes(s) || wn.antonyms.get(w)?.has(s)) antonyms.add(w);

  // ---- score and rule ----
  const hops = new Map<string, number>(); // word -> how many strong synonyms of the starter list it
  const rule = () => {
  const flagged: GradedFile['flagged'] = [];
  const accepted: GradedWord[] = [];
  const rejected: { word: string; score: number }[] = [];
  for (const [w, set] of ev) {
    const evidence = [...set].sort((a, b) => WEIGHT[b] - WEIGHT[a]);
    if (antonyms.has(w)) continue;
    const pos = wnPos.get(w);
    if (pos && ![...pos].some((p) => starterPos.has(p))) continue; // e.g. the verb "rejoice" for the adjective "happy"
    const size = scowl.get(w) ?? null;
    const strong = evidence.some((e) => STRONG.includes(e));
    // Too rare to be fair, unless WordNet puts it in the very same meaning.
    if ((size === null || size > 70) && !evidence.includes('wn-same')) continue;
    const similarity = vec.has(s) && vec.has(w) ? round(cosine(vec.get(s)!, vec.get(w)!)) : null;
    let score = evidence.reduce((n, e) => n + WEIGHT[e], 0) + HOP_WEIGHT * Math.min(HOP_MAX, hops.get(w) ?? 0);
    if (similarity !== null) score += Math.max(-2, Math.min(2, (similarity - 0.25) * 6));
    score = round(score);

    let closeness: 1 | 2 | 3 | null = null;
    if (score >= CUT.close && strong) closeness = 1;
    else if (score >= CUT.solid) closeness = 2;
    // A weak similarity score alone can't sink a word that two sources agree on.
    else if (score >= CUT.distant && (similarity === null || similarity >= 0.2 || evidence.length >= 2)) closeness = 3;

    // Flag only rulings that rest on thin or conflicting evidence.
    if (closeness && evidence.length === 1 && !strong && (similarity ?? 0) < 0.3) {
      flagged.push({ word: w, ruling: `accepted (${closeness})`, reason: `only ${evidence[0]}, similarity ${similarity}` });
    } else if (closeness && similarity !== null && similarity < 0.05) {
      flagged.push({ word: w, ruling: `accepted (${closeness})`, reason: `sources agree but similarity ${similarity}` });
    } else if (!closeness && strong) {
      flagged.push({ word: w, ruling: 'rejected', reason: `a dictionary lists it, score ${score}` });
    } else if (!closeness && evidence.length >= 2 && score >= CUT.distant - 0.5) {
      flagged.push({ word: w, ruling: 'rejected', reason: `borderline score ${score}` });
    }

    if (closeness) accepted.push({ word: w, closeness, score, similarity, evidence });
    else rejected.push({ word: w, score });
  }
  return { flagged, accepted, rejected };
  };

  // First pass, then a second hop: words listed by several of the starter's strongest synonyms
  // (afraid -> petrified, spooked) fill in gaps the sources have for the starter itself.
  const first = rule();
  const rankOf = (w: string) => src.vectors.rank.get(w) ?? Infinity;
  const cores = first.accepted
    .filter((g) => g.closeness <= 2 && rankOf(g.word) >= COMMON_RANK)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);
  for (const core of cores) {
    const listed = new Set([...(wik.get(core.word)?.all ?? []), ...(moby.get(core.word) ?? [])]);
    for (const w of listed) {
      if (w === s || (scowl.get(w) ?? 99) > 60 || rankOf(w) < COMMON_RANK) continue;
      hops.set(w, (hops.get(w) ?? 0) + 1);
    }
  }
  const sv0 = vec.get(s);
  for (const [w, n] of hops) {
    const sim = sv0 && vec.has(w) ? cosine(sv0, vec.get(w)!) : 0;
    // New words need several strong synonyms to agree, plus some similarity to the starter itself.
    if (ev.has(w) || n >= 3 || (n >= 2 && sim >= 0.3)) add(w, 'via-synonym');
  }
  for (const w of ev.keys()) if (wik.get(w)?.antonyms.includes(s) || wn.antonyms.get(w)?.has(s)) antonyms.add(w);
  const { flagged, accepted, rejected } = rule();

  // ---- sort into meanings ----
  // WordNet meanings of the starter, each anchored by the words linked to it; Wiktionary meanings get
  // matched to the WordNet meaning whose anchor words they resemble most.
  const senseIds = c.senses.map((x) => x.id);
  const anchors = new Map(senseIds.map((id) => [id, [] as string[]]));
  for (const [w, id] of wnSense) anchors.get(id)?.push(w);
  const center = new Map(
    senseIds.map((id) => [id, centroid(anchors.get(id)!.filter((w) => vec.has(w)).map((w) => vec.get(w)!))]),
  );
  const nearestSense = (words: string[]): string | null => {
    const v = centroid(words.filter((w) => vec.has(w)).map((w) => vec.get(w)!));
    if (!v) return null;
    let best: string | null = null;
    let bestSim = -1;
    for (const [id, cv] of center) {
      if (!cv) continue;
      const sim = cosine(v, cv);
      if (sim > bestSim) [best, bestSim] = [id, sim];
    }
    return best;
  };
  const wikToWn = (wikS?.senses ?? []).map((sense) => nearestSense(sense.synonyms));
  const fallback = senseIds[0] ?? 'misc';
  const groups = new Map<string, GradedWord[]>();
  for (const g of accepted) {
    const id =
      wnSense.get(g.word) ??
      (wikSenseOf.has(g.word) ? wikToWn[wikSenseOf.get(g.word)!] : null) ??
      nearestSense([g.word]) ??
      fallback;
    groups.set(id, [...(groups.get(id) ?? []), g]);
  }

  const byStrength = (a: GradedWord, b: GradedWord) =>
    a.closeness - b.closeness || (scowl.get(a.word) ?? 99) - (scowl.get(b.word) ?? 99) || b.score - a.score;
  const weight = (ws: GradedWord[]) => ws.reduce((n, w) => n + 4 - w.closeness, 0);

  // Keep the biggest meanings; fold tiny or overflow groups into whichever kept meaning they resemble.
  const ranked = [...groups.entries()].sort((a, b) => weight(b[1]) - weight(a[1]));
  const kept = ranked.filter(([, ws], i) => i === 0 || (ws.length >= 2 && i < MAX_SENSES));
  const keptIds = new Set(kept.map(([id]) => id));
  const keptCenter = new Map(kept.map(([id, ws]) => [id, centroid(ws.filter((w) => vec.has(w.word)).map((w) => vec.get(w.word)!))]));
  for (const [id, ws] of ranked) {
    if (keptIds.has(id)) continue;
    for (const w of ws) {
      let best = kept[0][0];
      let bestSim = -2;
      const v = vec.get(w.word);
      if (v) {
        for (const [kid, cv] of keptCenter) {
          if (cv && cosine(v, cv) > bestSim) [best, bestSim] = [kid, cosine(v, cv)];
        }
      }
      kept.find(([kid]) => kid === best)![1].push(w);
    }
  }

  const senses: GradedSense[] = kept.map(([id, words]) => {
    const meta = c.senses.find((x) => x.id === id);
    words.sort(byStrength);
    // Label with the strongest word that WordNet itself ties to this meaning, so labels match definitions.
    const anchor = words.find((w) => wnSense.get(w.word) === id) ?? words[0];
    return {
      label: anchor.word,
      definition: meta?.definition ?? wikS?.senses[0]?.gloss ?? '',
      pos: POS_NAME[meta?.pos ?? (WIK_POS[wikS?.senses[0]?.pos ?? ''] ?? 'adj')],
      words,
    };
  });

  // ---- bluff decoys: related words of the same kind that are not synonyms ----
  const posCount = new Map<string, number>();
  for (const sense of senses) posCount.set(sense.pos, (posCount.get(sense.pos) ?? 0) + sense.words.length);
  const mainPosName = [...posCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'adjective';
  const mainPos = (Object.keys(POS_NAME) as Pos[]).find((p) => POS_NAME[p] === mainPosName)!;
  const taken = new Set([...accepted.map((g) => g.word), ...antonyms, s]);
  const sv = vec.get(s);
  const decoys = [...new Set([...rejected.map((r) => r.word), ...(src.decoyPool.get(mainPos) ?? [])])]
    .filter(
      (w) =>
        !taken.has(w) &&
        stem(w) !== sStem &&
        w.length >= 3 &&
        (scowl.get(w) ?? 99) <= 50 &&
        (src.vectors.rank.get(w) ?? 0) >= 400 && // skip filler words like "very" or "going"
        wnPos.get(w)?.has(mainPos),
    )
    .map((w) => ({ w, sim: sv && vec.has(w) ? cosine(sv, vec.get(w)!) : 0 }))
    .filter((d) => d.sim < 0.75)
    .sort((a, b) => b.sim - a.sim)
    .slice(0, 8)
    .map((d) => d.w);

  return { word: s, tier: c.tier, senses, decoys, flagged };
}

function printWord(g: GradedFile) {
  const shade = ['', '██', '▓▓', '░░'];
  console.log(`\n=== ${g.word} (${g.tier}) ===`);
  for (const s of g.senses) {
    console.log(`  [${s.pos}] ${s.label}: ${s.definition}`);
    for (const c of [1, 2, 3] as const) {
      const ws = s.words.filter((w) => w.closeness === c).map((w) => w.word);
      if (ws.length) console.log(`     ${shade[c]} ${ws.join(', ')}`);
    }
  }
  console.log(`  decoys: ${g.decoys.join(', ')}`);
  console.log(`  flagged (${g.flagged.length}): ${g.flagged.slice(0, 12).map((f) => `${f.word} [${f.ruling}: ${f.reason}]`).join('; ')}`);
}

if (import.meta.main) {
  console.log('Loading WordNet, Moby and SCOWL…');
  const wn = loadWordNet();
  const moby = loadMoby();
  const scowl = loadScowl();
  const starters = Object.values(STARTER_TIERS).flat();
  const files = starters.map((w) => JSON.parse(readFileSync(join(CANDIDATES_DIR, `${w}.json`), 'utf8')) as CandidateFile);
  const wik = await loadWiktionary(new Set(starters));

  // Decoy pool: common single words, grouped by WordNet part of speech.
  const decoyPool = new Map<Pos, string[]>();
  for (const [lemma, ids] of wn.senses) {
    if (!playable(lemma) || (scowl.get(lemma) ?? 99) > 50) continue;
    const pos = wn.synsets.get(ids[0])?.pos;
    if (pos) decoyPool.set(pos, [...(decoyPool.get(pos) ?? []), lemma]);
  }

  const needed = new Set<string>(starters);
  for (const f of files) f.candidates.forEach((c) => needed.add(c.word));
  for (const w of starters) wik.get(w)?.all.forEach((x) => needed.add(x));
  for (const list of decoyPool.values()) list.forEach((w) => needed.add(w));
  // Second-hop words: synonyms of each candidate (only reasonably common ones).
  for (const f of files) {
    for (const c of f.candidates.slice(0, 60)) {
      for (const w of [...(wik.get(c.word)?.all ?? []), ...(moby.get(c.word) ?? [])]) {
        if ((scowl.get(w) ?? 99) <= 60) needed.add(w);
      }
    }
  }
  const vectors = await loadVectors(needed);
  const wnPos = new Map<string, Set<Pos>>();
  for (const [lemma, ids] of wn.senses) {
    wnPos.set(lemma, new Set(ids.map((id) => wn.synsets.get(id)?.pos).filter((p): p is Pos => !!p)));
  }

  mkdirSync(GRADED_DIR, { recursive: true });
  const all = files.map((f) => grade(f, { wn, moby, scowl, wik, vectors, wnPos, decoyPool }));
  for (const g of all) writeFileSync(join(GRADED_DIR, `${g.word}.json`), JSON.stringify(g, null, 1) + '\n');

  const count = (g: GradedFile) => g.senses.reduce((n, s) => n + s.words.length, 0);
  for (const tier of ['easy', 'medium', 'hard'] as Tier[]) {
    const gs = all.filter((g) => g.tier === tier);
    const avg = (f: (g: GradedFile) => number) => Math.round(gs.reduce((n, g) => n + f(g), 0) / gs.length);
    console.log(`${tier}: avg ${avg(count)} synonyms, ${avg((g) => g.senses.length)} meanings, ${avg((g) => g.flagged.length)} flagged`);
  }
  const thin = all.filter((g) => count(g) < 15).map((g) => `${g.word} (${count(g)})`);
  if (thin.length) console.log('Thin word lists:', thin.join(', '));
  console.log(`Wrote ${all.length} files to ${GRADED_DIR}`);

  for (const w of process.argv.slice(2)) {
    const g = all.find((x) => x.word === w);
    if (g) printWord(g);
  }
}
