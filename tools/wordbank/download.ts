// Downloads the free word-data sources into ./sources (skips anything already there).
// Run: npm run words:download

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SOURCES_DIR } from './sources.ts';

const FILES = [
  {
    name: 'oewn.zip',
    url: 'https://github.com/globalwordnet/english-wordnet/releases/download/2025-edition/english-wordnet-2025-json.zip',
    unpack: ['unzip', '-qo', 'oewn.zip', '-d', 'oewn'],
    done: 'oewn',
  },
  { name: 'mthesaur.txt', url: 'https://www.gutenberg.org/files/3202/files/mthesaur.txt', done: 'mthesaur.txt' },
  {
    name: 'scowl-src.tar.gz',
    url: 'https://github.com/en-wl/wordlist/archive/refs/tags/rel-2026.02.25.tar.gz',
    unpack: ['tar', 'xzf', 'scowl-src.tar.gz'],
    done: 'wordlist-rel-2026.02.25',
  },
];

mkdirSync(SOURCES_DIR, { recursive: true });
for (const f of FILES) {
  if (existsSync(join(SOURCES_DIR, f.done))) {
    console.log(`✓ ${f.done} already downloaded`);
    continue;
  }
  console.log(`↓ ${f.url}`);
  const res = await fetch(f.url);
  if (!res.ok) throw new Error(`${res.status} for ${f.url}`);
  writeFileSync(join(SOURCES_DIR, f.name), Buffer.from(await res.arrayBuffer()));
  if (f.unpack) execFileSync(f.unpack[0], f.unpack.slice(1), { cwd: SOURCES_DIR });
}
console.log('Sources ready in', SOURCES_DIR);
