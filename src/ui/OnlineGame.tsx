// Online play: a room joined by code (friends) or by the ranked matchmaker.
// The server (worker/room.ts) runs the game; this screen shows its view and sends what the player does.

import { AnimatePresence, motion, useAnimate } from 'framer-motion';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { TIME_CONTROLS, type AfterElimination, type Settings, type TimeControl } from '../game/engine';
import { isSameWord, type Forgiveness } from '../game/match';
import { EMOTES, type ClientMessage, type Emote, type QueueMessage, type RoomView, type ServerMessage } from '../game/protocol';
import type { Range, Tier } from '../game/words';
import { socketUrl } from '../net/api';
import { useAccount } from './account';
import { Avatar, type Mood } from './Avatar';
import { Ruling } from './Game';
import { MeaningMap } from './MeaningMap';
import { reportRuling } from './reports';
import { Choice, JIGGLE, SketchBox, SketchButton } from './sketch';
import { sfx } from './sound';

const TIER_LABEL: Record<Tier, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
const RANGE_LABEL: Record<Range, string> = { close: 'Close only', standard: 'Standard', loose: 'Loose' };
const SPELLING_LABEL: Record<Forgiveness, string> = { strict: 'Strict', typos: 'Typos OK', soundalike: 'Sounds-alike' };

// ---------- connection ----------

function useRoomSocket(code: string, name: string) {
  const [room, setRoom] = useState<RoomView | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ id: number; text: string } | null>(null);
  const [emotes, setEmotes] = useState<{ id: number; playerId: string; emote: Emote }[]>([]);
  const [connected, setConnected] = useState(false);
  const deadline = useRef(0);
  const wsRef = useRef<WebSocket | null>(null);
  const joined = useRef(false);

  useEffect(() => {
    let stopped = false;
    let tries = 0;
    const keyName = `ss-room-${code}`;
    const open = () => {
      const ws = new WebSocket(socketUrl(`/api/rooms/${code}/ws`));
      wsRef.current = ws;
      ws.onopen = () => {
        tries = 0;
        setConnected(true);
        let key: string | undefined;
        try {
          key = sessionStorage.getItem(keyName) ?? undefined;
        } catch {
          /* storage unavailable */
        }
        ws.send(JSON.stringify({ t: 'hello', name, key } satisfies ClientMessage));
      };
      ws.onmessage = (e) => {
        const m = JSON.parse(e.data) as ServerMessage;
        if (m.t === 'room') {
          joined.current = true;
          if (m.room.play) deadline.current = performance.now() + m.room.play.timeLeftMs;
          try {
            sessionStorage.setItem(keyName, m.room.key);
          } catch {
            /* storage unavailable */
          }
          setRoom(m.room);
        } else if (m.t === 'error') {
          // Errors before we have a seat (room full, already started…) end the attempt.
          if (!joined.current) {
            stopped = true;
            setFatal(m.message);
          } else setNotice({ id: Date.now(), text: m.message });
        } else if (m.t === 'emote') {
          const id = Date.now() + Math.random();
          setEmotes((list) => [...list, { id, playerId: m.playerId, emote: m.emote }]);
          setTimeout(() => setEmotes((list) => list.filter((x) => x.id !== id)), 2500);
        }
      };
      ws.onclose = (e) => {
        setConnected(false);
        if (stopped) return;
        if (e.code === 4000) return setFatal('This game is open in another tab.');
        if (e.code === 4001) return setFatal('Your opponent didn’t connect. Try finding another match!');
        if (tries < 6) setTimeout(open, Math.min(8000, 500 * 2 ** tries++));
        else setFatal('Lost the connection to the game.');
      };
    };
    open();
    const ping = setInterval(() => wsRef.current?.readyState === WebSocket.OPEN && wsRef.current.send('{"t":"ping"}'), 25_000);
    return () => {
      stopped = true;
      clearInterval(ping);
      wsRef.current?.close(1000);
    };
  }, [code, name]);

  const send = (m: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify(m));
  };
  return { room, fatal, notice, emotes, connected, deadline, send };
}

// ---------- screen ----------

export function OnlineGame({ code, name, onExit, onFindMatch }: { code: string; name: string; onExit: () => void; onFindMatch: () => void }) {
  const { room, fatal, notice, emotes, connected, deadline, send } = useRoomSocket(code, name);
  const { refresh } = useAccount();
  const stage = room?.stage;
  useEffect(() => {
    if (stage === 'over') refresh(); // pick up new rating and points
  }, [stage, refresh]);

  if (fatal) {
    return (
      <div className="page gameover">
        <h1>Hmm…</h1>
        <p className="tagline">{fatal}</p>
        <div className="play-row">
          <SketchButton big color="#ffd43b" onClick={onExit}>
            Back to menu
          </SketchButton>
        </div>
      </div>
    );
  }
  if (!room) {
    return (
      <div className="page gameover">
        <p className="tagline">
          Joining room <b>{code}</b>
          <span className="dots" />
        </p>
      </div>
    );
  }
  return (
    <>
      {!connected && <p className="reconnecting">Reconnecting…</p>}
      {room.stage === 'lobby' && <Lobby room={room} send={send} onExit={onExit} notice={notice?.text} />}
      {room.stage === 'playing' && room.play && <Board room={room} send={send} onExit={onExit} notice={notice} emotes={emotes} deadline={deadline} />}
      {room.stage === 'over' && room.result && <Over room={room} send={send} onExit={onExit} onFindMatch={onFindMatch} />}
    </>
  );
}

// ---------- lobby ----------

function Lobby({ room, send, onExit, notice }: { room: RoomView; send: (m: ClientMessage) => void; onExit: () => void; notice?: string }) {
  const isHost = room.you === room.hostId;
  const [copied, setCopied] = useState(false);
  const s = room.settings;
  const set = (patch: Partial<Settings>) => send({ t: 'settings', settings: { ...s, ...patch } });
  const link = `${window.location.origin}/?room=${room.code}`;
  const ready = room.players.filter((p) => p.connected).length;

  async function share() {
    try {
      if (navigator.share) await navigator.share({ text: `Play Synonym Showdown with me! Room ${room.code}`, url: link });
      else await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      /* cancelled */
    }
  }

  return (
    <div className="page lobby">
      <div className="topbar">
        <SketchButton onClick={onExit} className="small">
          ✕ Leave
        </SketchButton>
        <span className="pill">{room.ranked ? 'Ranked match' : 'Private room'}</span>
      </div>

      {room.ranked ? (
        <SketchBox className="panel lobby-code">
          <h2>Ranked match</h2>
          <p className="tagline">
            Waiting for your opponent to connect<span className="dots" />
          </p>
        </SketchBox>
      ) : (
        <SketchBox className="panel lobby-code" fill="#fff3bf">
          <span className="muted">Room code</span>
          <motion.div className="code" initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: 'spring', bounce: 0.6 }}>
            {room.code}
          </motion.div>
          <SketchButton className="small" onClick={share}>
            {copied ? 'Link copied!' : 'Share invite link'}
          </SketchButton>
        </SketchBox>
      )}

      <SketchBox className="panel">
        <h2>Players ({room.players.length}/6)</h2>
        <div className="lobby-players">
          {room.players.map((p) => (
            <motion.div key={p.id} className={`lobby-player ${p.connected ? '' : 'away'}`} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', bounce: 0.6 }}>
              <Avatar id={p.id + p.name} color={p.color} size={48} mood={p.connected ? 'normal' : 'think'} />
              <span>
                {p.name}
                {p.id === room.you && ' (you)'}
              </span>
              <small className="muted">
                {p.id === room.hostId ? 'host · ' : ''}
                {p.guest ? 'guest' : `${p.rating ?? ''}`}
              </small>
              {p.flagged && <FlagTag />}
            </motion.div>
          ))}
        </div>
      </SketchBox>

      {!room.ranked && (
        <SketchBox className="panel settings">
          <h2>Settings</h2>
          {isHost ? (
            <>
              <Field label="Word difficulty">
                <Choice<Tier> value={s.tier} onChange={(v) => set({ tier: v })} color="#69db7c" options={(['easy', 'medium', 'hard'] as Tier[]).map((v) => ({ value: v, label: TIER_LABEL[v] }))} />
              </Field>
              <Field label="Time control">
                <Choice<TimeControl>
                  value={s.timeControl}
                  onChange={(v) => set({ timeControl: v })}
                  color="#4dabf7"
                  options={(Object.keys(TIME_CONTROLS) as TimeControl[]).map((k) => ({ value: k, label: TIME_CONTROLS[k].label, detail: TIME_CONTROLS[k].detail }))}
                />
              </Field>
              <Field label="Synonym range">
                <Choice<Range> value={s.range} onChange={(v) => set({ range: v })} color="#38d9a9" options={(['close', 'standard', 'loose'] as Range[]).map((v) => ({ value: v, label: RANGE_LABEL[v] }))} />
              </Field>
              <Field label="Spelling">
                <Choice<Forgiveness>
                  value={s.forgiveness}
                  onChange={(v) => set({ forgiveness: v })}
                  color="#da77f2"
                  options={(['strict', 'typos', 'soundalike'] as Forgiveness[]).map((v) => ({ value: v, label: SPELLING_LABEL[v] }))}
                />
              </Field>
              <Field label="After a knockout">
                <Choice<AfterElimination>
                  value={s.afterElimination}
                  onChange={(v) => set({ afterElimination: v })}
                  color="#ffa94d"
                  options={[
                    { value: 'newWord', label: 'New word' },
                    { value: 'sameWord', label: 'Keep word' },
                  ]}
                />
              </Field>
              <div className="play-row">
                <SketchButton big color="#ffd43b" disabled={ready < 2} onClick={() => send({ t: 'start' })}>
                  {ready < 2 ? 'Waiting for players…' : 'Start!'}
                </SketchButton>
              </div>
            </>
          ) : (
            <p>
              {TIER_LABEL[s.tier]} words · {TIME_CONTROLS[s.timeControl].label} · {RANGE_LABEL[s.range]} range · {SPELLING_LABEL[s.forgiveness]} spelling
              <br />
              <span className="muted">The host picks the settings and starts the game.</span>
            </p>
          )}
          {notice && <p className="error">{notice}</p>}
        </SketchBox>
      )}
    </div>
  );
}

/** Shown next to players the cheat detector has tagged. They can still play. */
function FlagTag() {
  return (
    <span className="flag-tag" title="Our cheat detector flagged unusual play. This player is under review.">
      under review
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <span>{label}</span>
      {children}
    </div>
  );
}

// ---------- the game ----------

function Board({
  room,
  send,
  onExit,
  notice,
  emotes,
  deadline,
}: {
  room: RoomView;
  send: (m: ClientMessage) => void;
  onExit: () => void;
  notice: { id: number; text: string } | null;
  emotes: { id: number; playerId: string; emote: Emote }[];
  deadline: React.MutableRefObject<number>;
}) {
  const play = room.play!;
  const me = room.players.find((p) => p.id === room.you);
  const current = room.players.find((p) => p.id === play.currentId);
  const myTurn = play.phase === 'playing' && play.currentId === room.you && !!me?.alive;
  const [input, setInput] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [left, setLeft] = useState(play.timeLeftMs);
  const [stage, setStage] = useState<'checking' | 'verdict'>('verdict');
  const [disputed, setDisputed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const chainRef = useRef<HTMLDivElement>(null);
  const [formScope, animateForm] = useAnimate<HTMLFormElement>();

  // Clock display (the server enforces the real deadline).
  useEffect(() => {
    let lastSec = -1;
    const id = setInterval(() => {
      const l = Math.max(0, deadline.current - performance.now());
      setLeft(l);
      const sec = Math.ceil(l / 1000);
      if (myTurn && sec <= 3 && sec !== lastSec && l > 0) sfx.tick();
      lastSec = sec;
    }, 100);
    return () => clearInterval(id);
  }, [deadline, myTurn]);

  // Sounds and scrolling as words arrive.
  const chainLen = play.chain.length;
  useEffect(() => {
    if (!chainLen) return;
    sfx.pop();
    chainRef.current?.scrollTo({ top: chainRef.current.scrollHeight, behavior: 'smooth' });
    const last = play.chain[chainLen - 1];
    if (pending && last.playerId === room.you && last.word === pending.trim().toLowerCase()) {
      setInput('');
      setPending(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chainLen]);

  // Challenge reveal: a short "checking…" beat, then the verdict.
  useEffect(() => {
    const ev = play.lastEvent;
    if (play.phase !== 'result' || !ev) return;
    setDisputed(false);
    if (ev.kind === 'challenge') {
      sfx.challenge();
      setStage('checking');
      const t = setTimeout(() => {
        setStage('verdict');
        if (ev.eliminatedId === room.you) sfx.bad();
        else sfx.good();
      }, 1200);
      return () => clearTimeout(t);
    }
    setStage('verdict');
    sfx.bad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play.eventCount, play.phase]);

  // Server rejected a word (repeat, starter…): jiggle and keep the word for the player to fix.
  useEffect(() => {
    if (!notice) return;
    sfx.error();
    setPending(null);
    animateForm('.input-wrap', JIGGLE.keyframes, JIGGLE.options);
    inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notice?.id]);

  useEffect(() => {
    if (myTurn) inputRef.current?.focus();
  }, [myTurn]);

  const repeatIndex = myTurn && input.trim().length > 1 ? play.chain.findIndex((c) => isSameWord(input, c.word, room.settings.forgiveness)) : -1;
  const repeat = repeatIndex >= 0 ? play.chain[repeatIndex] : null;
  const nameOf = (id: string) => (id === room.you ? 'You' : (room.players.find((p) => p.id === id)?.name ?? '?'));
  const prev = play.chain.at(-1);
  const budget = play.budgetMs;
  const isClock = room.settings.timeControl === 'clock';

  function say(e: FormEvent) {
    e.preventDefault();
    if (!myTurn || !input.trim()) return;
    setPending(input);
    send({ t: 'say', word: input.trim() });
    inputRef.current?.focus();
  }

  function moodFor(id: string, alive: boolean): Mood {
    if (!alive) return 'out';
    if (play.phase === 'playing' && play.currentId === id) return left < 3000 ? 'worried' : 'think';
    return 'normal';
  }

  return (
    <div className="page game">
      <div className="topbar">
        <SketchButton onClick={onExit} className="small">
          ✕ Leave
        </SketchButton>
        <span className="pill">
          {room.ranked ? 'Ranked' : `Room ${room.code}`} · {TIER_LABEL[play.starter.tier]} words
        </span>
      </div>

      <AnimatePresence mode="popLayout">
        <motion.div
          key={play.starter.word}
          initial={{ scale: 0.3, rotate: -10, opacity: 0 }}
          animate={{ scale: 1, rotate: -1.5, opacity: 1 }}
          exit={{ scale: 0.3, rotate: 10, opacity: 0 }}
          transition={{ type: 'spring', bounce: 0.55 }}
        >
          <SketchBox className="starter" fill="#fff3bf" strokeWidth={2.5}>
            <span className="starter-label">Name a synonym for</span>
            <span className="starter-word">{play.starter.word}</span>
          </SketchBox>
        </motion.div>
      </AnimatePresence>

      <div className="players">
        {room.players.map((p) => {
          const active = play.phase === 'playing' && play.currentId === p.id;
          const t = active ? left : isClock ? p.bankMs : budget;
          const emote = emotes.filter((e) => e.playerId === p.id).at(-1);
          return (
            <motion.div
              key={p.id}
              className={`seat ${active ? 'active' : ''} ${p.alive ? '' : 'out'} ${p.connected ? '' : 'away'}`}
              animate={active ? { y: [0, -6, 0] } : { y: 0 }}
              transition={active ? { repeat: Infinity, duration: 1.1 } : undefined}
            >
              <AnimatePresence>
                {emote && (
                  <motion.span key={emote.id} className="emote-pop" initial={{ y: 10, scale: 0 }} animate={{ y: -8, scale: 1 }} exit={{ opacity: 0 }}>
                    {emote.emote}
                  </motion.span>
                )}
              </AnimatePresence>
              <Avatar id={p.id + p.name} color={p.color} mood={moodFor(p.id, p.alive)} size={58} />
              <span className="seat-name">{p.id === room.you ? `${p.name} (you)` : p.name}</span>
              {p.flagged && <FlagTag />}
              {p.alive && (
                <div className="timer">
                  <div className={`timer-fill ${t < 3000 && active ? 'low' : ''}`} style={{ width: `${(t / budget) * 100}%`, background: p.color }} />
                  {(active || isClock) && <span className="timer-text">{Math.ceil(t / 1000)}s</span>}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      <div className="chain" ref={chainRef}>
        {play.chain.length === 0 && play.phase === 'playing' && (
          <p className="chain-empty">{myTurn ? 'You go first. Say a synonym!' : `${current?.name ?? '?'} goes first…`}</p>
        )}
        <AnimatePresence initial={false}>
          {play.chain.map((c, i) => {
            const p = room.players.find((x) => x.id === c.playerId);
            return (
              <motion.div
                key={`${play.starter.word}-${i}`}
                data-index={i}
                className={`bubble-row ${c.playerId === room.you ? 'mine' : ''} ${repeatIndex === i ? 'echo' : ''}`}
                initial={{ scale: 0.5, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ type: 'spring', bounce: 0.6 }}
              >
                <Avatar id={(p?.id ?? '') + (p?.name ?? '')} color={p?.color ?? '#ccc'} size={30} mood={p?.alive ? 'normal' : 'out'} />
                <SketchBox className={`bubble ${c.rejected ? 'rejected' : ''} ${c.confirmed ? 'confirmed' : ''}`}>
                  <small>{c.playerId === room.you ? 'you' : p?.name}</small>
                  <span>{c.word}</span>
                  {c.rejected && <b className="mark bad">✗</b>}
                  {c.confirmed && <b className="mark good">✓</b>}
                </SketchBox>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <div className="controls">
        {myTurn ? (
          <>
            <form ref={formScope} onSubmit={say} className="say-form">
              <SketchBox className="input-wrap big">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type a synonym…"
                  maxLength={40}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  enterKeyHint="send"
                />
              </SketchBox>
              <SketchButton type="submit" color="#69db7c" onMouseDown={(e) => e.preventDefault()}>
                Say it!
              </SketchButton>
            </form>
            {notice && Date.now() - notice.id < 4000 ? (
              <p className="error">{notice.text}</p>
            ) : (
              repeat && (
                <p className="repeat-hint">
                  {nameOf(repeat.playerId)} already said “{repeat.word}”
                </p>
              )
            )}
            {play.canChallenge && prev && (
              <SketchButton className="challenge-btn" color="#ff6b6b" onClick={() => send({ t: 'challenge' })}>
                Challenge “{prev.word}”!
              </SketchButton>
            )}
          </>
        ) : (
          <p className="waiting">
            {me && !me.alive ? 'You’re out. Watch the rest!' : play.phase === 'playing' ? <>{current?.name} is thinking<span className="dots" /></> : ' '}
          </p>
        )}
        <div className="emote-bar">
          {EMOTES.map((e) => (
            <button key={e} onMouseDown={(ev) => ev.preventDefault()} onClick={() => send({ t: 'emote', emote: e })}>
              {e}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {play.phase === 'result' && play.lastEvent && (
          <motion.div key={play.eventCount} className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div initial={{ scale: 0.5, rotate: -4 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', bounce: 0.55 }}>
              <SketchBox className="result-card" fill="#fff">
                {play.lastEvent.kind === 'timeout' ? (
                  <>
                    <div className="result-icon">⏰</div>
                    <h2>Time’s up!</h2>
                    <p className="result-out">{play.lastEvent.eliminatedId === room.you ? 'You’re out!' : `${nameOf(play.lastEvent.eliminatedId)} is out!`}</p>
                  </>
                ) : stage === 'checking' ? (
                  <>
                    <p>
                      <b>{nameOf(play.lastEvent.challengerId)}</b> challenged <b>{nameOf(play.lastEvent.accusedId)}</b>!
                    </p>
                    <motion.div className="result-icon" animate={{ rotate: [0, -20, 20, -10, 0], x: [0, -10, 10, 0] }} transition={{ repeat: Infinity, duration: 1 }}>
                      🔍
                    </motion.div>
                    <p>
                      Is <b>“{play.lastEvent.word}”</b> a synonym for <b>“{play.starter.word}”</b>?
                    </p>
                  </>
                ) : (
                  <>
                    <motion.div
                      className={`stamp ${play.lastEvent.valid ? 'good' : 'bad'}`}
                      initial={{ scale: 3, opacity: 0, rotate: -20 }}
                      animate={{ scale: 1, opacity: 1, rotate: -8 }}
                      transition={{ type: 'spring', bounce: 0.4 }}
                    >
                      {play.lastEvent.valid ? 'Synonym!' : 'Bluff!'}
                    </motion.div>
                    <Ruling starter={play.starter.word} range={room.settings.range} ev={play.lastEvent} />
                    <p className="result-out">{play.lastEvent.eliminatedId === room.you ? 'You’re out!' : `${nameOf(play.lastEvent.eliminatedId)} is out!`}</p>
                    <div className="result-foot">
                      {disputed ? (
                        <small className="disagree done">Thanks, we’ll review it!</small>
                      ) : (
                        <button
                          className="disagree"
                          onClick={() => {
                            const ev = play.lastEvent!;
                            if (ev.kind !== 'challenge') return;
                            reportRuling({ starter: play.starter.word, word: ev.word, ruling: ev.valid ? 'accepted' : 'rejected', range: room.settings.range, mode: room.ranked ? 'ranked' : 'room' });
                            setDisputed(true);
                          }}
                        >
                          Disagree?
                        </button>
                      )}
                    </div>
                  </>
                )}
              </SketchBox>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------- end of game ----------

function Over({ room, send, onExit, onFindMatch }: { room: RoomView; send: (m: ClientMessage) => void; onExit: () => void; onFindMatch: () => void }) {
  const r = room.result!;
  const mine = r.places.find((p) => p.id === room.you);
  const won = mine?.place === 1;
  const change = r.ratingChanges[room.you];
  const me = room.players.find((p) => p.id === room.you);
  useEffect(() => {
    if (won) sfx.win();
  }, [won]);

  return (
    <div className="page gameover">
      <motion.div initial={{ scale: 0.4, rotate: -8 }} animate={{ scale: 1, rotate: -2 }} transition={{ type: 'spring', bounce: 0.6 }}>
        <Avatar id={(me?.id ?? '') + (me?.name ?? '')} color={me?.color ?? '#4dabf7'} mood={won ? 'win' : 'out'} size={110} />
      </motion.div>
      <motion.h1 initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        {won ? (
          <>
            You <span className="hl">win!</span>
          </>
        ) : (
          <>{r.places[0]?.name} wins!</>
        )}
      </motion.h1>
      {change && (
        <motion.p className={`rating-change ${change.after >= change.before ? 'up' : 'down'}`} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.4, type: 'spring', bounce: 0.6 }}>
          Rating {change.before} → {change.after} ({change.after >= change.before ? '+' : ''}
          {change.after - change.before})
        </motion.p>
      )}
      <SketchBox className="panel places">
        {r.places.map((p) => (
          <p key={p.id} className={p.id === room.you ? 'me' : ''}>
            <b>{['🥇', '🥈', '🥉'][p.place - 1] ?? `${p.place}.`}</b> {p.name}
            {r.ratingChanges[p.id] && <small className="muted"> · {r.ratingChanges[p.id].after}</small>}
          </p>
        ))}
      </SketchBox>
      <MeaningMap starter={r.starter} said={new Set(r.said)} range={room.settings.range} />
      <div className="play-row">
        {room.ranked ? (
          <SketchButton big color="#ffd43b" onClick={onFindMatch}>
            Find another match
          </SketchButton>
        ) : room.you === room.hostId ? (
          <SketchButton big color="#ffd43b" onClick={() => send({ t: 'again' })}>
            Play again
          </SketchButton>
        ) : (
          <p className="muted">Waiting for the host to start another round…</p>
        )}
        <SketchButton onClick={onExit}>Menu</SketchButton>
      </div>
    </div>
  );
}

// ---------- ranked matchmaking ----------

export function RankedQueue({ onMatched, onCancel }: { onMatched: (code: string) => void; onCancel: () => void }) {
  const { user } = useAccount();
  const [status, setStatus] = useState<string>('Connecting…');
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const ws = new WebSocket(socketUrl('/api/queue/ws'));
    const started = Date.now();
    const tick = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    const ping = setInterval(() => ws.readyState === WebSocket.OPEN && ws.send('{"t":"ping"}'), 25_000);
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data) as QueueMessage;
      if (m.t === 'matched') onMatched(m.code);
      else if (m.t === 'waiting') setStatus(m.inQueue > 1 ? `${m.inQueue} players searching` : 'Looking for an opponent');
      else setStatus(m.message);
    };
    ws.onclose = (e) => {
      if (e.code !== 1000) setStatus(e.code === 4000 ? 'Searching in another tab.' : 'Lost connection. Try again.');
    };
    return () => {
      clearInterval(tick);
      clearInterval(ping);
      ws.close(1000);
    };
  }, [onMatched]);

  return (
    <div className="page gameover">
      <motion.div animate={{ rotate: [0, -8, 8, 0] }} transition={{ repeat: Infinity, duration: 1.6 }}>
        <Avatar id="queue" color="#4dabf7" mood="think" size={110} />
      </motion.div>
      <h1>Ranked</h1>
      <p className="tagline">
        {status}
        <span className="dots" /> {elapsed}s
      </p>
      {user && (
        <p className="muted">
          Your rating: {user.rating}
          {user.provisional ? ' (still settling)' : ''}
        </p>
      )}
      <div className="play-row">
        <SketchButton onClick={onCancel}>Cancel</SketchButton>
      </div>
    </div>
  );
}
