// One online game room (one Durable Object per room code).
//
// The room is the referee: it runs the same rules as the solo game (src/game/engine.ts), owns the clock
// (turn timeouts fire as Durable Object alarms), and sends each player a view of the game that never
// includes the hidden list of synonyms. Browsers only send intentions: "say this word", "challenge".
//
// Uses the WebSocket Hibernation API, so an idle room costs nothing; everything that matters is saved
// in Durable Object storage after each change.

import { DurableObject } from 'cloudflare:workers';
import {
  canChallenge,
  challenge,
  continueGame,
  createGame,
  submitWord,
  TIME_CONTROLS,
  timeLeft,
  timeout,
  turnBudget,
  type GameState,
  type Settings,
  type SubmitError,
} from '../src/game/engine.ts';
import { findEntry } from '../src/game/match.ts';
import {
  EMOTES,
  MAX_ROOM_PLAYERS,
  RANKED_SETTINGS,
  type ClientMessage,
  type RoomView,
  type ServerMessage,
} from '../src/game/protocol.ts';
import { assessPlay, type WordStat } from '../src/game/suspicion.ts';
import { RANGE_MAX } from '../src/game/words.ts';
import { flagUser, recordMatch } from './records.ts';

const COLORS = ['#4dabf7', '#ff8787', '#69db7c', '#ffd43b', '#da77f2', '#ffa94d'];
const RESULT_MS = 4200;
const EMPTY_ROOM_TTL_MS = 30 * 60_000;
const MAX_MSGS_PER_10S = 40;
/** A ranked opponent who doesn't connect within this time forfeits the match-up (nobody is rated). */
const RANKED_JOIN_MS = 45_000;

export interface SocketUser {
  id: number;
  username: string;
  rating: number;
}

interface Seat {
  id: string;
  /** Secret that lets the same browser take this seat back after a disconnect. */
  key: string;
  name: string;
  color: string;
  userId: number | null;
  rating: number | null;
  connected: boolean;
}

interface Room {
  code: string;
  createdAt: number;
  ranked: boolean;
  /** Ranked rooms only admit the two matched accounts. */
  allowedUsers: number[] | null;
  hostId: string | null;
  settings: Settings;
  stage: 'lobby' | 'playing' | 'over';
  seats: Seat[];
  game: GameState | null;
  starters: string[];
  /** Per seat: how each word went, for the cheat detector. */
  stats: Record<string, WordStat[]>;
  /** Seat ids in the order they were knocked out. */
  out: string[];
  resultAt: number | null;
  result: RoomView['result'];
  emptySince: number | null;
}

interface Attachment {
  seat: string | null;
  user: SocketUser | null;
  window: number;
  count: number;
}

const DEFAULT_SETTINGS: Settings = { tier: 'easy', timeControl: 'rapid', forgiveness: 'typos', afterElimination: 'newWord', range: 'standard' };

const ERRORS: Record<SubmitError, string> = {
  empty: 'Type a word first!',
  starter: 'That’s the starter word!',
  repeat: 'Already said!',
  notYourTurn: 'Wait for your turn!',
};

function cleanName(raw: unknown): string {
  const name = typeof raw === 'string' ? raw.replace(/[^\p{L}\p{N} _'-]/gu, '').trim().slice(0, 16) : '';
  return name || 'Guest';
}

function validSettings(s: unknown): Settings | null {
  if (!s || typeof s !== 'object') return null;
  const x = s as Record<string, unknown>;
  const ok =
    ['easy', 'medium', 'hard'].includes(x.tier as string) &&
    (x.timeControl as string) in TIME_CONTROLS &&
    ['strict', 'typos', 'soundalike'].includes(x.forgiveness as string) &&
    ['newWord', 'sameWord'].includes(x.afterElimination as string) &&
    ['close', 'standard', 'loose'].includes(x.range as string);
  return ok ? (x as unknown as Settings) : null;
}

export class GameRoom extends DurableObject<Env> {
  private room: Room | null = null;

  private async load(): Promise<Room | null> {
    this.room ??= (await this.ctx.storage.get<Room>('room')) ?? null;
    return this.room;
  }

  private async save(): Promise<void> {
    if (this.room) await this.ctx.storage.put('room', this.room);
  }

  /** Called by the Worker when it hands out a room code. Returns false if the code is in use. */
  async init(opts: { code: string; ranked: boolean; allowedUsers: number[] | null }): Promise<boolean> {
    const existing = await this.load();
    if (existing && (existing.seats.some((s) => s.connected) || Date.now() - existing.createdAt < 10 * 60_000)) return false;
    this.room = {
      code: opts.code,
      createdAt: Date.now(),
      ranked: opts.ranked,
      allowedUsers: opts.allowedUsers,
      hostId: null,
      settings: opts.ranked ? RANKED_SETTINGS : DEFAULT_SETTINGS,
      stage: 'lobby',
      seats: [],
      game: null,
      starters: [],
      stats: {},
      out: [],
      resultAt: null,
      result: null,
      emptySince: Date.now(),
    };
    await this.save();
    await this.ctx.storage.setAlarm(Date.now() + (opts.ranked ? RANKED_JOIN_MS : EMPTY_ROOM_TTL_MS));
    return true;
  }

  /** WebSocket upgrade, forwarded by the Worker with the signed-in user (if any) in a trusted header. */
  async fetch(req: Request): Promise<Response> {
    if (req.headers.get('upgrade') !== 'websocket') return new Response('expected websocket', { status: 426 });
    const room = await this.load();
    if (!room) return new Response('no such room', { status: 404 });
    const header = req.headers.get('x-ss-user');
    const user = header ? (JSON.parse(header) as SocketUser) : null;
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    pair[1].serializeAttachment({ seat: null, user, window: Date.now(), count: 0 } satisfies Attachment);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  async webSocketMessage(ws: WebSocket, data: string | ArrayBuffer): Promise<void> {
    if (typeof data !== 'string' || data.length > 2_000) return;
    const att = ws.deserializeAttachment() as Attachment;
    // Per-connection flood protection.
    const now = Date.now();
    if (now - att.window > 10_000) Object.assign(att, { window: now, count: 0 });
    if (++att.count > MAX_MSGS_PER_10S) return;
    ws.serializeAttachment(att);

    let msg: ClientMessage;
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }
    const room = await this.load();
    if (!room) return this.send(ws, { t: 'error', message: 'This room has closed.' });

    if (msg.t === 'ping') return this.send(ws, { t: 'pong' });
    if (msg.t === 'hello') return this.hello(ws, att, room, msg);

    const seat = room.seats.find((s) => s.id === att.seat);
    if (!seat) return;
    switch (msg.t) {
      case 'settings': {
        const settings = validSettings(msg.settings);
        if (settings && room.stage === 'lobby' && !room.ranked && seat.id === room.hostId) {
          room.settings = settings;
          await this.commit();
        }
        return;
      }
      case 'start':
        if (room.stage === 'lobby' && seat.id === room.hostId && !room.ranked) await this.start();
        else if (room.stage === 'lobby' && seat.id === room.hostId) this.send(ws, { t: 'error', message: 'Waiting for your opponent.' });
        return;
      case 'say':
        return this.say(ws, seat, typeof msg.word === 'string' ? msg.word.slice(0, 40) : '');
      case 'challenge': {
        const game = room.game;
        if (room.stage !== 'playing' || !game || game.currentId !== seat.id || !canChallenge(game)) return;
        room.game = challenge(game, seat.id, now);
        this.noteKnockout();
        return this.commit();
      }
      case 'emote':
        if (EMOTES.includes(msg.emote)) this.broadcastRaw({ t: 'emote', playerId: seat.id, emote: msg.emote });
        return;
      case 'again':
        if (room.stage === 'over' && seat.id === room.hostId && !room.ranked) {
          Object.assign(room, { stage: 'lobby', game: null, result: null, starters: [], stats: {}, out: [], resultAt: null });
          room.seats = room.seats.filter((s) => s.connected);
          await this.commit();
        }
        return;
    }
  }

  private async hello(ws: WebSocket, att: Attachment, room: Room, msg: Extract<ClientMessage, { t: 'hello' }>) {
    const user = att.user;
    // Rejoin: same secret key, or the same account in another tab.
    let seat = room.seats.find((s) => (msg.key && s.key === msg.key) || (user && s.userId === user.id));
    if (!seat) {
      if (room.stage !== 'lobby') return this.send(ws, { t: 'error', message: 'That game has already started.' });
      if (room.ranked && (!user || !room.allowedUsers?.includes(user.id))) {
        return this.send(ws, { t: 'error', message: 'This is a ranked match for two other players.' });
      }
      if (room.seats.length >= MAX_ROOM_PLAYERS) return this.send(ws, { t: 'error', message: 'This room is full.' });
      const used = new Set(room.seats.map((s) => s.color));
      seat = {
        id: crypto.randomUUID().slice(0, 8),
        key: crypto.randomUUID(),
        // Signed-in players always appear under their username, so nobody can pose as them.
        name: user ? user.username : cleanName(msg.name),
        color: COLORS.find((c) => !used.has(c)) ?? COLORS[0],
        userId: user?.id ?? null,
        rating: user ? Math.round(user.rating) : null,
        connected: true,
      };
      room.seats.push(seat);
    }
    // One live connection per seat: close any older tab.
    for (const other of this.ctx.getWebSockets()) {
      if (other !== ws && (other.deserializeAttachment() as Attachment).seat === seat.id) other.close(4000, 'Opened in another tab');
    }
    seat.connected = true;
    room.hostId ??= seat.id;
    room.emptySince = null;
    att.seat = seat.id;
    ws.serializeAttachment(att);
    // Ranked games start as soon as both matched players are here.
    if (room.ranked && room.stage === 'lobby' && room.seats.filter((s) => s.connected).length === 2) return this.start();
    await this.commit();
  }

  private async start() {
    const room = this.room!;
    const players = room.seats.filter((s) => s.connected);
    if (players.length < 2) {
      const host = this.socketFor(room.hostId);
      if (host) this.send(host, { t: 'error', message: 'You need at least 2 players.' });
      return;
    }
    room.seats = players;
    room.game = createGame(
      room.settings,
      players.map((s) => ({ id: s.id, name: s.name, isBot: false, color: s.color })),
      Math.random,
      Date.now(),
    );
    Object.assign(room, { stage: 'playing', starters: [room.game.starter.word], stats: {}, out: [], result: null });
    await this.commit();
  }

  private async say(ws: WebSocket, seat: Seat, word: string) {
    const room = this.room!;
    const game = room.game;
    if (room.stage !== 'playing' || !game) return;
    if (game.currentId !== seat.id || game.phase !== 'playing') return this.send(ws, { t: 'error', message: ERRORS.notYourTurn });
    const now = Date.now();
    const r = submitWord(game, seat.id, word, now);
    if (r.error) return this.send(ws, { t: 'error', message: ERRORS[r.error] });
    // How this word would rule, for the cheat detector (never shown to anyone).
    const entry = findEntry(word, game.starter, game.settings.forgiveness);
    const valid = !!entry && entry.closeness <= RANGE_MAX[game.settings.range];
    (room.stats[seat.id] ??= []).push({ valid, rarity: valid ? entry!.rarity : null, ms: now - game.turnStartedAt });
    room.game = r.state;
    await this.commit();
  }

  private noteKnockout() {
    const ev = this.room?.game?.lastEvent;
    if (ev) this.room!.out.push(ev.eliminatedId);
  }

  /** Timers: turn timeouts, moving on after a result, and cleaning up empty rooms. */
  async alarm(): Promise<void> {
    const room = await this.load();
    if (!room) return;
    const now = Date.now();
    const game = room.game;
    if (room.stage === 'playing' && game) {
      if (game.phase === 'playing' && timeLeft(game, now) <= 0) {
        room.game = timeout(game, now);
        this.noteKnockout();
      } else if (game.phase === 'result' && room.resultAt && now >= room.resultAt) {
        const next = continueGame(game, Math.random, now);
        if (next.phase === 'over') return this.finish(next);
        if (next.starter.word !== game.starter.word) room.starters.push(next.starter.word);
        room.game = next;
      }
      return this.commit();
    }
    if (room.ranked && room.stage === 'lobby' && now - room.createdAt >= RANKED_JOIN_MS) {
      // The other player never showed up: send whoever is here back to the queue.
      for (const ws of this.ctx.getWebSockets()) ws.close(4001, 'Opponent did not connect');
      this.room = null;
      await this.ctx.storage.deleteAll();
      return;
    }
    if (!room.seats.some((s) => s.connected) && room.emptySince && now - room.emptySince >= EMPTY_ROOM_TTL_MS) {
      this.room = null;
      await this.ctx.storage.deleteAll();
      return;
    }
    await this.scheduleAlarm();
  }

  private async finish(final: GameState) {
    const room = this.room!;
    room.game = final;
    room.stage = 'over';
    room.resultAt = null;
    // Winner first, then the reverse of the knockout order.
    const order = [final.winnerId, ...[...room.out].reverse()].filter((id, i, a): id is string => !!id && a.indexOf(id) === i);
    const places = order.map((id, i) => ({ id, name: room.seats.find((s) => s.id === id)?.name ?? '?', place: i + 1 }));

    let ratingChanges: Record<string, { before: number; after: number }> = {};
    try {
      const byUser = await recordMatch(this.env.DB, {
        room: room.code,
        ranked: room.ranked,
        starters: room.starters,
        players: places.map((p) => ({ userId: room.seats.find((s) => s.id === p.id)?.userId ?? null, name: p.name, place: p.place })),
      });
      for (const seat of room.seats) {
        const change = seat.userId !== null ? byUser[seat.userId] : undefined;
        if (change) {
          ratingChanges[seat.id] = change;
          seat.rating = change.after;
        }
      }
      // Cheat detection: tag (never ban) signed-in players whose play was beyond plausible.
      for (const seat of room.seats) {
        const stats = room.stats[seat.id];
        if (seat.userId === null || !stats?.length) continue;
        const verdict = assessPlay(stats);
        if (verdict.suspicious) await flagUser(this.env.DB, seat.userId, 'match', verdict);
      }
    } catch (e) {
      console.error('could not record match', e);
      ratingChanges = {};
    }

    const said = final.chain
      .map((p) => findEntry(p.word, final.starter, final.settings.forgiveness)?.word)
      .filter((w): w is string => !!w);
    room.result = { places, ratingChanges, starter: final.starter, said };
    await this.commit();
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    await this.disconnect(ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.disconnect(ws);
  }

  private async disconnect(ws: WebSocket) {
    const room = await this.load();
    const att = ws.deserializeAttachment() as Attachment | null;
    if (!room || !att?.seat) return;
    const stillOpen = this.ctx.getWebSockets().some((o) => o !== ws && (o.deserializeAttachment() as Attachment).seat === att.seat);
    if (stillOpen) return;
    const seat = room.seats.find((s) => s.id === att.seat);
    if (!seat) return;
    seat.connected = false;
    // In the lobby a seat is simply freed; during a game the player stays in (and times out on their turn).
    if (room.stage === 'lobby' && !room.ranked) room.seats = room.seats.filter((s) => s.id !== seat.id);
    if (room.hostId === seat.id) room.hostId = room.seats.find((s) => s.connected)?.id ?? room.seats[0]?.id ?? null;
    if (!room.seats.some((s) => s.connected)) room.emptySince = Date.now();
    await this.commit();
  }

  // ---------- sending ----------

  /** Save, set the next timer, and send everyone their view. */
  private async commit() {
    const room = this.room!;
    if (room.game?.phase === 'result' && !room.resultAt) room.resultAt = Date.now() + RESULT_MS;
    if (room.game?.phase !== 'result') room.resultAt = null;
    await this.save();
    await this.scheduleAlarm();
    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment() as Attachment;
      if (att.seat) this.send(ws, { t: 'room', room: this.view(att.seat) });
    }
  }

  private async scheduleAlarm() {
    const room = this.room!;
    const game = room.game;
    const now = Date.now();
    let at: number;
    if (room.stage === 'playing' && game?.phase === 'playing') at = now + Math.max(0, timeLeft(game, now)) + 50;
    else if (room.stage === 'playing' && game?.phase === 'result') at = room.resultAt ?? now + RESULT_MS;
    else if (room.ranked && room.stage === 'lobby') at = room.createdAt + RANKED_JOIN_MS;
    else at = (room.emptySince ?? now) + EMPTY_ROOM_TTL_MS;
    await this.ctx.storage.setAlarm(at);
  }

  private view(seatId: string): RoomView {
    const room = this.room!;
    const game = room.game;
    const now = Date.now();
    const seat = room.seats.find((s) => s.id === seatId)!;
    return {
      code: room.code,
      you: seatId,
      key: seat.key,
      hostId: room.hostId ?? '',
      ranked: room.ranked,
      settings: room.settings,
      stage: room.stage,
      players: room.seats.map((s) => {
        const p = game?.players.find((x) => x.id === s.id);
        return {
          id: s.id,
          name: s.name,
          color: s.color,
          connected: s.connected,
          guest: s.userId === null,
          rating: s.rating,
          alive: p ? p.alive : true,
          bankMs: p?.bankMs ?? 0,
        };
      }),
      play: game
        ? {
            // Only the word itself: the list of accepted synonyms never leaves the server during play.
            starter: { word: game.starter.word, tier: game.starter.tier },
            chain: game.chain.map(({ playerId, word, rejected, confirmed }) => ({ playerId, word, rejected, confirmed })),
            currentId: game.currentId,
            phase: game.phase,
            timeLeftMs: game.phase === 'playing' ? Math.max(0, timeLeft(game, now)) : 0,
            budgetMs: turnBudget(game),
            canChallenge: canChallenge(game),
            lastEvent: game.lastEvent,
            eventCount: game.log.length,
          }
        : null,
      result: room.result,
    };
  }

  private socketFor(seatId: string | null): WebSocket | undefined {
    return this.ctx.getWebSockets().find((ws) => (ws.deserializeAttachment() as Attachment).seat === seatId);
  }

  private send(ws: WebSocket, msg: ServerMessage) {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      /* socket already closed */
    }
  }

  private broadcastRaw(msg: ServerMessage) {
    for (const ws of this.ctx.getWebSockets()) if ((ws.deserializeAttachment() as Attachment).seat) this.send(ws, msg);
  }
}
