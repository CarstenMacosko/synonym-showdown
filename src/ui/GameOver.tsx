// End screen: who won, your placement, and a page per word played with the words said and all the answers.

import { motion } from 'framer-motion';
import type { AvatarConfig } from '../game/avatar';
import { allRounds, alivePlayers, player, type GameState } from '../game/engine';
import { findEntry } from '../game/match';
import { AdSlot } from './AdSlot';
import { Avatar } from './Avatar';
import { RoundPages } from './RoundPages';
import { SketchButton } from './sketch';

/** `youId` is null in pass-and-play, where the screen just celebrates the winner. */
export function GameOver({
  state,
  youId,
  faceOf,
  onAgain,
  onMenu,
}: {
  state: GameState;
  youId: string | null;
  faceOf: (p: { id: string; name: string; isBot: boolean }) => AvatarConfig | null;
  onAgain: () => void;
  onMenu: () => void;
}) {
  const winner = state.winnerId ? player(state, state.winnerId) : null;
  const won = youId !== null && state.winnerId === youId;
  const me = youId ? player(state, youId) : winner!;
  const place = won ? 1 : alivePlayers(state).length + 1;
  const rounds = allRounds(state);
  const myWords = rounds.flatMap((r) => r.chain).filter((p) => p.playerId === me.id).length;
  const f = state.settings.forgiveness;
  const pages = rounds.map((r) => ({
    starter: r.starter,
    played: r.chain.map((p) => ({
      word: p.word,
      by: p.playerId === youId ? 'you' : player(state, p.playerId).name,
      challenged: p.rejected ? ('bluff' as const) : p.confirmed ? ('real' as const) : undefined,
    })),
    said: new Set(r.chain.map((p) => findEntry(p.word, r.starter, f)?.word).filter((w): w is string => !!w)),
  }));
  const ordinal = ['1st', '2nd', '3rd', '4th', '5th'][place - 1];

  return (
    <div className="page gameover">
      <motion.div initial={{ scale: 0.4, rotate: -8 }} animate={{ scale: 1, rotate: -2 }} transition={{ type: 'spring', bounce: 0.6 }}>
        <Avatar id={me.id + me.name} config={faceOf(me)} color={me.color} mood={won || !youId ? 'win' : 'out'} size={120} />
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

      {youId && (
        <p className="muted">
          You said {myWords} word{myWords === 1 ? '' : 's'}
          {rounds.length > 1 ? ` across ${rounds.length} starter words` : ' on this one'}.
        </p>
      )}
      <RoundPages rounds={pages} range={state.settings.range} forgiveness={f} mode={youId ? 'bots' : 'pass'} />

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
