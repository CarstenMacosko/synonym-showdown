// Score Attack, Daily Word and Survival: type synonyms, each checked instantly.

import { AnimatePresence, motion, useAnimate } from 'framer-motion';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Forgiveness } from '../game/match';
import {
  createSolo,
  findSoloRepeat,
  guessSolo,
  soloTimeLeft,
  tickSolo,
  todayKey,
  type GuessResult,
  type SoloMode,
  type SoloState,
} from '../game/solo';
import type { SoloRound } from '../game/soloVerify';
import { STARTERS, type Range, type Tier } from '../game/words';
import { api } from '../net/api';
import { useAccount } from './account';
import { useMyAvatar } from './myAvatar';
import { useTypingMeter } from './typing';
import { AdSlot } from './AdSlot';
import { Avatar } from './Avatar';
import { MeaningMap } from './MeaningMap';
import { reportRuling } from './reports';
import { getBest, getDaily, recordBest, saveDaily, type DailyResult } from './records';
import { JIGGLE, SketchBox, SketchButton } from './sketch';
import { sfx } from './sound';

export const SOLO_TITLES: Record<SoloMode, string> = {
  score: 'Score Attack',
  daily: 'Daily Word',
  survival: 'Survival',
};

const FEEDBACK: Record<Exclude<GuessResult, 'ok'>, string> = {
  repeat: 'Already guessed that one!',
  wrong: 'Not a synonym!',
  starter: 'That’s the word itself!',
  empty: 'Type a word first!',
};

interface Props {
  mode: SoloMode;
  tier: Tier;
  forgiveness: Forgiveness;
  range: Range;
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
  range,
  onExit,
  dateKey,
  onDailyDone,
  onAgain,
}: Props & { dateKey: string; onDailyDone: (r: DailyResult) => void; onAgain: () => void }) {
  const [state, setState] = useState<SoloState>(() => createSolo(mode, { tier, forgiveness, range, dateKey }, Math.random, Date.now()));
  const [now, setNow] = useState(Date.now());
  const [input, setInput] = useState('');
  const [feedback, setFeedback] = useState<{
    id: number;
    text: string;
    good: boolean;
    /** A rejected word the player can dispute. */
    disputable?: string;
    disputed?: boolean;
  } | null>(null);
  const [newBest, setNewBest] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const { user, refresh } = useAccount();
  // Everything typed, with timing, so the server can replay the run before counting the points.
  const startAt = useRef(state.deadline - state.roundMs);
  const rounds = useRef<SoloRound[]>([{ starter: state.starter.word, guesses: [] }]);
  const meter = useTypingMeter();
  const stateRef = useRef(state);
  stateRef.current = state;
  const inputRef = useRef<HTMLInputElement>(null);
  const [formScope, animateForm] = useAnimate<HTMLFormElement>();

  // Bests are kept per rule set, so a Loose game can't beat a Standard record.
  const variant = mode === 'score' ? `${tier}-${forgiveness}-${range}` : `${forgiveness}-${range}`;

  function finish(s: SoloState) {
    if (user) {
      api
        .submitSolo({ mode, tier, range: s.range, forgiveness: s.forgiveness, dateKey: mode === 'daily' ? dateKey : undefined, rounds: rounds.current })
        .then((res) => {
          setSaved(res.counted ? `+${res.score} points saved to ${user.username}` : (res.reason ?? null));
          refresh();
        })
        .catch((e: Error) => setSaved(e.message));
    }
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
    const t0 = Date.now();
    const r = guessSolo(state, input, t0, Math.random);
    const id = t0;
    const typing = meter.take();
    if (input.trim()) rounds.current.at(-1)!.guesses.push({ word: input.trim(), t: t0 - startAt.current, ...typing });
    if (mode === 'survival' && r.result === 'ok') rounds.current.push({ starter: r.state.starter.word, guesses: [] });
    if (r.result === 'ok' && r.entry) {
      sfx.pop();
      const bonus = mode === 'survival' ? '' : r.entry.rarity === 3 ? '  · rare word!' : r.entry.rarity === 2 ? '  · nice one!' : '';
      setFeedback({ id, text: `+${r.points}  ${r.entry.word}${bonus}`, good: true });
      setInput('');
    } else {
      sfx.error();
      const penalty = r.result === 'wrong' && mode !== 'survival' ? ' (−2s)' : '';
      // A real synonym that's too distant for this game's range gets a kinder message.
      const text = r.result === 'wrong' && r.entry ? 'Only a distant synonym; it counts in Loose games' : FEEDBACK[r.result as Exclude<GuessResult, 'ok'>];
      setFeedback({ id, text: text + penalty, good: false, disputable: r.result === 'wrong' ? input.trim().toLowerCase() : undefined });
      animateForm('.input-wrap', JIGGLE.keyframes, JIGGLE.options);
      // Repeats and the starter word stay in the box for the player to delete; a wrong guess
      // is cleared so its "Not a synonym" message isn't replaced by the "already tried" warning.
      if (r.result === 'wrong') setInput('');
    }
    setState(r.state);
    if (r.state.over) finish(r.state);
    inputRef.current?.focus();
  }

  if (state.over && mode !== 'daily') {
    return <SoloOver mode={mode} tier={tier} forgiveness={forgiveness} range={range} onExit={onExit} state={state} daily={null} dateKey={dateKey} newBest={newBest} onAgain={onAgain} saved={saved} />;
  }

  const left = soloTimeLeft(state, now);
  // Warn while typing if this word (or a form/spelling of it) was already guessed.
  const repeat = findSoloRepeat(state, input);
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

      <form ref={formScope} onSubmit={guess} className="say-form">
        <SketchBox className="input-wrap big">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              meter.onInput(e.target.value);
            }}
            onPaste={meter.onPaste}
            onDrop={meter.onPaste}
            placeholder="Type a synonym…"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="send"
          />
        </SketchBox>
        {/* preventDefault on mousedown keeps the cursor (and phone keyboard) in the text box */}
        <SketchButton type="submit" color="#69db7c" onMouseDown={(e) => e.preventDefault()}>
          Go!
        </SketchButton>
      </form>

      <div className="feedback-slot">
        <AnimatePresence mode="popLayout">
          {repeat ? (
            <motion.p
              key="repeat"
              className="repeat-hint"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {repeat.correct ? `You already got “${repeat.word}”` : `You already tried “${repeat.word}” (not a synonym)`}
            </motion.p>
          ) : (
            feedback && (
            <motion.p
              key={feedback.id}
              className={`feedback ${feedback.good ? 'good' : 'bad'}`}
              initial={{ y: 10, opacity: 0, scale: 0.8 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -14, opacity: 0 }}
              transition={{ type: 'spring', bounce: 0.6 }}
            >
              {feedback.text}
              {feedback.disputable &&
                (feedback.disputed ? (
                  <span className="disagree done"> · thanks, noted!</span>
                ) : (
                  <button
                    className="disagree"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      reportRuling({ starter: state.starter.word, word: feedback.disputable!, ruling: 'rejected', range: state.range, mode });
                      setFeedback({ ...feedback, disputed: true });
                    }}
                  >
                    Disagree?
                  </button>
                ))}
            </motion.p>
            )
          )}
        </AnimatePresence>
      </div>

      {mode !== 'survival' && (
        <div className="word-cloud found">
          {state.found.map((w, i) => (
            <motion.span
              key={w}
              className={repeat?.correct && repeat.word === w ? 'echo' : ''}
              initial={{ scale: 0 }}
              animate={{ scale: 1, rotate: ((i * 37) % 9) - 4 }}
              transition={{ type: 'spring', bounce: 0.6 }}
            >
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
  const n = d.found.length;
  return `Synonym Showdown · Daily ${dateKey}\n“${d.word}”: ${d.score} points, ${n} synonym${n === 1 ? '' : 's'} in 60s\n${squares || '⬜'}`;
}

function SoloOver({
  mode,
  onExit,
  state,
  daily,
  dateKey,
  newBest,
  onAgain,
  saved,
}: Props & { state: SoloState | null; daily: DailyResult | null; dateKey: string; newBest: boolean; onAgain: (() => void) | null; saved?: string | null }) {
  const [copied, setCopied] = useState(false);
  const { avatar: myAvatar } = useMyAvatar();
  const word = daily?.word ?? state!.starter.word;
  const score = daily?.score ?? state!.score;
  const starter = state?.starter ?? STARTERS.find((s) => s.word === word);
  const found = new Set(daily?.found ?? state?.found ?? []);
  const wordCount = found.size;

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

  const headline = mode === 'survival' ? `${score} round${score === 1 ? '' : 's'}` : `${score} point${score === 1 ? '' : 's'}`;

  return (
    <div className="page gameover">
      <motion.div initial={{ scale: 0.4, rotate: -8 }} animate={{ scale: 1, rotate: -2 }} transition={{ type: 'spring', bounce: 0.6 }}>
        <Avatar id="solo" config={myAvatar} color="#4dabf7" mood={score > 0 ? 'win' : 'out'} size={110} />
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
      {mode !== 'survival' && (
        <p className="tagline">
          {wordCount} word{wordCount === 1 ? '' : 's'} found · rarer words score more
        </p>
      )}
      {saved && <p className="saved-note">{saved}</p>}
      {mode === 'daily' && <p className="tagline">Come back tomorrow for a new word!</p>}

      {starter && <MeaningMap starter={starter} said={found} range={state?.range ?? 'standard'} />}

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
      <AdSlot placement="gameover" />
    </div>
  );
}
