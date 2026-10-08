// End screen: who won, your placement, and the map of the word's meanings and synonyms.

import { motion } from 'framer-motion';
import { alivePlayers, player, type GameState } from '../game/engine';
import { findEntry } from '../game/match';
import { AdSlot } from './AdSlot';
import { Avatar } from './Avatar';
import { MeaningMap } from './MeaningMap';
import { SketchButton } from './sketch';

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
  const said = new Set(
    state.chain.map((p) => findEntry(p.word, state.starter, state.settings.forgiveness)?.word).filter((w): w is string => !!w),
  );
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

      {youId && <p className="muted">You said {myWords} word{myWords === 1 ? '' : 's'} on this one.</p>}
      <MeaningMap starter={state.starter} said={said} range={state.settings.range} />

      <div className="play-row">
        <SketchButton big color="#ffd43b" onClick={onAgain}>
          Play again
        </SketchButton>
        <SketchButton onClick={onMenu}>Menu</SketchButton>
      </div>
      <AdSlot placement="gameover" />
    </div>
  );
}
