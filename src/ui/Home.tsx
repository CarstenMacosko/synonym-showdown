// Title screen: pick a mode and its settings.

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { ROOM_CODE_RE } from '../game/protocol';
import { api } from '../net/api';
import { AccountBar, useAccount } from './account';
import { useMusic } from './music';
import { botAvatar, useMyAvatar } from './myAvatar';
import { TIME_CONTROLS, type AfterElimination, type BotLevel, type TimeControl } from '../game/engine';
import type { Forgiveness } from '../game/match';
import { todayKey } from '../game/solo';
import type { Range, Tier } from '../game/words';
import { AdSlot } from './AdSlot';
import { Avatar } from './Avatar';
import { PASS_MAX, type GameConfig, type ModeId } from './config';
import { getBest, getDaily } from './records';
import { Choice, SketchBox, SketchButton } from './sketch';

const MODES: { id: ModeId; title: string; blurb: string; color?: string }[] = [
  { id: 'friends', title: 'Play Friends', blurb: 'Online room codes', color: '#d0ebff' },
  { id: 'ranked', title: 'Ranked', blurb: '1v1 with a rating', color: '#ffe8cc' },
  { id: 'bots', title: 'Vs. Bots', blurb: 'Outwit computer players', color: '#e5dbff' },
  { id: 'pass', title: 'Pass & Play', blurb: 'Friends on one device', color: '#ffe3e3' },
  { id: 'score', title: 'Score Attack', blurb: 'Most synonyms in 60s', color: '#d3f9d8' },
  { id: 'daily', title: 'Daily Word', blurb: 'Same word for everyone', color: '#fff3bf' },
  { id: 'survival', title: 'Survival', blurb: 'One miss and you’re out', color: '#f3d9fa' },
];

/** What the online buttons ask App to do. */
export type OnlineAction = { kind: 'create' } | { kind: 'join'; code: string } | { kind: 'ranked' };

const TIER_OPTIONS: { value: Tier; label: string; detail: string }[] = [
  { value: 'easy', label: 'Easy', detail: 'happy, big' },
  { value: 'medium', label: 'Medium', detail: 'brave, calm' },
  { value: 'hard', label: 'Hard', detail: 'obstinate' },
];

const RANGE_OPTIONS: { value: Range; label: string; detail: string }[] = [
  { value: 'close', label: 'Close only', detail: 'core synonyms' },
  { value: 'standard', label: 'Standard', detail: 'close + solid' },
  { value: 'loose', label: 'Loose', detail: '+ distant ones' },
];

const SPELLING_OPTIONS: { value: Forgiveness; label: string; detail: string }[] = [
  { value: 'strict', label: 'Strict', detail: 'exact spelling' },
  { value: 'typos', label: 'Typos OK', detail: '1–2 letters off' },
  { value: 'soundalike', label: 'Sounds-alike', detail: 'most forgiving' },
];

export function Home({
  config,
  onPlay,
  onOnline,
  onAdmin,
  onProfile,
  notice,
}: {
  config: GameConfig;
  onPlay: (c: GameConfig) => void;
  onOnline: (c: GameConfig, action: OnlineAction) => void;
  onAdmin: () => void;
  onProfile: () => void;
  notice?: string | null;
}) {
  const [c, setC] = useState(config);
  const { user, openSignIn } = useAccount();
  const { avatar: myAvatar } = useMyAvatar();
  useMusic('home');
  const [joinCode, setJoinCode] = useState('');
  const set = (patch: Partial<GameConfig['settings']>) => setC({ ...c, settings: { ...c.settings, ...patch } });
  const mode = c.mode;
  const multiplayer = mode === 'bots' || mode === 'pass';
  const daily = getDaily(todayKey());

  function start() {
    const passNames = c.passNames.map((n, i) => n.trim() || `Player ${i + 1}`);
    onPlay({ ...c, name: c.name.trim() || 'You', passNames });
  }

  const tierField = (
    <div className="field">
      <span>Word difficulty</span>
      <Choice<Tier> value={c.settings.tier} onChange={(v) => set({ tier: v })} color="#69db7c" options={TIER_OPTIONS} />
    </div>
  );
  const spellingField = (
    <>
      <div className="field">
        <span>Synonym range</span>
        <Choice<Range> value={c.settings.range} onChange={(v) => set({ range: v })} color="#38d9a9" options={RANGE_OPTIONS} />
      </div>
      <div className="field">
        <span>Spelling</span>
        <Choice<Forgiveness> value={c.settings.forgiveness} onChange={(v) => set({ forgiveness: v })} color="#da77f2" options={SPELLING_OPTIONS} />
      </div>
    </>
  );

  return (
    <div className="page home">
      <AccountBar onAdmin={onAdmin} onProfile={onProfile} />
      <header className="title-block">
        <motion.div className="title-faces" initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', bounce: 0.6 }}>
          <Avatar id="Lexi" config={botAvatar('Lexi')} mood="worried" size={54} />
          <button className="my-face" onClick={onProfile} aria-label="Customize your face">
            <Avatar id={user?.username ?? 'me'} config={myAvatar} color="#4dabf7" size={70} />
            <small>{myAvatar ? 'you' : 'make your face!'}</small>
          </button>
          <Avatar id="Wordsworth" config={botAvatar('Wordsworth')} mood="think" size={54} />
        </motion.div>
        <motion.h1 initial={{ scale: 0.6, rotate: -6 }} animate={{ scale: 1, rotate: -2 }} transition={{ type: 'spring', bounce: 0.55 }}>
          Synonym <span className="hl">Showdown</span>
        </motion.h1>
        <p className="tagline">Name a synonym… or call a bluff.</p>
      </header>

      <section className="modes" role="radiogroup" aria-label="Game mode">
        {MODES.map((m, i) => {
          const ready = true;
          const active = m.id === mode;
          return (
            <motion.button
              key={m.id}
              className="mode-btn"
              role="radio"
              aria-checked={active}
              disabled={!ready}
              onClick={() => ready && setC({ ...c, mode: m.id as ModeId })}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1, scale: active ? 1.04 : 1, rotate: active ? -1 : 0 }}
              whileHover={ready ? { scale: 1.06, rotate: -1.5 } : undefined}
              whileTap={ready ? { scale: 0.95 } : undefined}
              transition={{ delay: 0.04 * i, type: 'spring', bounce: 0.5 }}
            >
              <SketchBox
                className={`mode-card ${active ? 'active' : ''} ${ready ? '' : 'soon'}`}
                fill={active ? m.color : undefined}
                strokeWidth={active ? 3 : 2}
              >
                <strong>{m.title}</strong>
                <span>{m.blurb}</span>
                {!ready && <em className="soon-tag">soon!</em>}
                {m.id === 'daily' && daily && <em className="soon-tag done">done ✓</em>}
              </SketchBox>
            </motion.button>
          );
        })}
      </section>

      <SketchBox className="panel settings">
        {mode === 'bots' && (
          <>
            <h2>Vs. Bots</h2>
            <label className="field">
              <span>Your name</span>
              <SketchBox className="input-wrap">
                <input value={c.name} maxLength={16} onChange={(e) => setC({ ...c, name: e.target.value })} />
              </SketchBox>
            </label>
            <div className="field">
              <span>Opponents</span>
              <Choice
                value={String(c.bots)}
                onChange={(v) => setC({ ...c, bots: Number(v) })}
                options={['1', '2', '3', '4'].map((n) => ({ value: n, label: n }))}
              />
            </div>
            <div className="field">
              <span>Bot skill</span>
              <Choice<BotLevel>
                value={c.botLevel}
                onChange={(v) => setC({ ...c, botLevel: v })}
                color="#ff8787"
                options={[
                  { value: 'easy', label: 'Easy' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'hard', label: 'Hard' },
                ]}
              />
            </div>
          </>
        )}

        {mode === 'pass' && (
          <>
            <h2>Pass & Play</h2>
            <p className="muted hint">Take turns typing on this device. Everyone sees every word — so bluff with a straight face!</p>
            <div className="field">
              <span>Players</span>
              {c.passNames.map((n, i) => (
                <div className="name-row" key={i}>
                  <Avatar id={`pp${i}`} color={['#4dabf7', '#ff8787', '#69db7c', '#ffd43b', '#da77f2'][i]} size={34} />
                  <SketchBox className="input-wrap">
                    <input
                      value={n}
                      maxLength={16}
                      aria-label={`Player ${i + 1} name`}
                      onChange={(e) => setC({ ...c, passNames: c.passNames.map((x, j) => (j === i ? e.target.value : x)) })}
                    />
                  </SketchBox>
                  {c.passNames.length > 2 && (
                    <button className="icon-btn" aria-label="Remove player" onClick={() => setC({ ...c, passNames: c.passNames.filter((_, j) => j !== i) })}>
                      ✕
                    </button>
                  )}
                </div>
              ))}
              {c.passNames.length < PASS_MAX && (
                <SketchButton className="small" onClick={() => setC({ ...c, passNames: [...c.passNames, `Player ${c.passNames.length + 1}`] })}>
                  + Add player
                </SketchButton>
              )}
            </div>
          </>
        )}

        {multiplayer && (
          <>
            {tierField}
            <div className="field">
              <span>Time control</span>
              <Choice<TimeControl>
                value={c.settings.timeControl}
                onChange={(v) => set({ timeControl: v })}
                color="#4dabf7"
                options={(Object.keys(TIME_CONTROLS) as TimeControl[]).map((k) => ({
                  value: k,
                  label: TIME_CONTROLS[k].label,
                  detail: TIME_CONTROLS[k].detail,
                }))}
              />
            </div>
            {spellingField}
            <div className="field">
              <span>After a knockout</span>
              <Choice<AfterElimination>
                value={c.settings.afterElimination}
                onChange={(v) => set({ afterElimination: v })}
                color="#ffa94d"
                options={[
                  { value: 'newWord', label: 'New word' },
                  { value: 'sameWord', label: 'Keep word' },
                ]}
              />
            </div>
          </>
        )}

        {mode === 'score' && (
          <>
            <h2>Score Attack</h2>
            <p className="muted hint">60 seconds, one word. Each synonym scores 1 point, uncommon ones 2, rare ones 3; wrong guesses cost 2 seconds.</p>
            {tierField}
            {spellingField}
            <p className="muted">Best: {getBest('score', `${c.settings.tier}-${c.settings.forgiveness}-${c.settings.range}`)}</p>
          </>
        )}

        {mode === 'survival' && (
          <>
            <h2>Survival</h2>
            <p className="muted hint">Name one synonym to get a new word. The clock gets shorter and the words get harder. One miss and it’s over.</p>
            {spellingField}
            <p className="muted">Best: {getBest('survival', `${c.settings.forgiveness}-${c.settings.range}`)} rounds</p>
          </>
        )}

        {mode === 'friends' && (
          <>
            <h2>Play Friends</h2>
            <p className="muted hint">Make a room and send the code to your friends (2–6 players). The host picks the settings.</p>
            {!user && (
              <label className="field">
                <span>Your name</span>
                <SketchBox className="input-wrap">
                  <input value={c.name} maxLength={16} onChange={(e) => setC({ ...c, name: e.target.value })} />
                </SketchBox>
              </label>
            )}
            <div className="play-row">
              <SketchButton big color="#ffd43b" onClick={() => onOnline({ ...c, name: c.name.trim() || 'You' }, { kind: 'create' })}>
                Create a room
              </SketchButton>
            </div>
            <form
              className="join-row"
              onSubmit={(e) => {
                e.preventDefault();
                const code = joinCode.trim().toUpperCase();
                if (ROOM_CODE_RE.test(code)) onOnline({ ...c, name: c.name.trim() || 'You' }, { kind: 'join', code });
              }}
            >
              <span className="muted">or join with a code</span>
              <SketchBox className="input-wrap code-input">
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.replace(/[^a-z]/gi, '').toUpperCase().slice(0, 4))}
                  placeholder="ABCD"
                  aria-label="Room code"
                  autoCapitalize="characters"
                  autoComplete="off"
                />
              </SketchBox>
              <SketchButton type="submit" disabled={!ROOM_CODE_RE.test(joinCode)}>
                Join
              </SketchButton>
            </form>
            {notice && <p className="error">{notice}</p>}
          </>
        )}

        {mode === 'ranked' && (
          <>
            <h2>Ranked</h2>
            <p className="muted hint">
              1v1 against someone near your rating. Everyone starts at 1000; your first games move it a lot, then it settles.
              Ranked always uses Medium words, Rapid time, Standard range and strict spelling.
            </p>
            {user ? (
              <p>
                Your rating: <b>{user.rating}</b>
                {user.provisional ? ' (still settling)' : ''} · record {user.rankedWins}–{user.rankedGames - user.rankedWins}
              </p>
            ) : (
              <p>Ranked games need an account, so your rating can follow you.</p>
            )}
            <div className="play-row">
              {user ? (
                <SketchButton big color="#ffd43b" onClick={() => onOnline(c, { kind: 'ranked' })}>
                  Find a match
                </SketchButton>
              ) : (
                <SketchButton big color="#ffd43b" onClick={openSignIn}>
                  Sign in to play
                </SketchButton>
              )}
            </div>
            <Leaderboard />
          </>
        )}

        {mode === 'daily' && (
          <>
            <h2>Daily Word</h2>
            <p className="muted hint">
              Everyone gets the same word today. You have 60 seconds and one try, so make it count. Then share your score!
            </p>
            {daily && (
              <p>
                Today you found <b>{daily.score}</b> synonyms for “{daily.word}”.
              </p>
            )}
          </>
        )}

        {mode !== 'friends' && mode !== 'ranked' && (
          <div className="play-row">
            <SketchButton big color="#ffd43b" onClick={start}>
              {mode === 'daily' && daily ? 'See results' : 'Play!'}
            </SketchButton>
          </div>
        )}
        {!user && (mode === 'score' || mode === 'daily' || mode === 'survival') && (
          <p className="muted signin-nudge">
            <button className="disagree" onClick={openSignIn}>
              Sign in
            </button>{' '}
            to keep your points.
          </p>
        )}
      </SketchBox>

      <SketchBox className="panel how">
        <h2>How to play</h2>
        <ol>
          <li>Everyone gets the same <b>starter word</b>.</li>
          <li>On your turn, say a <b>synonym</b> nobody has said yet, before the timer runs out.</li>
          <li>Think the last player made one up? <b>Challenge!</b></li>
          <li>If it really is a synonym, the challenger is out. If not, the bluffer is out. Last one standing wins.</li>
        </ol>
      </SketchBox>
      <AdSlot placement="home" />
    </div>
  );
}

function Leaderboard() {
  const [rows, setRows] = useState<{ username: string; rating: number; provisional: boolean; games: number }[] | null>(null);
  useEffect(() => {
    api
      .leaderboard()
      .then((r) => setRows(r.players))
      .catch(() => setRows([]));
  }, []);
  if (!rows?.length) return null;
  return (
    <div className="leaderboard">
      <h3>Top players</h3>
      <ol>
        {rows.slice(0, 10).map((r) => (
          <li key={r.username}>
            <span>{r.username}</span>
            <b>
              {r.rating}
              {r.provisional ? '?' : ''}
            </b>
          </li>
        ))}
      </ol>
    </div>
  );
}
