// After `vite build`: write a static "Synonyms for ___" page for every starter word, an index of them,
// and sitemap.xml into dist/. These are plain, fast HTML pages that search engines can read directly,
// and each one invites the reader to play.
// Runs automatically as part of `npm run build`.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { STARTERS, type StarterWord, type Synonym } from '../../src/game/words.ts';

const SITE = 'https://synonymshowdown.com';
const DIST = join(import.meta.dirname, '../../dist');
const today = new Date().toISOString().slice(0, 10);

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** Only the reliable synonyms (close and solid) go on public pages. */
const shown = (s: StarterWord) => s.synonyms.filter((x) => x.closeness <= 2);

const byWord = new Map(STARTERS.map((s) => [s.word, s]));

/** A dozen related starters: ones that appear among this word's synonyms first, then same-tier neighbors. */
function related(s: StarterWord): StarterWord[] {
  const out = new Set<StarterWord>();
  for (const syn of shown(s)) {
    const other = byWord.get(syn.word);
    if (other && other !== s) out.add(other);
  }
  const sameTier = STARTERS.filter((x) => x.tier === s.tier && x !== s);
  const start = sameTier.length ? STARTERS.indexOf(s) % sameTier.length : 0;
  for (let i = 0; out.size < 12 && i < sameTier.length; i++) out.add(sameTier[(start + i * 7) % sameTier.length]);
  return [...out].slice(0, 12);
}

const STYLE = `
:root{--ink:#2b2b2b;--muted:#6c757d;--hl:#ffe066}
*{box-sizing:border-box}
body{margin:0;background:#fff;color:var(--ink);font-family:'Patrick Hand','Comic Sans MS',system-ui,sans-serif;font-size:19px;line-height:1.45;
  background-image:radial-gradient(#eceff1 1px,transparent 1.4px);background-size:26px 26px}
main{max-width:760px;margin:0 auto;padding:18px 16px 40px}
a{color:inherit}
header{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:8px}
header a.brand{font-family:'Gochi Hand','Patrick Hand',cursive;font-size:1.5rem;text-decoration:none}
.play{display:inline-block;font-family:'Gochi Hand','Patrick Hand',cursive;font-size:1.3rem;padding:6px 18px;border:2.5px solid var(--ink);
  border-radius:14px 10px 13px 9px;background:#ffd43b;text-decoration:none;transform:rotate(-1deg)}
h1,h2,h3{font-family:'Gochi Hand','Patrick Hand',cursive;font-weight:400;line-height:1.1}
h1{font-size:2.6rem;margin:10px 0 4px}
.hl{background:linear-gradient(transparent 55%,var(--hl) 55%,var(--hl) 90%,transparent 90%);padding:0 4px}
.lead{color:var(--muted);margin-top:0}
section{border:2.5px solid var(--ink);border-radius:16px 10px 14px 12px;padding:12px 16px;margin:16px 0}
section h2{font-size:1.6rem;margin:0}
section .def{color:var(--muted);margin:2px 0 8px}
.chips{display:flex;flex-wrap:wrap;gap:6px;list-style:none;padding:0;margin:0}
.chips li{padding:1px 10px 2px;border:2px solid #69db7c;border-radius:14px 10px 13px 9px;background:#b2f2bb}
.chips li.c1{background:#2f9e44;border-color:#2b8a3e;color:#fff}
.legend{font-size:.9rem;color:var(--muted)}
.cta{text-align:center;background:#fff9db}
.cta p{margin:6px 0 12px}
.related a{display:inline-block;margin:4px 10px 4px 0}
footer{color:var(--muted);font-size:.85rem;margin-top:28px}
.tier h2{margin-top:22px}
.words a{display:inline-block;margin:3px 12px 3px 0}
`;

function page(opts: { title: string; description: string; path: string; body: string; jsonld?: unknown }): string {
  const url = SITE + opts.path;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(opts.title)}</title>
<meta name="description" content="${esc(opts.description)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Synonym Showdown">
<meta property="og:title" content="${esc(opts.title)}">
<meta property="og:description" content="${esc(opts.description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/png" sizes="48x48" href="/favicon-48.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Gochi+Hand&family=Patrick+Hand&display=swap" rel="stylesheet">
<style>${STYLE}</style>
${opts.jsonld ? `<script type="application/ld+json">${JSON.stringify(opts.jsonld)}</script>` : ''}
</head>
<body>
<main>
<header><a class="brand" href="/">Synonym <span class="hl">Showdown</span></a><a class="play" href="/">Play free</a></header>
${opts.body}
<footer>
<p><a href="/synonyms/">All synonym lists</a> · <a href="/">Play Synonym Showdown</a></p>
<p>Synonyms compiled from Open English WordNet (CC BY 4.0), Wiktionary (CC BY-SA 4.0), the Moby Thesaurus (public domain) and SCOWL word lists, graded by Synonym Showdown.</p>
</footer>
</main>
</body>
</html>
`;
}

function wordPage(s: StarterWord): string {
  const syns = shown(s);
  const close = syns.filter((x) => x.closeness === 1);
  const top = [...close, ...syns.filter((x) => x.closeness === 2)].slice(0, 8).map((x) => x.word);
  const senses = s.senses
    .map((sense, i) => ({ sense, words: syns.filter((x) => x.sense === i).sort((a, b) => a.closeness - b.closeness || a.rarity - b.rarity) }))
    .filter((g) => g.words.length);
  const chip = (x: Synonym) => `<li${x.closeness === 1 ? ' class="c1"' : ''}>${esc(x.word)}</li>`;
  const W = cap(s.word);
  const body = `
<h1>Synonyms for <span class="hl">${esc(s.word)}</span></h1>
<p class="lead">${syns.length} synonyms for “${esc(s.word)}”, grouped by meaning. Dark green words mean nearly the same thing; light green ones are close in some uses.</p>
${senses
  .map(
    ({ sense, words }) => `<section>
<h2>${esc(W)} as in “${esc(sense.label)}”</h2>
<p class="def">${esc(sense.pos)}: ${esc(sense.definition)}</p>
<ul class="chips">${words.map(chip).join('')}</ul>
</section>`,
  )
  .join('\n')}
<section class="cta">
<h2>Can you name more synonyms for ${esc(s.word)}?</h2>
<p>Synonym Showdown is a free word game: take turns naming synonyms, and call out anyone who’s bluffing. Play friends with a room code, go ranked, or race the clock in Score Attack.</p>
<a class="play" href="/">Play now</a>
</section>
<h3>More synonym lists</h3>
<p class="related">${related(s)
    .map((r) => `<a href="/synonyms/${r.word}/">Synonyms for ${esc(r.word)}</a>`)
    .join(' ')}</p>`;
  return page({
    title: `Synonyms for ${W}: ${syns.length} Words by Meaning | Synonym Showdown`,
    description: `Synonyms for ${s.word}: ${top.join(', ')} and ${Math.max(0, syns.length - top.length)} more, grouped by meaning from closest to looser. Can you name more? Play the free synonym game.`,
    path: `/synonyms/${s.word}/`,
    body,
    jsonld: {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Synonym Showdown', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: 'Synonyms', item: `${SITE}/synonyms/` },
        { '@type': 'ListItem', position: 3, name: `Synonyms for ${s.word}`, item: `${SITE}/synonyms/${s.word}/` },
      ],
    },
  });
}

function indexPage(): string {
  const tiers = [
    ['easy', 'Everyday words'],
    ['medium', 'Familiar words'],
    ['hard', 'Advanced vocabulary'],
  ] as const;
  const body = `
<h1>Synonym <span class="hl">lists</span></h1>
<p class="lead">Synonyms for ${STARTERS.length} words, grouped by meaning and graded from closest to looser. These are the starter words in Synonym Showdown, a free multiplayer word game.</p>
${tiers
  .map(
    ([tier, label]) => `<div class="tier"><h2>${label}</h2><p class="words">${STARTERS.filter((s) => s.tier === tier)
      .sort((a, b) => a.word.localeCompare(b.word))
      .map((s) => `<a href="/synonyms/${s.word}/">${esc(s.word)}</a>`)
      .join(' ')}</p></div>`,
  )
  .join('\n')}
<section class="cta"><h2>Think you know your synonyms?</h2><p>Name them faster than your friends, or bluff and hope nobody challenges.</p><a class="play" href="/">Play Synonym Showdown</a></section>`;
  return page({
    title: `Synonym Lists for ${STARTERS.length} Words | Synonym Showdown`,
    description: `Browse synonyms for ${STARTERS.length} common and advanced English words, grouped by meaning. Then test yourself in a free multiplayer synonym game.`,
    path: '/synonyms/',
    body,
  });
}

function sitemap(): string {
  const urls = [
    { loc: `${SITE}/`, priority: '1.0', freq: 'weekly' },
    { loc: `${SITE}/synonyms/`, priority: '0.8', freq: 'monthly' },
    ...STARTERS.map((s) => ({ loc: `${SITE}/synonyms/${s.word}/`, priority: '0.6', freq: 'monthly' })),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u.loc}</loc><lastmod>${today}</lastmod><changefreq>${u.freq}</changefreq><priority>${u.priority}</priority></url>`).join('\n')}
</urlset>
`;
}

mkdirSync(join(DIST, 'synonyms'), { recursive: true });
writeFileSync(join(DIST, 'synonyms', 'index.html'), indexPage());
for (const s of STARTERS) {
  mkdirSync(join(DIST, 'synonyms', s.word), { recursive: true });
  writeFileSync(join(DIST, 'synonyms', s.word, 'index.html'), wordPage(s));
}
writeFileSync(join(DIST, 'sitemap.xml'), sitemap());
console.log(`SEO: wrote ${STARTERS.length} synonym pages, an index and sitemap.xml`);
