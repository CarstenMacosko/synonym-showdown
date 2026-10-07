// Score Attack, Daily Word and Survival: type synonyms, each checked instantly.

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Forgiveness } from '../game/match';
import {
  createSolo,
  guessSolo,
  soloTimeLeft,
  tickSolo,
  todayKey,
  type GuessResult,
  type SoloMode,
  type SoloState,
} from '../game/solo';
import { synonymWords, type Tier } from '../game/words';
import { Avatar } from './Avatar';
import { getBest, getDaily, recordBest, saveDaily, type DailyResult } from './records';
import { SketchBox, SketchButton } from './sketch';
import { sfx } from './sound';

export const SOLO_TITLES: Record<SoloMode, string> = {
  score: 'Score Attack',
  daily: 'Daily Word',
  survival: 'Survival',
};

const FEEDBACK: Record<Exclude<GuessResult, 'ok'>, string> = {
  repeat: 'Already got that one!',
  wrong: 'Not a synonym!',
  starter: 'That’s the word itself!',
  empty: 'Type a word first!',
};

interface Props {
  mode: SoloMode;
  tier: Tier;
  forgiveness: Forgiveness;
  onExit: () => void;
}

export function SoloGame(props: Props) {
  const { mode } = props;
  const dateKey = todayKey();
  const [done, setDone] = useState<DailyResult | null>(() => (mode === 'daily' ? getDaily(dateKey) : null));
  const [runId, setRunId] = useState(0);

  if (done && mode === 'daily') {
    return <SoloOver {...props} state={null} daily={done} dateKey={dateKey} newBest={false} onAgain={null} />;
  }
  return (
    <SoloRun
      key={runId}
      {...props}
      dateKey={dateKey}
      onDailyDone={setDone}
      onAgain={() => setRunId((n) => n + 1)}
    />
  );
}

function SoloRun({
  mode,
  tier,
  forgiveness,
  onExit,
  dateKey,
  onDailyDone,
  onAgain,
}: Props & { dateKey: string; onDailyDone: (r: DailyResult) => void; onAgain: () => void }) {
  const [state, setState] = useState<SoloState>(() => createSolo(mode, { tier, forgiveness, dateKey }, Math.random, Date.now()));
  const [now, setNow] = useState(Date.now());
  const [input, setInput] = useState('');
  const [feedback, setFeedback] = useState<{ id: number; text: string; good: boolean } | null>(null);
  const [newBest, setNewBest] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  const inputRef = useRef<HTMLInputElement>(null);

  const variant = mode === 'score' ? `${tier}-${forgiveness}` : forgiveness;

  function finish(s: SoloState) {
    if (mode === 'daily') {
      const result = { word: s.starter.word, score: s.score, found: s.found };
      saveDaily(dateKey, result);
      onDailyDone(result);
      return;
    }
    setNewBest(recordBest(mode, variant, s.score));
    s.score > 0 ? sfx.win() : sfx.bad();
  }

  useEffect(() => {
    let lastSec = -1;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      const s = stateRef.current;
      if (s.over) return;
      const next = tickSolo(s, t);
      if (next.over) {
        setState(next);
        finish(next);
        return;
      }
      const sec = Math.ceil(soloTimeLeft(s, t) / 1000);
      if (sec <= 3 && sec !== lastSec) sfx.tick();
      lastSec = sec;
    }, 100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => inputRef.current?.focus(), []);

  function guess(e: FormEvent) {
    e.preventDefault();
    if (state.over) return;
    const r = guessSolo(state, input, Date.now(), Math.random);
    const id = Date.now();
    if (r.result === 'ok') {
      sfx.pop();
      setFeedback({ id, text: `+1  ${r.canonical}`, good: true });
      setInput('');
    } else {
      sfx.error();
      const penalty = r.result === 'wrong' && mode !== 'survival' ? ' (−2s)' : '';
      setFeedback({ id, text: FEEDBACK[r.result] + penalty, good: false });
      if (r.result !== 'empty') setInput('');
    }
    setState(r.state);
    if (r.state.over) finish(r.state);
    inputRef.current?.focus();
  }

  if (state.over && mode !== 'daily') {
    return <SoloOver mode={mode} tier={tier} forgiveness={forgiveness} onExit={onExit} state={state} daily={null} dateKey={dateKey} newBest={newBest} onAgain={onAgain} />;
  }

  const left = soloTimeLeft(state, now);
  const best = mode === 'daily' ? null : getBest(mode, variant);

  return (
    <div className="page game solo">
      <div className="topbar">
        <SketchButton onClick={onExit} className="small">
          ✕ Quit
        </SketchButton>
        <span className="pill">
          {SOLO_TITLES[mode]}
          {mode === 'survival' && ` · round ${state.round}`}
          {best ? ` · best ${best}` : ''}
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
          <SketchBox className="starter" fill="#fff3bf" strokeWidth={2.5}>
            <span className="starter-label">Name a synonym for</span>
            <span className="starter-word">{state.starter.word}</span>
          </SketchBox>
        </motion.div>
      </AnimatePresence>

      <div className="solo-hud">
        <motion.div key={state.score} className="solo-score" initial={{ scale: 1.6 }} animate={{ scale: 1 }} transition={{ type: 'spring', bounce: 0.6 }}>
          {state.score}
        </motion.div>
        <div className="timer solo-timer">
          <div className={`timer-fill ${left < 3000 ? 'low' : ''}`} style={{ width: `${(left / state.roundMs) * 100}%`, background: '#4dabf7' }} />
          <span className="timer-text">{Math.ceil(left / 1000)}s</span>
        </div>
      </div>

      <form onSubmit={guess} className="say-form">
        <SketchBox className="input-wrap big">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a synonym…"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="send"
          />
        </SketchBox>
        <SketchButton type="submit" color="#69db7c">
          Go!
        </SketchButton>
      </form>

      <div className="feedback-slot">
        <AnimatePresence mode="popLayout">
          {feedback && (
            <motion.p
              key={feedback.id}
              className={`feedback ${feedback.good ? 'good' : 'bad'}`}
              initial={{ y: 10, opacity: 0, scale: 0.8 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -14, opacity: 0 }}
              transition={{ type: 'spring', bounce: 0.6 }}
            >
              {feedback.text}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {mode !== 'survival' && (
        <div className="word-cloud found">
          {state.found.map((w, i) => (
            <motion.span key={w} initial={{ scale: 0 }} animate={{ scale: 1, rotate: ((i * 37) % 9) - 4 }} transition={{ type: 'spring', bounce: 0.6 }}>
              {w}
            </motion.span>
          ))}
        </div>
      )}
    </div>
  );
}

function shareText(dateKey: string, d: DailyResult): string {
  const squares = '🟨'.repeat(Math.min(d.score, 20)) + (d.score > 20 ? '+' : '');
  return `Synonym Showdown · Daily ${dateKey}\n“${d.word}”: ${d.score} synonym${d.score === 1 ? '' : 's'} in 60s\n${squares || '⬜'}`;
}

function SoloOver({
  mode,
  onExit,
  state,
  daily,
  dateKey,
  newBest,
  onAgain,
}: Props & { state: SoloState | null; daily: DailyResult | null; dateKey: string; newBest: boolean; onAgain: (() => void) | null }) {
  const [copied, setCopied] = useState(false);
  const word = daily?.word ?? state!.starter.word;
  const score = daily?.score ?? state!.score;
  const starter = state?.starter;
  const [missed] = useState(() => {
    const found = new Set(daily?.found ?? state?.found ?? []);
    const syns = starter ? synonymWords(starter) : [];
    return syns.filter((w) => !found.has(w)).sort(() => Math.random() - 0.5).slice(0, 12);
  });

  async function share() {
    const text = shareText(dateKey, daily!);
    try {
      if (navigator.share) await navigator.share({ text });
      else await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      /* user cancelled */
    }
  }

  const headline =
    mode === 'survival' ? `${score} round${score === 1 ? '' : 's'}` : `${score} synonym${score === 1 ? '' : 's'}`;

  return (
    <div className="page gameover">
      <motion.div initial={{ scale: 0.4, rotate: -8 }} animate={{ scale: 1, rotate: -2 }} transition={{ type: 'spring', bounce: 0.6 }}>
        <Avatar id="solo" color="#4dabf7" mood={score > 0 ? 'win' : 'out'} size={110} />
      </motion.div>
      <p className="tagline">{SOLO_TITLES[mode]}{mode === 'daily' ? ` · ${dateKey}` : ''}</p>
      <motion.h1 initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }}>
        <span className="hl">{headline}</span>
      </motion.h1>
      {newBest && (
        <motion.p className="new-best" initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: -6 }} transition={{ delay: 0.4, type: 'spring', bounce: 0.6 }}>
          New best!
        </motion.p>
      )}
      {state?.endReason === 'wrong' && state.lastWrong && (
        <p className="tagline">
          “{state.lastWrong}” isn’t a synonym for “{word}”.
        </p>
      )}
      {mode === 'daily' && <p className="tagline">Come back tomorrow for a new word!</p>}

      {(missed.length > 0 || daily) && (
        <SketchBox className="panel missed">
          <h2>
            {daily ? 'Your words for ' : 'Other synonyms for '}
            <span className="hl">{word}</span>
          </h2>
          <div className="word-cloud">
            {(daily ? daily.found : missed).map((w, i) => (
              <motion.span key={w} initial={{ scale: 0 }} animate={{ scale: 1, rotate: ((i * 37) % 9) - 4 }} transition={{ delay: 0.3 + i * 0.04, type: 'spring', bounce: 0.6 }}>
                {w}
              </motion.span>
            ))}
            {daily && daily.found.length === 0 && <span className="muted">none this time</span>}
          </div>
        </SketchBox>
      )}

      <div className="play-row">
        {daily && (
          <SketchButton big color="#69db7c" onClick={share}>
            {copied ? 'Copied!' : 'Share'}
          </SketchButton>
        )}
        {onAgain && (
          <SketchButton big color="#ffd43b" onClick={onAgain}>
            Play again
          </SketchButton>
        )}
        <SketchButton onClick={onExit}>Menu</SketchButton>
      </div>
    </div>
  );
}
