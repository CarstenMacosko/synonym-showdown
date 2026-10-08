// The end-screen map of a starter word: its meanings, every synonym shaded by closeness
// (dark green = close, light = solid, dashed = distant), and the words that were actually said.

import { motion } from 'framer-motion';
import { useState } from 'react';
import { RANGE_MAX, type Range, type StarterWord } from '../game/words';
import { SketchBox } from './sketch';

const PER_SENSE = 18;

export function MeaningMap({ starter, said, range }: { starter: StarterWord; said: Set<string>; range: Range }) {
  const [open, setOpen] = useState<Set<number>>(new Set());
  const max = RANGE_MAX[range];
  const senses = starter.senses
    .map((sense, i) => ({
      sense,
      i,
      words: starter.synonyms
        .filter((s) => s.sense === i)
        // Said words first, then closest, then most common.
        .sort((a, b) => Number(said.has(b.word)) - Number(said.has(a.word)) || a.closeness - b.closeness || a.rarity - b.rarity),
    }))
    .filter((s) => s.words.length);

  return (
    <SketchBox className="panel meaning-map">
      <h2>
        Synonyms of <span className="hl">{starter.word}</span>
      </h2>
      <p className="legend">
        <span className="chip c1">close</span>
        <span className="chip c2">solid</span>
        <span className="chip c3">distant</span>
        <span className="chip said">said this game</span>
      </p>
      {senses.map(({ sense, i, words }) => {
        const shown = open.has(i) ? words : words.slice(0, PER_SENSE);
        return (
          <div className="sense" key={i}>
            <div className="sense-head">
              <b>{sense.label}</b> <i>{sense.definition}</i>
            </div>
            <div className="chips">
              {shown.map((w, j) => (
                <motion.span
                  key={w.word}
                  className={`chip c${w.closeness} ${said.has(w.word) ? 'said' : ''} ${w.closeness > max ? 'out' : ''}`}
                  title={w.closeness > max ? 'Only counts in Loose games' : w.rarity === 3 ? 'Rare word' : undefined}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: Math.min(0.6, 0.15 + j * 0.02), type: 'spring', bounce: 0.6 }}
                >
                  {w.word}
                </motion.span>
              ))}
              {words.length > shown.length && (
                <button className="chip more" onClick={() => setOpen(new Set([...open, i]))}>
                  +{words.length - shown.length} more
                </button>
              )}
            </div>
          </div>
        );
      })}
    </SketchBox>
  );
}
