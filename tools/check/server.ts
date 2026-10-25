// Check that the game server, its database and sign-in all work.
//   npm run check                          the live site: read-only checks, creates nothing
//   npm run check -- http://localhost:8799 --full
//                                          a local copy (npx wrangler dev): also signs up a throwaway account,
//                                          signs out and back in, saves a face, and plays a room's opening moves
// --full is refused on the live site so test accounts never end up in the real database.
// Exits with code 1 if anything fails (the GitHub "Server check" workflow relies on that).

const args = process.argv.slice(2);
const base = (args.find((a) => !a.startsWith('--')) ?? 'https://synonymshowdown.com').replace(/\/$/, '');
const full = args.includes('--full');
const isLocal = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base);
if (full && !isLocal) {
  console.error('--full creates an account, so it only runs against a local server (http://localhost:…).');
  process.exit(2);
}

let failures = 0;
let cookie = '';

interface Reply {
  status: number;
  body: Record<string, unknown> | null;
  text: string;
  setCookie: string | null;
}

async function req(path: string, method = 'GET', body?: unknown): Promise<Reply> {
  const res = await fetch(base + path, {
    method,
    headers: {
      origin: base,
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    /* not JSON: probably a Cloudflare error page */
  }
  return { status: res.status, body: parsed, text, setCookie: res.headers.get('set-cookie') };
}

/** Explain a reply that isn't from our own code (Cloudflare error pages are HTML). */
function diagnose(r: Reply): string {
  if (r.text.includes('1027') || (r.status === 429 && !r.body)) {
    return 'Cloudflare error 1027: the account’s free daily Worker request allowance (100,000, shared by every project on the account) is used up. It resets at 00:00 UTC.';
  }
  if (r.body?.error) return `server said: ${r.body.error}`;
  return `HTTP ${r.status}: ${r.text.replace(/\s+/g, ' ').slice(0, 160)}`;
}

async function check(name: string, run: () => Promise<string | true>) {
  try {
    const result = await run();
    if (result === true) console.log(`  ✓ ${name}`);
    else {
      failures++;
      console.log(`  ✗ ${name}\n      ${result}`);
    }
  } catch (e) {
    failures++;
    console.log(`  ✗ ${name}\n      could not connect: ${(e as Error).cause ?? (e as Error).message}`);
  }
}

console.log(`Checking ${base}${full ? ' (full sign-in round trip)' : ''}`);

await check('website loads', async () => {
  const res = await fetch(base + '/');
  const html = await res.text();
  return res.ok && html.includes('<div id="root"') ? true : `HTTP ${res.status}`;
});
await check('game server and database answer', async () => {
  const r = await req('/api/health');
  return r.status === 200 && r.body?.ok === true ? true : diagnose(r);
});
await check('sign-in check works (not signed in yet)', async () => {
  const r = await req('/api/me');
  return r.status === 200 && r.body && 'user' in r.body ? true : diagnose(r);
});
await check('wrong passwords are turned away', async () => {
  const r = await req('/api/login', 'POST', { username: 'server_check', password: 'not-the-password' });
  if (r.status === 401 && r.body?.error) return true;
  return r.status === 429 && r.body?.error ? true : diagnose(r); // our own "too many attempts" still means it works
});
await check('leaderboard loads', async () => {
  const r = await req('/api/leaderboard');
  return r.status === 200 && Array.isArray(r.body?.players) ? true : diagnose(r);
});

if (full) {
  const username = `chk_${Math.random().toString(36).slice(2, 10)}`;
  const password = `pw-${Math.random().toString(36).slice(2)}`;
  const keepCookie = (r: Reply) => {
    if (r.setCookie) cookie = r.setCookie.split(';')[0];
  };

  await check('create an account', async () => {
    const r = await req('/api/register', 'POST', { username, password });
    keepCookie(r);
    return r.status === 200 && (r.body?.user as { username?: string })?.username === username && cookie ? true : diagnose(r);
  });
  await check('signed in right after creating it', async () => {
    const r = await req('/api/me');
    return (r.body?.user as { username?: string } | null)?.username === username ? true : diagnose(r);
  });
  await check('the same username can’t be taken twice', async () => {
    const r = await req('/api/register', 'POST', { username, password });
    return r.status === 400 ? true : diagnose(r);
  });
  await check('save a face', async () => {
    const avatar = { color: 3, accent: 1, texture: 'dots', shape: 'round', eyes: 'dots', mouth: 'smile', hat: 'none', extra: 'none' };
    const r = await req('/api/profile', 'POST', { avatar });
    return r.status === 200 ? true : diagnose(r);
  });
  await check('locked hats are refused for a new account', async () => {
    const avatar = { color: 3, accent: 1, texture: 'dots', shape: 'round', eyes: 'dots', mouth: 'smile', hat: 'crown', extra: 'none' };
    const r = await req('/api/profile', 'POST', { avatar });
    return r.status === 400 ? true : diagnose(r);
  });
  await check('sign out', async () => {
    const r = await req('/api/logout', 'POST', {});
    keepCookie(r);
    const me = await req('/api/me');
    return r.status === 200 && me.body?.user === null ? true : diagnose(me);
  });
  await check('wrong password for a real account is turned away', async () => {
    const r = await req('/api/login', 'POST', { username, password: password + 'x' });
    return r.status === 401 ? true : diagnose(r);
  });
  await check('sign back in', async () => {
    const r = await req('/api/login', 'POST', { username, password });
    keepCookie(r);
    const me = await req('/api/me');
    return r.status === 200 && (me.body?.user as { username?: string } | null)?.username === username ? true : diagnose(r);
  });
  await check('profile and match history load', async () => {
    const r = await req('/api/profile');
    return r.status === 200 && Array.isArray(r.body?.recent) ? true : diagnose(r);
  });
  await check('create a room and join it over a WebSocket', async () => {
    const r = await req('/api/rooms', 'POST', {});
    const code = r.body?.code;
    if (typeof code !== 'string') return diagnose(r);
    const ws = new WebSocket(`${base.replace(/^http/, 'ws')}/api/rooms/${code}/ws`, { headers: { origin: base, cookie } } as never);
    const reply = await new Promise<string>((resolve) => {
      const timer = setTimeout(() => resolve('no answer from the room within 5 seconds'), 5000);
      ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', name: 'Checker' }));
      ws.onmessage = (e) => {
        const m = JSON.parse(String(e.data));
        if (m.t === 'room') {
          clearTimeout(timer);
          const me = m.room.players.find((p: { name: string }) => p.name === username);
          resolve(me ? 'ok' : `joined, but not as ${username}`);
        }
      };
      ws.onerror = () => resolve('the WebSocket was refused');
    });
    ws.close();
    return reply === 'ok' ? true : reply;
  });
  await check('sign out again', async () => {
    const r = await req('/api/logout', 'POST', {});
    return r.status === 200 ? true : diagnose(r);
  });
}

console.log(failures ? `\n${failures} check(s) failed.` : '\nAll good.');
process.exit(failures ? 1 : 0);
