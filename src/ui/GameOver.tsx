// End screen: who won, your placement, and words nobody thought of.

import { motion } from 'framer-motion';
import { useState } from 'react';
import { alivePlayers, player, type GameState } from '../game/engine';
import { findSynonym } from '../game/match';
import { synonymWords } from '../game/words';
import { Avatar } from './Avatar';
import { SketchBox, SketchButton } from './sketch';

/** `youId` is null in pass-and-play, where the screen just celebrates the winner. */
export function GameOver({
  state,
  youId,
  onAgain,
  onMenu,
}: {
  state: GameState;
  youId: string | null;
  onAgain: () => void;
  onMenu: () => void;
}) {
  const winner = state.winnerId ? player(state, state.winnerId) : null;
  const won = youId !== null && state.winnerId === youId;
  const me = youId ? player(state, youId) : winner!;
  const place = won ? 1 : alivePlayers(state).length + 1;
  const myWords = state.chain.filter((p) => p.playerId === me.id).length;
  // Picked once, so the list doesn't reshuffle on every re-render.
  const [missed] = useState(() => {
    const said = new Set(state.chain.map((p) => findSynonym(p.word, state.starter, 'strict')));
    return synonymWords(state.starter).filter((w) => !said.has(w)).sort(() => Math.random() - 0.5).slice(0, 12);
  });
  const ordinal = ['1st', '2nd', '3rd', '4th', '5th'][place - 1];

  return (
    <div className="page gameover">
      <motion.div initial={{ scale: 0.4, rotate: -8 }} animate={{ scale: 1, rotate: -2 }} transition={{ type: 'spring', bounce: 0.6 }}>
        <Avatar id={me.id + me.name} color={me.color} mood={won || !youId ? 'win' : 'out'} size={120} />
      </motion.div>
      <motion.h1 initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }}>
        {!youId ? (
          <>
            {winner?.name} <span className="hl">wins!</span>
          </>
        ) : won ? (
          <>
            You <span className="hl">win!</span>
          </>
        ) : (
          <>You placed {ordinal}</>
        )}
      </motion.h1>
      {youId && !won && winner && <p className="tagline">{winner.name} won the showdown.</p>}

      <SketchBox className="panel missed">
        <h2>
          Other synonyms for <span className="hl">{state.starter.word}</span>
        </h2>
        <div className="word-cloud">
          {missed.map((w, i) => (
            <motion.span
              key={w}
              initial={{ scale: 0 }}
              animate={{ scale: 1, rotate: ((i * 37) % 9) - 4 }}
              transition={{ delay: 0.3 + i * 0.04, type: 'spring', bounce: 0.6 }}
            >
              {w}
            </motion.span>
          ))}
        </div>
        {youId && <p className="muted">You said {myWords} word{myWords === 1 ? '' : 's'} on this one.</p>}
      </SketchBox>

      <div className="play-row">
        <SketchButton big color="#ffd43b" onClick={onAgain}>
          Play again
        </SketchButton>
        <SketchButton onClick={onMenu}>Menu</SketchButton>
      </div>
    </div>
  );
}
