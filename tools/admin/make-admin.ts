// Give an account admin powers (or take them away).
//   npm run make-admin -- <username>
//   npm run make-admin -- <username> remove

import { execFileSync } from 'node:child_process';

const [username, remove] = process.argv.slice(2);
if (!username || !/^[A-Za-z0-9_]{3,16}$/.test(username)) {
  console.log('Usage: npm run make-admin -- <username> [remove]');
  process.exit(1);
}
const out = execFileSync(
  'npx',
  ['wrangler', 'd1', 'execute', 'synonym-showdown', '--remote', '--json', '--command',
    `UPDATE users SET is_admin = ${remove === 'remove' ? 0 : 1} WHERE username = '${username}'; SELECT username, is_admin FROM users WHERE username = '${username}'`],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
);
const rows = JSON.parse(out).at(-1).results;
console.log(rows.length ? `${rows[0].username}: admin = ${rows[0].is_admin === 1 ? 'yes' : 'no'}` : `No account named "${username}".`);
