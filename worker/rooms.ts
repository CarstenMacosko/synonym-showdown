// Handing out room codes.

import { ROOM_CODE_LETTERS } from '../src/game/protocol.ts';

function randomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return [...bytes].map((b) => ROOM_CODE_LETTERS[b % ROOM_CODE_LETTERS.length]).join('');
}

/** Reserve a fresh room code (retrying on the rare collision with a live room). */
export async function createRoom(env: Env, ranked: boolean, allowedUsers: number[] | null): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const code = randomCode();
    const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
    if (await stub.init({ code, ranked, allowedUsers })) return code;
  }
  throw new Error('no free room code');
}
