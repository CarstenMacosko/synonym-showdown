// Step 4: Claude reviews each starter word's candidates. It keeps real synonyms, sorts them into meanings,
// grades how close each one is (1–3), adds common synonyms the sources missed, and picks bluff decoys.
// Results go to reviewed/<word>.json, which are committed to git and can be hand-edited afterwards.
//
// Needs an Anthropic API key in tools/wordbank/.env (ANTHROPIC_API_KEY=...), which git ignores.
//
//   npm run words:review -- happy run obstinate   review a few words now (full price, ~1 min each)
//   npm run words:review -- --batch               submit every unreviewed word as one batch (half price)
//   npm run words:review -- --batch               run again later to collect the results

import Anthropic from '@anthropic-ai/sdk';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CandidateFile } from './candidates.ts';
import { CANDIDATES_DIR } from './candidates.ts';
import { STARTER_TIERS } from './starters.ts';

export const REVIEWED_DIR = join(import.meta.dirname, 'reviewed');
const BATCH_FILE = join(REVIEWED_DIR, '.pending-batch.json');

const MODEL = 'claude-opus-5-5';
// Opus 5.5 prices per million tokens; batches cost half.
const PRICE = { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2 };

export interface ReviewedWord {
  word: string;
  closeness: 1 | 2 | 3;
  /** True when Claude added it (it wasn't among the source candidates). */
  added: boolean;
}

export interface ReviewedSense {
  label: string;
  definition: string;
  pos: 'adjective' | 'noun' | 'verb' | 'adverb';
  words: ReviewedWord[];
}

export interface ReviewedFile {
  word: string;
  tier: string;
  suggestedTier: 'easy' | 'medium' | 'hard';
  senses: ReviewedSense[];
  decoys: string[];
  notes: string;
  model: string;
}

// The shared instructions. Identical for every request so prompt caching can reuse them.
const SYSTEM = `You are building the answer key for Synonym Showdown, a word game. Players get a starter word and take turns typing synonyms of it. Any player may challenge the previous word; the answer key decides who is right. Your rulings must be fair, defensible, and match what a good general-purpose thesaurus (such as thesaurus.com or Merriam-Webster's thesaurus) would accept.

You will receive one starter word, its dictionary meanings from WordNet, and a list of candidate words gathered automatically from WordNet and the Moby Thesaurus. The candidate list is deliberately generous and noisy.

Produce the answer key for this starter word:

1. Meanings ("senses"). Group the synonyms under the distinct meanings of the starter word that ordinary English speakers know. Merge WordNet meanings that are near-duplicates. Drop meanings that are archaic, highly technical, or so rare that players would never think of them. Order meanings from most to least common. Give each a short label (one to three words, lowercase, e.g. "joyful", "fortunate", "willing") and a plain-English definition of at most twelve words. Cover each part of speech the starter commonly has (for example "fight" as a verb and as a noun).

2. Synonyms. For each meaning, list the words that a player could fairly claim are synonyms of the starter in that meaning. Each accepted word appears under exactly one meaning: the one it fits best. Grade each with closeness:
   - 1 = core synonym: interchangeable with the starter in most sentences for that meaning (happy → glad, joyful, cheerful).
   - 2 = solid synonym: a thesaurus lists it, but it differs in intensity, tone, or register, or only fits some contexts (happy → ecstatic, chipper, content).
   - 3 = distant synonym: a thesaurus would still list it, but most people would call it related rather than equivalent (happy → upbeat, sunny, carefree).
   Reject: antonyms; words that are merely associated (happy → party, smile); words for a different part of speech than the meaning unless thesauruses commonly cross over; obscure, archaic, or dialect words almost no player would know; slurs and crude sexual terms; inflected forms or derivatives of the starter itself (happily, happiness).
   Use single words or hyphenated compounds only, in lowercase base form (no plurals, no -ing/-ed forms unless that form is itself the dictionary word). Prefer American spelling and add a British variant after a slash when it differs ("color/colour").
   You may add common synonyms that are missing from the candidates, marked added=true, only when you are confident a mainstream thesaurus lists them. Do not pad the list; quality beats quantity. A typical everyday starter ends up with 40 to 90 accepted words; a narrow word may have 15.

3. Decoys: eight common words that sound plausible as synonyms but are not (happy → lucky, excited, funny, friendly). Computer opponents bluff with these, so they must be clearly rejectable on challenge, must not appear among the accepted synonyms, and should be words most players know.

4. suggestedTier: how hard the starter is to play, from the point of view of a typical teenage or adult player: easy (everyday word with many obvious synonyms), medium (familiar word that needs some thought), hard (advanced vocabulary).

5. notes: one or two sentences flagging anything a human editor should double-check (a borderline meaning you dropped, a ruling you were unsure about). Empty string if nothing.`;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['senses', 'decoys', 'suggestedTier', 'notes'],
  properties: {
    senses: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'definition', 'pos', 'words'],
        properties: {
          label: { type: 'string' },
          definition: { type: 'string' },
          pos: { type: 'string', enum: ['adjective', 'noun', 'verb', 'adverb'] },
          words: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['word', 'closeness', 'added'],
              properties: {
                word: { type: 'string' },
                closeness: { type: 'integer', enum: [1, 2, 3] },
                added: { type: 'boolean' },
              },
            },
          },
        },
      },
    },
    decoys: { type: 'array', items: { type: 'string' } },
    suggestedTier: { type: 'string', enum: ['easy', 'medium', 'hard'] },
    notes: { type: 'string' },
  },
};

const POS_NAME = { adj: 'adjective', noun: 'noun', verb: 'verb', adv: 'adverb' } as const;

/** The per-word part of the prompt: meanings plus candidates tagged with the meaning they came from. */
function userPrompt(c: CandidateFile): string {
  const senseIndex = new Map(c.senses.map((s, i) => [s.id, i + 1]));
  const senses = c.senses
    .map((s, i) => {
      const ex = s.examples.length ? ` (e.g. "${s.examples[0]}")` : '';
      return `  m${i + 1} [${POS_NAME[s.pos]}] ${s.definition}${ex}`;
    })
    .join('\n');
  const candidates = c.candidates
    .map((cand) => {
      const tags = cand.senses.map((id) => `m${senseIndex.get(id)}`);
      if (cand.sources.includes('moby')) tags.push('moby');
      return `${cand.word} (${tags.join(',')})`;
    })
    .join(', ');
  return `Starter word: "${c.word}"

WordNet meanings:
${senses || '  (none found)'}

Candidates (tags show which WordNet meaning linked them, or "moby" for the Moby Thesaurus):
${candidates}`;
}

function params(c: CandidateFile) {
  return {
    model: MODEL,
    max_tokens: 16000,
    system: [{ type: 'text' as const, text: SYSTEM, cache_control: { type: 'ephemeral' as const } }],
    output_config: { effort: 'medium' as const, format: { type: 'json_schema' as const, schema: SCHEMA } },
    messages: [{ role: 'user' as const, content: userPrompt(c) }],
  };
}

function loadCandidates(word: string): CandidateFile {
  const file = join(CANDIDATES_DIR, `${word}.json`);
  if (!existsSync(file)) throw new Error(`No candidates for "${word}". Run: npm run words:candidates`);
  return JSON.parse(readFileSync(file, 'utf8'));
}

function save(c: CandidateFile, message: { content: Anthropic.ContentBlock[] | Anthropic.Beta.BetaContentBlock[]; model: string }) {
  const text = message.content.find((b) => b.type === 'text');
  if (!text || text.type !== 'text') throw new Error(`No JSON answer for "${c.word}"`);
  const answer = JSON.parse(text.text);
  const reviewed: ReviewedFile = { word: c.word, tier: c.tier, ...answer, model: message.model };
  writeFileSync(join(REVIEWED_DIR, `${c.word}.json`), JSON.stringify(reviewed, null, 1) + '\n');
  const count = reviewed.senses.reduce((n, s) => n + s.words.length, 0);
  console.log(`✓ ${c.word}: ${reviewed.senses.length} meanings, ${count} synonyms${reviewed.notes ? `  (note: ${reviewed.notes})` : ''}`);
}

function cost(u: Anthropic.Usage | Anthropic.Beta.BetaUsage, discount = 1): number {
  return (
    discount *
    ((u.input_tokens * PRICE.input +
      (u.cache_creation_input_tokens ?? 0) * PRICE.cacheWrite +
      (u.cache_read_input_tokens ?? 0) * PRICE.cacheRead +
      u.output_tokens * PRICE.output) /
      1e6)
  );
}

/** Review the given words right away, one request each. */
async function reviewNow(client: Anthropic, words: string[]) {
  let total = 0;
  for (const word of words) {
    const c = loadCandidates(word);
    const message = await client.beta.messages.create({
      ...params(c),
      // If a safety filter ever declines (very unlikely for a thesaurus task), retry on a fallback model.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    });
    if (message.stop_reason === 'refusal') {
      console.log(`✗ ${word}: declined (${message.stop_details?.category ?? 'no category'})`);
      continue;
    }
    if (message.stop_reason === 'max_tokens') {
      console.log(`✗ ${word}: answer was cut off; raise max_tokens`);
      continue;
    }
    save(c, message);
    const spent = cost(message.usage);
    total += spent;
    console.log(`  ${message.usage.input_tokens} in + ${message.usage.output_tokens} out tokens, $${spent.toFixed(3)}`);
  }
  console.log(`Total: $${total.toFixed(2)}`);
}

/** Submit every unreviewed starter as one batch, or collect a batch submitted earlier. */
async function reviewBatch(client: Anthropic) {
  if (existsSync(BATCH_FILE)) {
    const { id } = JSON.parse(readFileSync(BATCH_FILE, 'utf8'));
    const batch = await client.messages.batches.retrieve(id);
    if (batch.processing_status !== 'ended') {
      const n = batch.request_counts;
      console.log(`Batch ${id} still running: ${n.succeeded} done, ${n.processing} in progress. Try again in a few minutes.`);
      return;
    }
    let total = 0;
    const failed: string[] = [];
    for await (const result of await client.messages.batches.results(id)) {
      const word = result.custom_id;
      if (result.result.type === 'succeeded' && result.result.message.stop_reason === 'end_turn') {
        save(loadCandidates(word), result.result.message);
        total += cost(result.result.message.usage, 0.5);
      } else {
        failed.push(word);
      }
    }
    unlinkSync(BATCH_FILE);
    console.log(`Batch cost: $${total.toFixed(2)}`);
    if (failed.length) console.log(`Not reviewed (run --batch again to retry): ${failed.join(', ')}`);
    return;
  }

  const todo = Object.values(STARTER_TIERS)
    .flat()
    .filter((w) => !existsSync(join(REVIEWED_DIR, `${w}.json`)));
  if (!todo.length) return console.log('Every starter word is already reviewed.');
  const batch = await client.messages.batches.create({
    requests: todo.map((word) => ({ custom_id: word, params: params(loadCandidates(word)) })),
  });
  writeFileSync(BATCH_FILE, JSON.stringify({ id: batch.id, words: todo }, null, 1));
  console.log(`Submitted ${todo.length} words as batch ${batch.id}. Most batches finish within an hour;`);
  console.log('run this command again to collect the results.');
}

if (import.meta.main) {
  mkdirSync(REVIEWED_DIR, { recursive: true });
  const args = process.argv.slice(2);
  const client = new Anthropic();
  try {
    if (args.includes('--batch')) await reviewBatch(client);
    else if (args.length) await reviewNow(client, args);
    else console.log('Usage: npm run words:review -- <word> [word…]   or   npm run words:review -- --batch');
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      console.error('The API key was rejected. Check ANTHROPIC_API_KEY in tools/wordbank/.env');
    } else if (error instanceof Anthropic.RateLimitError) {
      console.error('Rate limited. Wait a minute and run the same command again.');
    } else if (error instanceof Anthropic.APIError) {
      console.error(`API error ${error.status}: ${error.message}`);
    } else {
      throw error;
    }
    process.exitCode = 1;
  }
}
