# Synonym Showdown: project context

A word-bluffing game (web first, iOS App Store later via Capacitor). Players take turns naming synonyms of a
starter word; the next player may challenge the previous word. Real synonym → challenger out; bluff → bluffer out.
See README.md for modes, file layout, and roadmap.

## Running
- Node lives in `~/.local/node/bin` (official binary, not Homebrew; `~/.zshrc` adds it to PATH).
  In a shell that predates that, prefix commands with `export PATH="$HOME/.local/node/bin:$PATH" &&`.
- Run commands from this folder: `npm run dev` (http://localhost:5173), `npm test`, `npm run build`.
- Code lives in the private GitHub repo https://github.com/CarstenMacosko/synonym-showdown (branch `main`).
  GitHub CLI is at `~/.local/bin/gh` (official binary), logged in as CarstenMacosko.
- Live site: https://synonym-showdown.carstenmacosko.workers.dev (Cloudflare Worker with static assets,
  connected to the GitHub repo: every push to `main` runs `npm run build` + `npx wrangler deploy`).
  The owner manages the Cloudflare account; don't ask for Cloudflare credentials.
- No full Xcode installed yet (macOS 14.6, Command Line Tools only), so `npm run ios` won't work until it is.

## Architecture rules
- `src/game/` is pure TypeScript rules: (state, action, now, rng) → new state. No DOM, timers, or Math.random inside.
  The future online server will reuse it as referee. Every rule change gets a test in `src/game/*.test.ts`.
- `src/ui/` is React. Hand-drawn look comes from `sketch.tsx` (Rough.js); keep new UI in that style.
- Synonym data is bundled in `src/game/words.ts` (hand-curated for now; later generated from WordNet + Moby).
  `a/b` entries are spelling variants of one word. Never scrape thesaurus.com.

## Product decisions (already made by the owner, don't re-ask)
- Style: skribbl.io-like: mostly white, pencil-drawn shapes, bouncy animations; for all ages, not kids-only.
- Only the directly previous word can be challenged. Random first player. Running out of time = eliminated.
- Word forms count as the same word (joyful = joyfully); no repeats.
- Spelling forgiveness is a lobby setting (strict / typos / sound-alike); ranked always uses strict.
- After a knockout with 3+ players: lobby chooses a new word or keeps the same one.
- Starter words have difficulty tiers (easy / medium / hard).
- Accounts: guest + optional sign-up. Friends: room codes/invite links, friends list, pass-and-play.
- Ranked: 1v1 Elo only. Chat: emotes/quick phrases only.
- Free for now; ads may be added later (between-game slots only, `src/ui/AdSlot.tsx`). Target Poki/CrazyGames/Coolmath.
- Planned stack: Supabase (accounts, DB, realtime) + Cloudflare Pages hosting + Capacitor for iOS.

## Status
Done: Vs. Bots, Pass & Play, Score Attack, Daily Word, Survival; 42 starter words.
Next: owner play-testing feedback → online multiplayer (Supabase) → deploy → iOS.

## Working with the owner
Has some coding experience; explain briefly what each step does and why. Commit to git at milestones.
