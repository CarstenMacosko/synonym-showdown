// Tell Bing, DuckDuckGo, Yandex and other IndexNow search engines that our pages exist or changed.
// (Google doesn't use IndexNow; use Search Console for Google.)
//   npm run indexnow
// The key file public/<key>.txt proves we own the site.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const key = readFileSync(join(import.meta.dirname, 'indexnow-key.txt'), 'utf8').trim();
const sitemap = readFileSync(join(import.meta.dirname, '../../dist/sitemap.xml'), 'utf8');
const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: 'synonymshowdown.com', key, keyLocation: `https://synonymshowdown.com/${key}.txt`, urlList: urls }),
});
console.log(`IndexNow: submitted ${urls.length} URLs → HTTP ${res.status} ${res.statusText}`);
