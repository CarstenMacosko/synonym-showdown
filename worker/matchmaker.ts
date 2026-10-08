// Ranked 1v1 matchmaking queue (a single Durable Object). Signed-in players connect a WebSocket and wait;
// players with similar ratings are paired, and the allowed rating gap grows the longer they wait.

import { DurableObject } from 'cloudflare:workers';
import type { QueueMessage } from '../src/game/protocol.ts';
import { createRoom } from './rooms.ts';
import type { SocketUser } from './room.ts';

interface Waiting extends SocketUser {
  since: number;
}

const TICK_MS = 2_000;
const BASE_GAP = 150;
const GAP_PER_SECOND = 25;

export class Matchmaker extends DurableObject<Env> {
  async fetch(req: Request): Promise<Response> {
    if (req.headers.get('upgrade') !== 'websocket') return new Response('expected websocket', { status: 426 });
    const header = req.headers.get('x-ss-user');
    if (!header) return new Response('sign in first', { status: 401 });
    const user = JSON.parse(header) as SocketUser;
    // One place in the queue per account: drop any older connection.
    for (const ws of this.ctx.getWebSockets()) {
      if ((ws.deserializeAttachment() as Waiting).id === user.id) ws.close(4000, 'Queued from another tab');
    }
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    pair[1].serializeAttachment({ ...user, since: Date.now() } satisfies Waiting);
    await this.ctx.storage.setAlarm(Date.now() + 300);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  async webSocketMessage(): Promise<void> {
    // Clients only send keep-alive pings; nothing to do.
  }

  async alarm(): Promise<void> {
    await this.pairUp();
    if (this.ctx.getWebSockets().length) await this.ctx.storage.setAlarm(Date.now() + TICK_MS);
  }

  private async pairUp() {
    const now = Date.now();
    const waiting = this.ctx
      .getWebSockets()
      .map((ws) => ({ ws, w: ws.deserializeAttachment() as Waiting }))
      .sort((a, b) => a.w.since - b.w.since);
    const matched = new Set<WebSocket>();
    for (const a of waiting) {
      if (matched.has(a.ws)) continue;
      const gap = (x: Waiting) => BASE_GAP + (GAP_PER_SECOND * (now - x.since)) / 1000;
      let best: (typeof waiting)[number] | null = null;
      for (const b of waiting) {
        if (b === a || matched.has(b.ws) || b.w.id === a.w.id) continue;
        const diff = Math.abs(a.w.rating - b.w.rating);
        if (diff <= Math.max(gap(a.w), gap(b.w)) && (!best || diff < Math.abs(a.w.rating - best.w.rating))) best = b;
      }
      if (!best) continue;
      matched.add(a.ws).add(best.ws);
      try {
        const code = await createRoom(this.env, true, [a.w.id, best.w.id]);
        for (const ws of [a.ws, best.ws]) {
          this.send(ws, { t: 'matched', code });
          ws.close(1000, 'matched');
        }
      } catch (e) {
        console.error('matchmaking failed', e);
        matched.delete(a.ws);
        matched.delete(best.ws);
      }
    }
    const left = waiting.filter((x) => !matched.has(x.ws));
    for (const { ws } of left) this.send(ws, { t: 'waiting', inQueue: left.length });
  }

  private send(ws: WebSocket, msg: QueueMessage) {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      /* closed */
    }
  }
}
