// End-of-round "Disagree with a ruling?" panel: every word played this round with how it was ruled, a
// Disagree button for each, and a box to suggest a synonym the game doesn't count. Stays as long as the
// end screen does, so there's no rush.

import { AnimatePresence, motion } from 'framer-motion';
import { useState, type FormEvent } from 'react';
import { findEntry, type Forgiveness } from '../game/match';
import { RANGE_MAX, type Range, type StarterWord } from '../game/words';
import { reportRuling } from './reports';
import { SketchBox, SketchButton } from './sketch';

export interface PlayedWord {
  word: string;
  /** Who said it (shown in multiplayer), if known. */
  by?: string;
}

export function DisputePanel({
  starter,
  played,
  range,
  forgiveness,
  mode,
}: {
  starter: StarterWord;
  played: PlayedWord[];
  range: Range;
  forgiveness: Forgiveness;
  mode: string;
}) {
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [suggestion, setSuggestion] = useState('');
  const [thanks, setThanks] = useState<string | null>(null);

  // Rule each word the same way the game did (any form or allowed misspelling counts).
  const seen = new Set<string>();
  const rows = played
    .map((p) => {
      const entry = findEntry(p.word, starter, forgiveness);
      const counted = !!entry && entry.closeness <= RANGE_MAX[range];
      return { ...p, counted, key: (entry?.word ?? p.word).toLowerCase() };
    })
    .filter((r) => !seen.has(r.key) && seen.add(r.key));

  const report = (word: string, ruling: 'accepted' | 'rejected') => {
    reportRuling({ starter: starter.word, word, ruling, range, mode });
    setSent(new Set([...sent, word.toLowerCase()]));
  };

  function suggest(e: FormEvent) {
    e.preventDefault();
    const word = suggestion.trim().toLowerCase();
    if (!/^[a-z][a-z' -]{1,38}$/.test(word)) return;
    const entry = findEntry(word, starter, forgiveness);
    if (entry && entry.closeness <= RANGE_MAX[range]) {
      setThanks(`“${entry.word}” already counts for “${starter.word}”.`);
    } else {
      report(word, 'rejected');
      setThanks(`Thanks! We’ll review “${word}” for “${starter.word}”.`);
    }
    setSuggestion('');
  }

  return (
    <SketchBox className="panel dispute-panel">
      <h2>Disagree with a ruling?</h2>
      <p className="muted hint">Think a word was ruled wrong? Tell us and we’ll review it for everyone.</p>
      {rows.length > 0 && (
        <ul className="dispute-list">
          {rows.map((r) => {
            const done = sent.has(r.word.toLowerCase());
            return (
              <li key={r.key}>
                <span className={`chip ${r.counted ? 'c2' : 'rejected-chip'}`}>{r.word}</span>
                <small className="muted">
                  {r.counted ? '✓ counted' : '✗ not a synonym'}
                  {r.by ? ` · ${r.by}` : ''}
                </small>
                {done ? (
                  <small className="disagree done">Thanks!</small>
                ) : (
                  <button className="disagree" onClick={() => report(r.word, r.counted ? 'accepted' : 'rejected')}>
                    {r.counted ? 'Shouldn’t count' : 'Should count'}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <form className="suggest-row" onSubmit={suggest}>
        <span className="muted">Missing a synonym?</span>
        <SketchBox className="input-wrap">
          <input
            value={suggestion}
            onChange={(e) => {
              setSuggestion(e.target.value);
              setThanks(null);
            }}
            placeholder={`a word for “${starter.word}”`}
            maxLength={40}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            aria-label={`Suggest a synonym for ${starter.word}`}
          />
        </SketchBox>
        <SketchButton type="submit" className="small" disabled={suggestion.trim().length < 2}>
          Suggest
        </SketchButton>
      </form>
      <AnimatePresence>
        {thanks && (
          <motion.p className="saved-note" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {thanks}
          </motion.p>
        )}
      </AnimatePresence>
    </SketchBox>
  );
}
