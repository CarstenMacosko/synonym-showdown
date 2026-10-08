# Growing Synonym Showdown: ideas

Ranked by **impact ÷ effort**. Each idea says what it is, why it works for *this* game, and roughly how much work it is.

## Do first (high impact, low effort)

### 1. Make shared links look great
When someone pastes synonymshowdown.com into iMessage, Discord or WhatsApp, today it shows a bare link. Add a preview image
(the doodle faces + "Name a synonym… or call a bluff."), a title and a description (Open Graph tags), plus a proper app icon.
Every invite link and Daily Word share then becomes a little ad. **Effort: ~1 hour.**

### 2. Daily Word streaks + a better share card
Wordle grew almost entirely through shared results. We already have a Daily Word and a share button. Add:
- a **streak counter** ("🔥 7 days") and a "come back tomorrow" countdown;
- a share text that shows how *rare* your words were (🟩 common, 🟨 uncommon, 🟪 rare) instead of plain squares, and ends with the link.
People share streaks and flex rare words. **Effort: half a day.**

### 3. "Add to Home Screen" (installable web app)
A small manifest file lets phones install the site like an app, with an icon and no browser bar. Installed players come back far
more often, and it's a stepping stone to the App Store. **Effort: ~1 hour.**

### 4. Post it where word-game people already are
- **Reddit:** r/WebGames, r/wordgames, r/boardgames (it plays like a party game), r/teachers (see #6). Post a GIF of a funny
  bluff getting caught, not just a link.
- **Discord:** word-game and puzzle servers; offer a room code in the post so people can jump in together.
- **Product Hunt** and **Hacker News "Show HN"**. The technical story is interesting: a free, self-built thesaurus from WordNet,
  Wiktionary and word vectors, plus an anti-cheat that tells pasting from typing.
**Effort: an afternoon of posting, then replying to comments.**

### 5. Web game portals
CrazyGames, Poki, itch.io and Newgrounds bring a constant stream of players looking for something new, and some share ad revenue.
The site already builds with relative paths, so it can be uploaded as-is (online play needs the portal to allow our server;
solo and bot modes work anywhere). Coolmath Games takes pitches by email. **Effort: a few hours per portal.**

## Next (bigger wins, more work)

### 6. Classrooms
Teachers are always looking for vocabulary games, and the game is already classroom-safe (emote-only chat, guest play, room codes).
Add a **teacher mode**: a big room code on the projector, up to 30 players, a word list matched to grade level, and an end-of-game
summary of words learned. Share in teacher Facebook groups, TeachersPayTeachers (free listing) and Google Classroom.
One teacher brings 25 students, and they bring their families. **Effort: 2–3 days.**

### 7. Unlock hats with points
Points currently just pile up. Make some hats and textures **unlockable** (crown at 1,000 points, halo for a 7-day daily streak,
horns for 10 ranked wins). That gives every game a goal and makes avatars a status symbol people show off. **Effort: 1 day.**

### 8. "Synonyms of ___" pages for search
We have 300 starter words with full, graded meaning maps. Publishing each as a page ("Synonyms for *happy*: glad, joyful,
cheerful… Can you name more? Play now") can pull in Google traffic from people looking up synonyms, which is a huge search
category. **Effort: 1–2 days; grows slowly but steadily.**

### 9. Ranked seasons and weekly leaderboards
A monthly season with a fresh leaderboard (and a hat for the top 10) gives returning players something to chase and new
players a fair shot. **Effort: 1 day.**

### 10. Short videos
Screen-record the funniest moments: a bot's outrageous bluff, a last-second "Challenge!", a rare word for +3. 15-second
TikToks, Shorts and Reels with "can you name more synonyms for X?" in the caption. Low cost, and one hit can bring thousands
of players. **Effort: ongoing, ~30 min per video.**

## Later

- **Streamer mode:** the streamer hosts and chat joins a big room; the audience votes on challenges.
- **Discord Activity:** play inside Discord voice channels (Discord's embedded app platform).
- **App Store / Google Play:** wrap the site with Capacitor (already set up) once players ask for it.
- **Referrals:** "Invite 3 friends who play a game → unlock the propeller hat."

## Measure what works
Turn on **Cloudflare Web Analytics** (free, privacy-friendly, no cookie banner needed) in the Cloudflare dashboard, so you can
see which posts and portals actually bring players. The database already shows sign-ups, games and daily plays
(`npm run accounts`, the Admin page).
