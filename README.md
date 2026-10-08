# Synonym Showdown

A word-bluffing game. Everyone gets a starter word and takes turns naming synonyms.
If you think the last word wasn't really a synonym, **challenge** it: if it was a real synonym the challenger is out,
if it wasn't the bluffer is out. Last player standing wins.

## Running it

You need Node.js. It's installed in `~/.local/node`, and your `~/.zshrc` adds it to your PATH, so open a **new** terminal first.

```bash
npm install      # first time only: downloads the libraries
npm run dev      # starts the game at http://localhost:5173 (auto-reloads when code changes)
npm test         # runs the automated rule tests
npm run build    # makes the production version in dist/ (what gets uploaded to a host)
```

## What's playable

| Mode | What it is |
|---|---|
| **Vs. Bots** | 1–4 computer opponents (easy/medium/hard). Bots know only part of each synonym list, bluff when stuck, and sometimes challenge. |
| **Pass & Play** | 2–5 people on one device. |
| **Score Attack** | 60 seconds, one word, as many synonyms as you can. Wrong guesses cost 2s. Personal best per difficulty. |
| **Daily Word** | Same word for everyone each day, one try, shareable result. |
| **Survival** | One correct synonym moves you to a new word; the clock shrinks and words get harder. One miss ends it. |

Settings: word difficulty (easy/medium/hard), time control (Blitz 10s, Rapid 20s, Chess clock 60s total),
spelling forgiveness (Strict / Typos OK / Sounds-alike), and what happens after a knockout (new word / keep word).

## How the code is organized

```
src/
  game/              The rules. Plain TypeScript, no screen code, so a future server can reuse it.
    words.ts           Starter words + synonym lists + bluff "decoys", by tier
    match.ts           Word forms (joyful = joyfully) and spelling forgiveness (typos, sound-alikes)
    engine.ts          Multiplayer rules: turns, challenges, eliminations, clocks
    solo.ts            Score Attack / Daily / Survival rules
    bot.ts             How bots decide what to say and when to challenge
    *.test.ts          Automated tests for all of the above
  ui/                The screens (React)
    sketch.tsx         Hand-drawn boxes/buttons (Rough.js draws the wobbly pencil lines)
    Avatar.tsx         Doodle faces whose expression changes (thinking, worried, out, winning)
    Home.tsx           Title screen, mode picker and settings
    Game.tsx           The table for Vs. Bots and Pass & Play
    SoloGame.tsx       Score Attack / Daily / Survival screens
    GameOver.tsx       End screen
    sound.ts           Sound effects generated in code (no audio files)
    records.ts         Personal bests and daily results (saved in the browser for now)
    AdSlot.tsx         Placeholder for future ads (currently off)
```

The key idea: `game/engine.ts` is a set of **pure functions**. Each one takes the current game state plus an action
("player B challenges") and returns the new state. Because it never touches the screen or the clock directly:
- it's easy to test (see `engine.test.ts`),
- online multiplayer can run the *same* file on a server to referee fairly, so nobody can cheat by editing their browser.

## Online play (server)

The live site runs on Cloudflare at **https://synonymshowdown.com**:

| Piece | What it does |
|---|---|
| `worker/index.ts` | The Worker: serves the website and the `/api/*` routes |
| `worker/auth.ts` | Accounts (username + password, stored as salted PBKDF2 hashes) and login sessions (HttpOnly cookie) |
| `worker/room.ts` | One **GameRoom** Durable Object per room code: runs the real rules and timers; players never see the answer list |
| `worker/matchmaker.ts` | Ranked 1v1 queue, pairing players with similar ratings |
| `worker/records.ts` | Ratings (Glicko, start 1000), points, match history, "Disagree?" reports, cheat tags |
| `worker/migrations/` | Database tables (Cloudflare D1) |
| `src/game/rating.ts`, `suspicion.ts`, `soloVerify.ts` | Shared, tested rules for ratings, cheat detection, and re-checking solo scores |

```bash
npm run build && npx wrangler dev   # full site + server locally at http://localhost:8787
npm run reports                     # open "Disagree?" reports from players
npm run flags                       # accounts the cheat detector tagged
```

Pushing to GitHub deploys automatically. A new database table/column needs a new file in `worker/migrations/`
and `npx wrangler d1 migrations apply synonym-showdown --remote`.

## About the word lists

The synonym lists are hand-written for the prototype: 42 starter words, about 30–40 synonyms each. The plan is to
generate a much bigger list from **WordNet** and the **Moby Thesaurus** (both free, including for commercial use)
and then review it. Thesaurus.com has no public API and doesn't allow scraping.
Spelling variants are written as `willful/wilful`: either spelling counts, and they count as the same word.

## Roadmap

1. **Play-test and tune.** Word lists, bot difficulty, timers.
2. **Online play** with **Supabase** (free tier): guest + optional accounts, room codes and invite links,
   a friends list, then 1v1 ranked with Elo. The server runs `engine.ts` as referee.
3. **Hosting** on **Cloudflare Pages** (free): connect a GitHub repo and every push redeploys.
4. **iOS app** with **Capacitor** (already installed and configured in `capacitor.config.ts`).
   Needs the full **Xcode** app from the Mac App Store, plus the Apple Developer Program ($99/yr) to publish.
   Then: `npm run ios`.
5. **Web game portals** (Poki / CrazyGames / Coolmath): the build uses relative paths so it can be uploaded as-is.
