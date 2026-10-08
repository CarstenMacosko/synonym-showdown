# Game sites to submit Synonym Showdown to

Researched October 2026. Requirements change, so check each site's current developer page before submitting.
When a portal embeds the game, use the address **https://synonymshowdown.com/?portal=NAME** (for example
`?portal=crazygames`). That hides sign-in, ranked and outside links, which several portals don't allow; guest play
and rooms with friends still work.

## Big portals (most players)

| Site | How to apply | Notes |
|---|---|---|
| **CrazyGames** | Create a developer account at **developer.crazygames.com**, then "Submit a game" (developer.crazygames.com/games). Docs: docs.crazygames.com | Open submissions. Starts in a "Basic Launch" trial (no SDK needed, no ads, **no outside logins**: use `?portal=crazygames`); strong games move to Full Launch with ad revenue share via their SDK. Needs a description, controls, cover images/video, and a privacy policy (ours: /privacy/). |
| **Poki** | Fill in the "Request access to Poki for Developers" form at **developers.poki.com** ("Apply now"), then they invite you to their playtest tools. | Curated: games go through player playtests (people need to keep playing for a few minutes). Read their Developer Guide at developers.poki.com/guide. |
| **Coolmath Games** | Developer page: **developers.coolmathgames.com**. Coolmath staff have repeatedly told developers on itch.io to email **games@coolmath.com** about licensing. | Curated, family-friendly, licenses games non-exclusively from developers. A natural fit: educational, all-ages, no chat. |
| **GameDistribution** | Register as a developer on GameDistribution's developer portal, register the game, add their SDK, upload, then "request publishing". SDK: github.com/GameDistribution/GD-HTML5 | Distributes games to thousands of partner sites; requires their ad SDK. Supports self-hosted games via an iframe wrapper. |

## Upload-it-yourself sites (instant, good for links and early players)

| Site | How | Notes |
|---|---|---|
| **itch.io** | Create an account, then itch.io/game/new; choose "HTML" or link to the site. | Huge indie audience and a free, trusted backlink. Add tags: word, multiplayer, party, educational. |
| **Newgrounds** | Create an account, start a new game project, upload a ZIP with index.html at the root (or an embed). | Strong community feedback, front-page chances. |
| **Y8** | Developer account, then y8.com/upload. | Revenue share via AdSense for Platforms or manual invoicing. Some developers complain about games being re-hosted on partner sites, so read their terms. |
| **Game Jolt** | gamejolt.com, add a game (HTML/web). | Indie community, another backlink. |

## Curated portals to email (smaller, worth a short pitch)

| Site | Contact |
|---|---|
| **Armor Games** | Check armorgames.com for their current developer contact (hosts curated HTML5 games). |
| **Addicting Games** | Their site's contact/partners page; they sponsor indie multiplayer (.io-style) games. |
| **GamePix** | gamepix.com developer/partners section (B2B distribution, reported ~45% revenue share with their SDK). |
| **Lagged** | lagged.com contact page. |
| **Kongregate** | Reportedly stopped taking new web game uploads around 2020, so check before spending time. |

## Launch and directory sites (one-time posts that bring players and links)

- **Product Hunt:** producthunt.com, "Submit". Launch on a Tuesday–Thursday morning (US time).
- **Hacker News:** "Show HN: Synonym Showdown, a multiplayer synonym-bluffing game" (news.ycombinator.com/submit). Mention the free self-built thesaurus and the anti-cheat.
- **Reddit:** r/WebGames, r/wordgames, r/indiegames, r/playmygame, r/teachers (as a classroom resource). Read each subreddit's self-promotion rules first.
- **AlternativeTo:** add it as an alternative to Wordle / Scattergories / Taboo.
- **Teacher resources:** a free listing on TeachersPayTeachers linking to the game; teacher Facebook groups.

## Ready-to-send pitch email

> **Subject:** Synonym Showdown: a family-friendly multiplayer word game (HTML5)
>
> Hi [team name],
>
> I'm Carsten, the developer of Synonym Showdown (https://synonymshowdown.com), a free browser word game.
> Players take turns naming synonyms of a starter word and can challenge anyone they think is bluffing. If the word
> really is a synonym, the challenger is out; if not, the bluffer is.
>
> - Modes: online rooms with friends (room codes), ranked 1v1, vs. bots, pass & play, Score Attack, Survival and a Daily Word
> - 300 starter words and 27,000 synonyms graded by closeness, with a meaning map after every game (great for vocabulary)
> - All ages: no free chat (emoji reactions only), guest play, works on phones and desktops
> - Lightweight HTML5 (~200 KB compressed), hand-drawn art and original synthesized music
>
> I'd love to [publish it on / license it to] [site]. I'm happy to integrate your SDK, adjust it to your requirements,
> or provide a build hosted on your servers.
>
> Thanks for taking a look!
> Carsten

## Before submitting anywhere

- Record a 20–30 second gameplay video (a bluff getting caught is the best hook) and take 3–4 screenshots.
- Cover image: `public/og-image.png` (1200×630) works as a start; some portals want other sizes.
- If a portal requires uploading files instead of embedding our site, online play needs extra setup (their domain
  must be allowed to reach our server). Solo and bot modes work anywhere.
