// End-screen pages, one per starter word played this game: the words said (with how each was ruled and a
// Disagree button) and every accepted answer. Flip with the arrows, the dots, or a swipe.

import { motion } from 'framer-motion';
import { useState } from 'react';
import type { Forgiveness } from '../game/match';
import type { Range, StarterWord } from '../game/words';
import { DisputePanel, type PlayedWord } from './DisputePanel';
import { MeaningMap } from './MeaningMap';
import { SketchBox } from './sketch';
import { sfx } from './sound';

export interface RoundPage {
  starter: StarterWord;
  played: PlayedWord[];
  /** Canonical synonyms said for this word (highlighted in the answers). */
  said: Set<string>;
}

export function RoundPages({ rounds, range, forgiveness, mode }: { rounds: RoundPage[]; range: Range; forgiveness: Forgiveness; mode: string }) {
  const [page, setPage] = useState(0);
  const [dir, setDir] = useState(1);
  const many = rounds.length > 1;
  const go = (to: number) => {
    if (to < 0 || to >= rounds.length || to === page) return;
    sfx.pop();
    setDir(to > page ? 1 : -1);
    setPage(to);
  };

  return (
    <div className="round-pages">
      {many && (
        <SketchBox className="panel round-pager">
          <button className="pager-arrow" onClick={() => go(page - 1)} disabled={page === 0} aria-label="Previous word">
            ◀
          </button>
          <div className="pager-middle">
            <span>
              Word {page + 1} of {rounds.length}: <b className="hl">{rounds[page].starter.word}</b>
            </span>
            <span className="pager-dots">
              {rounds.map((r, i) => (
                <button key={i} className={i === page ? 'on' : ''} onClick={() => go(i)} aria-label={`Word ${i + 1}: ${r.starter.word}`} />
              ))}
            </span>
          </div>
          <button className="pager-arrow" onClick={() => go(page + 1)} disabled={page === rounds.length - 1} aria-label="Next word">
            ▶
          </button>
        </SketchBox>
      )}
      {/* Every page stays mounted (so "Thanks!" on a report survives flipping); only the current one shows. */}
      {rounds.map((r, i) => (
        <motion.div
          key={i}
          hidden={i !== page}
          className={`round-page ${dir > 0 ? 'from-right' : 'from-left'}`}
          drag={many ? 'x' : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.25}
          dragDirectionLock
          onDragEnd={(_, info) => {
            if (info.offset.x < -70) go(page + 1);
            else if (info.offset.x > 70) go(page - 1);
          }}
        >
          <DisputePanel starter={r.starter} played={r.played} range={range} forgiveness={forgiveness} mode={mode} />
          <MeaningMap starter={r.starter} said={r.said} range={range} />
        </motion.div>
      ))}
    </div>
  );
}
