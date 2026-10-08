// Messages between the browser and the online game server (worker/room.ts, worker/matchmaker.ts).
// The server is the referee: browsers only send intentions ("say this word"), never results.

import type { BotLevel, GameEvent, Settings } from './engine.ts';
import type { StarterWord, Tier } from './words.ts';

export const ROOM_CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I or O (look like 1 and 0)
export const ROOM_CODE_RE = /^[A-HJ-NP-Z]{4}$/;
export const MAX_ROOM_PLAYERS = 6;
export const EMOTES = ['👍', '😂', '😮', '🤔', '🔥', 'GG'] as const;
export type Emote = (typeof EMOTES)[number];

/** Settings every ranked game uses, so ratings compare like with like. */
export const RANKED_SETTINGS: Settings = {
  tier: 'medium',
  timeControl: 'rapid',
  forgiveness: 'strict',
  afterElimination: 'newWord',
  range: 'standard',
};

export type ClientMessage =
  | { t: 'hello'; name: string; key?: string }
  | { t: 'settings'; settings: Settings }
  | { t: 'start' }
  | { t: 'say'; word: string; typedMs?: number | null; pasted?: boolean; touch?: boolean }
  | { t: 'challenge' }
  | { t: 'emote'; emote: Emote }
  | { t: 'again' }
  | { t: 'ping' };

export interface RoomPlayerView {
  id: string;
  name: string;
  color: string;
  connected: boolean;
  guest: boolean;
  /** Tagged by the cheat detector ("under review"). */
  flagged: boolean;
  /** Ranked rating, shown for signed-in players. */
  rating: number | null;
  alive: boolean;
  bankMs: number;
}

export interface PlayView {
  starter: { word: string; tier: Tier };
  chain: { playerId: string; word: string; rejected?: boolean; confirmed?: boolean }[];
  currentId: string;
  phase: 'playing' | 'result' | 'over';
  /** Time left for the current player when this message was sent. */
  timeLeftMs: number;
  /** Full length of a turn (or chess-clock bank), for drawing timer bars. */
  budgetMs: number;
  canChallenge: boolean;
  lastEvent: GameEvent | null;
  eventCount: number;
}

export interface ResultView {
  places: { id: string; name: string; place: number }[];
  /** Rating change per player id (ranked games only). */
  ratingChanges: Record<string, { before: number; after: number }>;
  /** The last starter word with all its synonyms, for the end-screen meaning map. */
  starter: StarterWord;
  said: string[];
}

export interface RoomView {
  code: string;
  you: string;
  /** Secret that lets this browser rejoin its seat after a disconnect. */
  key: string;
  hostId: string;
  ranked: boolean;
  settings: Settings;
  stage: 'lobby' | 'playing' | 'over';
  players: RoomPlayerView[];
  play: PlayView | null;
  result: ResultView | null;
}

export type ServerMessage =
  | { t: 'room'; room: RoomView }
  | { t: 'error'; message: string }
  | { t: 'emote'; playerId: string; emote: Emote }
  | { t: 'pong' };

export type QueueMessage =
  | { t: 'waiting'; inQueue: number }
  | { t: 'matched'; code: string }
  | { t: 'error'; message: string };

// Re-exported so the UI can import everything online-related from one place.
export type { BotLevel };
