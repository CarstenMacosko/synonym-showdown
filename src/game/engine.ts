// The rules of Synonym Showdown as pure functions: (state, action) -> new state.
// No timers, DOM or randomness of its own; the caller passes `now` and `rng`,
// so the same code can referee a solo game in the browser or an online game on a server.

import { findSynonym, isSameWord, type Forgiveness } from './match';
import { startersForTier, type StarterWord, type Tier } from './words';

export type TimeControl = 'blitz' | 'rapid' | 'clock';
export type AfterElimination = 'newWord' | 'sameWord';
export type BotLevel = 'easy' | 'medium' | 'hard';
export type Rng = () => number;

export const TIME_CONTROLS: Record<TimeControl, { label: string; detail: string; turnMs?: number; bankMs?: number }> = {
  blitz: { label: 'Blitz', detail: '10s a turn', turnMs: 10_000 },
  rapid: { label: 'Rapid', detail: '20s a turn', turnMs: 20_000 },
  clock: { label: 'Chess clock', detail: '60s total each', bankMs: 60_000 },
};

export interface Settings {
  tier: Tier;
  timeControl: TimeControl;
  forgiveness: Forgiveness;
  afterElimination: AfterElimination;
}

export interface PlayerSetup {
  id: string;
  name: string;
  isBot: boolean;
  botLevel?: BotLevel;
  color: string;
}

export interface Player extends PlayerSetup {
  alive: boolean;
  /** Chess-clock time remaining (unused for per-turn time controls). */
  bankMs: number;
}

export interface Play {
  playerId: string;
  word: string;
  /** Set once a challenge proved the word was not a synonym. */
  rejected?: boolean;
  /** Set once a challenge proved the word was a synonym. */
  confirmed?: boolean;
}

export type GameEvent =
  | {
      kind: 'challenge';
      challengerId: string;
      accusedId: string;
      word: string;
      valid: boolean;
      canonical: string | null;
      eliminatedId: string;
    }
  | { kind: 'timeout'; playerId: string; eliminatedId: string };

export interface GameState {
  settings: Settings;
  players: Player[];
  starter: StarterWord;
  usedStarters: string[];
  /** Words said for the current starter word. */
  chain: Play[];
  /** Whether the last word in the chain can still be challenged. */
  challengeable: boolean;
  currentId: string;
  turnStartedAt: number;
  phase: 'playing' | 'result' | 'over';
  lastEvent: GameEvent | null;
  log: GameEvent[];
  winnerId: string | null;
  /** Total words said this game (for stats / end screen). */
  wordsSaid: number;
}

export type SubmitError = 'empty' | 'starter' | 'repeat' | 'notYourTurn';

// ---------- helpers ----------

export function player(state: GameState, id: string): Player {
  const p = state.players.find((x) => x.id === id);
  if (!p) throw new Error(`unknown player ${id}`);
  return p;
}

export function alivePlayers(state: GameState): Player[] {
  return state.players.filter((p) => p.alive);
}

/** The next living player after `id` in seating order. */
export function nextAliveAfter(state: GameState, id: string): string {
  const n = state.players.length;
  const start = state.players.findIndex((p) => p.id === id);
  for (let i = 1; i <= n; i++) {
    const p = state.players[(start + i) % n];
    if (p.alive) return p.id;
  }
  return id;
}

export function lastPlay(state: GameState): Play | null {
  return state.chain.length ? state.chain[state.chain.length - 1] : null;
}

/** Can the current player challenge right now? Only the word directly before them is challengeable. */
export function canChallenge(state: GameState): boolean {
  const prev = lastPlay(state);
  return state.phase === 'playing' && state.challengeable && !!prev && prev.playerId !== state.currentId;
}

/** Milliseconds the current player has left before timing out. */
export function timeLeft(state: GameState, now: number): number {
  const tc = TIME_CONTROLS[state.settings.timeControl];
  const elapsed = now - state.turnStartedAt;
  if (tc.bankMs !== undefined) return player(state, state.currentId).bankMs - elapsed;
  return (tc.turnMs ?? 0) - elapsed;
}

/** Total time a turn can last (used for drawing timer bars). */
export function turnBudget(state: GameState): number {
  const tc = TIME_CONTROLS[state.settings.timeControl];
  return tc.bankMs ?? tc.turnMs ?? 1;
}

function pickStarter(tier: Tier, used: string[], rng: Rng): StarterWord {
  const pool = startersForTier(tier);
  const fresh = pool.filter((s) => !used.includes(s.word));
  const from = fresh.length ? fresh : pool;
  return from[Math.floor(rng() * from.length)];
}

/** Charge the current player's chess clock for the time this turn took. */
function chargeClock(state: GameState, now: number): Player[] {
  if (state.settings.timeControl !== 'clock') return state.players;
  const elapsed = now - state.turnStartedAt;
  return state.players.map((p) => (p.id === state.currentId ? { ...p, bankMs: Math.max(0, p.bankMs - elapsed) } : p));
}

function eliminate(state: GameState, players: Player[], event: GameEvent): GameState {
  const updated = players.map((p) => (p.id === event.eliminatedId ? { ...p, alive: false } : p));
  return { ...state, players: updated, phase: 'result', lastEvent: event, log: [...state.log, event] };
}

// ---------- actions ----------

export function createGame(settings: Settings, setups: PlayerSetup[], rng: Rng, now: number): GameState {
  const tc = TIME_CONTROLS[settings.timeControl];
  const players = setups.map((s) => ({ ...s, alive: true, bankMs: tc.bankMs ?? 0 }));
  const starter = pickStarter(settings.tier, [], rng);
  return {
    settings,
    players,
    starter,
    usedStarters: [starter.word],
    chain: [],
    challengeable: false,
    currentId: players[Math.floor(rng() * players.length)].id, // random first player
    turnStartedAt: now,
    phase: 'playing',
    lastEvent: null,
    log: [],
    winnerId: null,
    wordsSaid: 0,
  };
}

/** Checks a word without playing it. Returns an error, or null if it may be played. */
/**
 * The earlier play that `raw` repeats, if any: the same word, another form of it ("joyfully" after "joyful"),
 * or another spelling ("wilful" after "willful"). Used to block repeats and to warn players while they type.
 */
export function findRepeat(state: GameState, raw: string): { play: Play; index: number } | null {
  const word = raw.trim();
  if (!/[a-z]{2,}/i.test(word)) return null;
  const f = state.settings.forgiveness;
  // Compare by the synonym it resolves to (so "cheerfull" repeats "cheerful" in typo mode) and by form.
  const canon = findSynonym(word, state.starter, f);
  const index = state.chain.findIndex(
    (play) => isSameWord(word, play.word, f) || (canon !== null && findSynonym(play.word, state.starter, f) === canon),
  );
  return index === -1 ? null : { play: state.chain[index], index };
}

export function checkWord(state: GameState, raw: string): SubmitError | null {
  const word = raw.trim();
  if (!/[a-z]{2,}/i.test(word)) return 'empty';
  if (isSameWord(word, state.starter.word, state.settings.forgiveness)) return 'starter';
  if (findRepeat(state, word)) return 'repeat';
  return null;
}

export function submitWord(
  state: GameState,
  playerId: string,
  raw: string,
  now: number,
): { state: GameState; error: SubmitError | null } {
  if (state.phase !== 'playing' || playerId !== state.currentId) return { state, error: 'notYourTurn' };
  const error = checkWord(state, raw);
  if (error) return { state, error };
  const players = chargeClock(state, now);
  return {
    error: null,
    state: {
      ...state,
      players,
      chain: [...state.chain, { playerId, word: raw.trim().toLowerCase() }],
      challengeable: true,
      currentId: nextAliveAfter(state, playerId),
      turnStartedAt: now,
      wordsSaid: state.wordsSaid + 1,
    },
  };
}

/** The current player challenges the word just played. Someone is eliminated either way. */
export function challenge(state: GameState, playerId: string, now: number): GameState {
  if (playerId !== state.currentId || !canChallenge(state)) return state;
  const prev = lastPlay(state)!;
  const canonical = findSynonym(prev.word, state.starter, state.settings.forgiveness);
  const valid = canonical !== null;
  const eliminatedId = valid ? playerId : prev.playerId;
  const chain = state.chain.map((p, i) =>
    i === state.chain.length - 1 ? { ...p, rejected: !valid, confirmed: valid } : p,
  );
  return eliminate({ ...state, chain, challengeable: false }, chargeClock(state, now), {
    kind: 'challenge',
    challengerId: playerId,
    accusedId: prev.playerId,
    word: prev.word,
    valid,
    canonical,
    eliminatedId,
  });
}

/** Call when timeLeft() hits zero. The current player is eliminated. */
export function timeout(state: GameState, now: number): GameState {
  if (state.phase !== 'playing' || timeLeft(state, now) > 0) return state;
  const players = chargeClock(state, now);
  return eliminate({ ...state, challengeable: false }, players, {
    kind: 'timeout',
    playerId: state.currentId,
    eliminatedId: state.currentId,
  });
}

/** After the result has been shown: end the game, or start the next round. */
export function continueGame(state: GameState, rng: Rng, now: number): GameState {
  if (state.phase !== 'result' || !state.lastEvent) return state;
  const alive = alivePlayers(state);
  if (alive.length <= 1) {
    return { ...state, phase: 'over', winnerId: alive[0]?.id ?? null };
  }
  const nextId = nextAliveAfter(state, state.lastEvent.eliminatedId);
  if (state.settings.afterElimination === 'sameWord') {
    return { ...state, phase: 'playing', currentId: nextId, turnStartedAt: now };
  }
  const starter = pickStarter(state.settings.tier, state.usedStarters, rng);
  return {
    ...state,
    phase: 'playing',
    starter,
    usedStarters: [...state.usedStarters, starter.word],
    chain: [],
    challengeable: false,
    currentId: nextId,
    turnStartedAt: now,
  };
}
