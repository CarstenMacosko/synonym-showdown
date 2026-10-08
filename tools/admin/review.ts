// Review tools for the live database (needs `npx wrangler login` on this Mac).
//
//   npm run reports            open "Disagree?" reports, grouped by word (fix them in tools/wordbank/overrides.json)
//   npm run reports -- close   mark all open reports as handled after you've updated overrides.json
//   npm run flags              accounts the cheat detector tagged as suspicious
//   npm run accounts           every registered account

import { execFileSync } from 'node:child_process';

function query<T>(sql: string): T[] {
  const out = execFileSync('npx', ['wrangler', 'd1', 'execute', 'synonym-showdown', '--remote', '--json', '--command', sql], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  return JSON.parse(out)[0].results as T[];
}

const [what, action] = process.argv.slice(2);

if (what === 'reports') {
  if (action === 'close') {
    query("UPDATE reports SET status = 'fixed' WHERE status = 'open'");
    console.log('All open reports marked as handled.');
  } else {
    const rows = query<{ starter: string; word: string; ruling: string; range: string; n: number; last: number }>(
      `SELECT starter, word, ruling, range, COUNT(*) AS n, MAX(created_at) AS last FROM reports
       WHERE status = 'open' GROUP BY starter, word, ruling ORDER BY n DESC, last DESC`,
    );
    if (!rows.length) console.log('No open reports.');
    for (const r of rows) {
      const want = r.ruling === 'rejected' ? 'should COUNT' : 'should NOT count';
      console.log(`${String(r.n).padStart(3)}×  ${r.starter} → ${r.word}  (players say it ${want}; game ${r.ruling} it in ${r.range})`);
    }
  }
} else if (what === 'flags') {
  const rows = query<{ username: string; suspicious: number; source: string; reasons: string; created_at: number }>(
    `SELECT u.username, u.suspicious, f.source, f.reasons, f.created_at FROM flags f JOIN users u ON u.id = f.user_id
     ORDER BY f.created_at DESC LIMIT 50`,
  );
  if (!rows.length) console.log('Nobody has been flagged.');
  for (const r of rows) {
    console.log(`${new Date(r.created_at).toISOString().slice(0, 16)}  ${r.username} (${r.suspicious} tag(s), ${r.source}): ${JSON.parse(r.reasons).join('; ')}`);
  }
} else if (what === 'accounts') {
  const rows = query<{ username: string; created_at: number; rating: number; points: number; is_admin: number; suspicious: number }>(
    'SELECT username, created_at, rating, points, is_admin, suspicious FROM users ORDER BY created_at',
  );
  console.log(`${rows.length} account(s)`);
  for (const r of rows) {
    const tags = [r.is_admin ? 'admin' : '', r.suspicious ? 'flagged' : ''].filter(Boolean).join(', ');
    console.log(`  ${r.username.padEnd(17)} joined ${new Date(r.created_at).toISOString().slice(0, 10)}  rating ${Math.round(r.rating)}  ${r.points} pts${tags ? `  [${tags}]` : ''}`);
  }
} else {
  console.log('Usage: npm run reports [-- close] | npm run flags | npm run accounts');
}
