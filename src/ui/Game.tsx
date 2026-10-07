// The game table: starter word, players, word chain, and your controls.
// This file wires the pure rules (game/engine.ts) to timers, bots and the screen.

import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { botThinkMs, BOT_NAMES, decideBotMove } from '../game/bot';
import {
  alivePlayers,
  canChallenge,
  challenge,
  continueGame,
  createGame,
  lastPlay,
  player,
  submitWord,
  timeLeft,
  timeout,
  turnBudget,
  type GameEvent,
  type GameState,
  type SubmitError,
} from '../game/engine';
import { Avatar, type Mood } from './Avatar';
import { PLAYER_COLORS, type GameConfig } from './config';
import { GameOver } from './GameOver';
import { SketchBox, SketchButton } from './sketch';
import { sfx } from './sound';

const YOU = 'you';
const CHECKING_MS = 1300;
const TIER_LABEL = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
const VERDICT_MS = 2600;

const ERRORS: Record<SubmitError, string> = {
  empty: 'Type a word first!',
  starter: 'That’s the starter word!',
  repeat: 'Already said!',
  notYourTurn: 'Wait for your turn!',
};

function newGame(config: GameConfig): GameState {
  if (config.mode === 'pass') {
    const humans = config.passNames.map((name, i) => ({ id: `p${i}`, name, isBot: false, color: PLAYER_COLORS[i] }));
    return createGame(config.settings, humans, Math.random, Date.now());
  }
  const names = [...BOT_NAMES].sort(() => Math.random() - 0.5);
  const setups = [
    { id: YOU, name: config.name, isBot: false, color: PLAYER_COLORS[0] },
    ...Array.from({ length: config.bots }, (_, i) => ({
      id: `bot${i}`,
      name: names[i],
      isBot: true,
      botLevel: config.botLevel,
      color: PLAYER_COLORS[i + 1],
    })),
  ];
  return createGame(config.settings, setups, Math.random, Date.now());
}

export function Game({ config, onExit }: { config: GameConfig; onExit: () => void }) {
  const [state, setStateRaw] = useState(() => newGame(config));
  const stateRef = useRef(state);
  const setState = useCallback((s: GameState) => {
    stateRef.current = s;
    setStateRaw(s);
  }, []);
  const [now, setNow] = useState(Date.now());
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [stage, setStage] = useState<'checking' | 'verdict'>('verdict');
  const [finished, setFinished] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const chainRef = useRef<HTMLDivElement>(null);

  const passPlay = config.mode === 'pass';
  const current = player(state, state.currentId);
  // In pass-and-play every human types on this device; otherwise only "you" do.
  const myTurn = state.phase === 'playing' && !current.isBot;

  // Clock: redraw timers and enforce timeouts.
  useEffect(() => {
    let lastSec = -1;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      const s = stateRef.current;
      if (s.phase !== 'playing') return;
      const left = timeLeft(s, t);
      if (left <= 0) {
        setState(timeout(s, t));
        sfx.bad();
        return;
      }
      const sec = Math.ceil(left / 1000);
      if (!player(s, s.currentId).isBot && sec <= 3 && sec !== lastSec) sfx.tick();
      lastSec = sec;
    }, 100);
    return () => clearInterval(id);
  }, [setState]);

  // Bots: think, then move.
  useEffect(() => {
    if (state.phase !== 'playing' || !current.isBot) return;
    const turnId = state.turnStartedAt;
    const timer = setTimeout(() => {
      const s = stateRef.current;
      if (s.phase !== 'playing' || s.turnStartedAt !== turnId) return;
      const bot = player(s, s.currentId);
      const move = decideBotMove(s, bot, Math.random);
      const t = Date.now();
      if (move.type === 'challenge') {
        sfx.challenge();
        setState(challenge(s, bot.id, t));
      } else if (move.type === 'say') {
        const r = submitWord(s, bot.id, move.word, t);
        if (!r.error) {
          sfx.pop();
          setState(r.state);
        }
      } // 'stall': the bot is stumped and will time out
    }, botThinkMs(state, current, Math.random, Date.now()));
    return () => clearTimeout(timer);
  }, [state.phase, state.currentId, state.turnStartedAt, current, state, setState]);

  // Results: show "checking…", then the verdict, then move on.
  useEffect(() => {
    if (state.phase !== 'result' || !state.lastEvent) return;
    const ev = state.lastEvent;
    const showVerdict = () => {
      setStage('verdict');
      if (ev.eliminatedId === YOU || passPlay) sfx.bad();
      else if (ev.kind === 'challenge') sfx.good();
    };
    let t1: ReturnType<typeof setTimeout> | undefined;
    if (ev.kind === 'challenge') {
      setStage('checking');
      t1 = setTimeout(showVerdict, CHECKING_MS);
    } else {
      setStage('verdict');
    }
    const t2 = setTimeout(() => advance(), (ev.kind === 'challenge' ? CHECKING_MS : 0) + VERDICT_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.lastEvent]);

  function advance() {
    const s = stateRef.current;
    if (s.phase !== 'result') return;
    // Knocked out: end here so the end screen shows the word you went out on.
    if (!passPlay && !player(s, YOU).alive) {
      setFinished(true);
      return;
    }
    const next = continueGame(s, Math.random, Date.now());
    if (next.phase === 'over') {
      setState(next);
      setFinished(true);
      if (next.winnerId === YOU || passPlay) sfx.win();
      return;
    }
    setState(next);
  }

  // Keep the newest word in view and focus the box on your turn.
  useEffect(() => {
    chainRef.current?.scrollTo({ top: chainRef.current.scrollHeight, behavior: 'smooth' });
  }, [state.chain.length]);
  useEffect(() => {
    if (myTurn) inputRef.current?.focus();
  }, [myTurn]);

  function say(e: FormEvent) {
    e.preventDefault();
    if (!myTurn) return;
    const r = submitWord(state, state.currentId, input, Date.now());
    if (r.error) {
      setError(ERRORS[r.error]);
      setShake((n) => n + 1);
      sfx.error();
      return;
    }
    sfx.pop();
    setError(null);
    setInput('');
    setState(r.state);
  }

  function callChallenge() {
    if (!myTurn || !canChallenge(state)) return;
    sfx.challenge();
    setInput('');
    setError(null);
    setState(challenge(state, state.currentId, Date.now()));
  }

  function restart() {
    setFinished(false);
    setInput('');
    setError(null);
    setState(newGame(config));
  }

  if (finished) {
    return <GameOver state={state} youId={passPlay ? null : YOU} onAgain={restart} onMenu={onExit} />;
  }

  const prev = lastPlay(state);
  const budget = turnBudget(state);
  const isClock = state.settings.timeControl === 'clock';

  function moodFor(id: string): Mood {
    const p = player(state, id);
    if (!p.alive) return 'out';
    if (state.phase === 'playing' && state.currentId === id) {
      return state.phase === 'playing' && timeLeft(state, now) < 3000 ? 'worried' : 'think';
    }
    return 'normal';
  }

  return (
    <div className="page game">
      <div className="topbar">
        <SketchButton onClick={onExit} className="small">
          ✕ Quit
        </SketchButton>
        <span className="pill">
          {TIER_LABEL[state.settings.tier]} words · {alivePlayers(state).length} left
        </span>
      </div>

      <AnimatePresence mode="popLayout">
        <motion.div
          key={state.starter.word}
          initial={{ scale: 0.3, rotate: -10, opacity: 0 }}
          animate={{ scale: 1, rotate: -1.5, opacity: 1 }}
          exit={{ scale: 0.3, rotate: 10, opacity: 0 }}
          transition={{ type: 'spring', bounce: 0.55 }}
        >
          <SketchBox className="starter" fill="#fff3bf" fillStyle="hachure" strokeWidth={2.5}>
            <span className="starter-label">Name a synonym for</span>
            <span className="starter-word">{state.starter.word}</span>
          </SketchBox>
        </motion.div>
      </AnimatePresence>

      <div className="players">
        {state.players.map((p) => {
          const active = state.phase === 'playing' && state.currentId === p.id;
          const left = active ? Math.max(0, timeLeft(state, now)) : isClock ? p.bankMs : budget;
          return (
            <motion.div
              key={p.id}
              className={`seat ${active ? 'active' : ''} ${p.alive ? '' : 'out'}`}
              animate={active ? { y: [0, -6, 0] } : { y: 0 }}
              transition={active ? { repeat: Infinity, duration: 1.1 } : undefined}
            >
              <Avatar id={p.id + p.name} color={p.color} mood={moodFor(p.id)} size={58} />
              <span className="seat-name">{p.id === YOU && p.name !== 'You' ? `${p.name} (you)` : p.name}</span>
              {p.alive && (
                <div className="timer">
                  <div
                    className={`timer-fill ${left < 3000 && active ? 'low' : ''}`}
                    style={{ width: `${(left / budget) * 100}%`, background: p.color }}
                  />
                  {(active || isClock) && <span className="timer-text">{Math.ceil(left / 1000)}s</span>}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      <div className="chain" ref={chainRef}>
        {state.chain.length === 0 && (
          <p className="chain-empty">
            {state.phase === 'playing' &&
              (myTurn && !passPlay ? 'You go first. Say a synonym!' : `${current.name} goes first…`)}
          </p>
        )}
        <AnimatePresence initial={false}>
          {state.chain.map((play, i) => {
            const p = player(state, play.playerId);
            return (
              <motion.div
                key={`${state.starter.word}-${i}`}
                className={`bubble-row ${play.playerId === YOU ? 'mine' : ''}`}
                initial={{ scale: 0.5, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ type: 'spring', bounce: 0.6 }}
              >
                <Avatar id={p.id + p.name} color={p.color} size={30} mood={p.alive ? 'normal' : 'out'} />
                <SketchBox className={`bubble ${play.rejected ? 'rejected' : ''} ${play.confirmed ? 'confirmed' : ''}`}>
                  <small>{p.id === YOU ? 'you' : p.name}</small>
                  <span>{play.word}</span>
                  {play.rejected && <b className="mark bad">✗</b>}
                  {play.confirmed && <b className="mark good">✓</b>}
                </SketchBox>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <div className="controls">
        {myTurn ? (
          <>
            {passPlay && (
              <p className="turn-label">
                <span className="hl">{current.name}</span>’s turn
              </p>
            )}
            <motion.form key={shake} onSubmit={say} className="say-form" animate={shake ? { x: [0, -10, 10, -6, 6, 0] } : {}}>
              <SketchBox className="input-wrap big">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    setError(null);
                  }}
                  placeholder="Type a synonym…"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  enterKeyHint="send"
                />
              </SketchBox>
              <SketchButton type="submit" color="#69db7c">
                Say it!
              </SketchButton>
            </motion.form>
            {error && <p className="error">{error}</p>}
            {canChallenge(state) && prev && (
              <SketchButton className="challenge-btn" color="#ff6b6b" onClick={callChallenge}>
                Challenge “{prev.word}”!
              </SketchButton>
            )}
          </>
        ) : (
          <p className="waiting">
            {state.phase === 'playing' ? (
              <>
                {current.name} is thinking<span className="dots" />
              </>
            ) : (
              ' '
            )}
          </p>
        )}
      </div>

      <AnimatePresence>
        {state.phase === 'result' && state.lastEvent && (
          <ResultOverlay key={state.log.length} state={state} ev={state.lastEvent} stage={stage} onNext={advance} />
        )}
      </AnimatePresence>
    </div>
  );
}

function ResultOverlay({
  state,
  ev,
  stage,
  onNext,
}: {
  state: GameState;
  ev: GameEvent;
  stage: 'checking' | 'verdict';
  onNext: () => void;
}) {
  const name = (id: string) => (id === YOU ? 'You' : player(state, id).name);
  const out = player(state, ev.eliminatedId);
  const outText = ev.eliminatedId === YOU ? 'You’re out!' : `${out.name} is out!`;

  return (
    <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => stage === 'verdict' && onNext()}>
      <motion.div initial={{ scale: 0.5, rotate: -4 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', bounce: 0.55 }}>
        <SketchBox className="result-card" fill="#fff">
          {ev.kind === 'timeout' ? (
            <>
              <div className="result-icon">⏰</div>
              <h2>Time’s up!</h2>
              <p className="result-out">{outText}</p>
            </>
          ) : stage === 'checking' ? (
            <>
              <p>
                <b>{name(ev.challengerId)}</b> challenged <b>{name(ev.accusedId)}</b>!
              </p>
              <motion.div className="result-icon" animate={{ rotate: [0, -20, 20, -10, 0], x: [0, -10, 10, 0] }} transition={{ repeat: Infinity, duration: 1 }}>
                🔍
              </motion.div>
              <p>
                Is <b>“{ev.word}”</b> a synonym for <b>“{state.starter.word}”</b>?
              </p>
            </>
          ) : (
            <>
              <motion.div
                className={`stamp ${ev.valid ? 'good' : 'bad'}`}
                initial={{ scale: 3, opacity: 0, rotate: -20 }}
                animate={{ scale: 1, opacity: 1, rotate: -8 }}
                transition={{ type: 'spring', bounce: 0.4 }}
              >
                {ev.valid ? 'Synonym!' : 'Bluff!'}
              </motion.div>
              <p>
                “{ev.word}” {ev.valid ? 'is' : 'is not'} a synonym for “{state.starter.word}”.
              </p>
              <p className="result-out">{outText}</p>
              <small className="tap">tap to continue</small>
            </>
          )}
        </SketchBox>
      </motion.div>
    </motion.div>
  );
}
