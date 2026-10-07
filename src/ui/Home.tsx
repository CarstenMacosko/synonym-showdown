// Title screen: pick a mode and settings.

import { motion } from 'framer-motion';
import { useState } from 'react';
import { TIME_CONTROLS, type AfterElimination, type BotLevel, type TimeControl } from '../game/engine';
import type { Forgiveness } from '../game/match';
import type { Tier } from '../game/words';
import { Avatar } from './Avatar';
import type { BotGameConfig } from './config';
import { Choice, SketchBox, SketchButton } from './sketch';

const MODES = [
  { id: 'bots', title: 'Vs. Bots', blurb: 'Outwit computer players', ready: true },
  { id: 'score', title: 'Score Attack', blurb: 'Most synonyms in 60s', ready: false },
  { id: 'daily', title: 'Daily Word', blurb: 'Same word for everyone', ready: false },
  { id: 'survival', title: 'Survival', blurb: 'One miss and you’re out', ready: false },
  { id: 'friends', title: 'Play Friends', blurb: 'Room codes & invites', ready: false },
  { id: 'ranked', title: 'Ranked', blurb: '1v1 with Elo rating', ready: false },
];

export function Home({ config, onPlay }: { config: BotGameConfig; onPlay: (c: BotGameConfig) => void }) {
  const [c, setC] = useState(config);
  const set = (patch: Partial<BotGameConfig['settings']>) => setC({ ...c, settings: { ...c.settings, ...patch } });

  return (
    <div className="page home">
      <header className="title-block">
        <motion.div
          className="title-faces"
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', bounce: 0.6 }}
        >
          <Avatar id="t1" color="#4dabf7" size={54} />
          <Avatar id="t2" color="#ff8787" mood="worried" size={54} />
          <Avatar id="t3" color="#69db7c" mood="think" size={54} />
        </motion.div>
        <motion.h1 initial={{ scale: 0.6, rotate: -6 }} animate={{ scale: 1, rotate: -2 }} transition={{ type: 'spring', bounce: 0.55 }}>
          Synonym <span className="hl">Showdown</span>
        </motion.h1>
        <p className="tagline">Name a synonym… or call their bluff.</p>
      </header>

      <section className="modes">
        {MODES.map((m, i) => (
          <motion.div
            key={m.id}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.05 * i, type: 'spring', bounce: 0.5 }}
          >
            <SketchBox className={`mode-card ${m.id === 'bots' ? 'active' : ''} ${m.ready ? '' : 'soon'}`} fill={m.id === 'bots' ? '#d0ebff' : undefined}>
              <strong>{m.title}</strong>
              <span>{m.blurb}</span>
              {!m.ready && <em className="soon-tag">soon!</em>}
            </SketchBox>
          </motion.div>
        ))}
      </section>

      <SketchBox className="panel settings">
        <h2>Game setup</h2>

        <label className="field">
          <span>Your name</span>
          <SketchBox className="input-wrap">
            <input value={c.name} maxLength={16} onChange={(e) => setC({ ...c, name: e.target.value })} />
          </SketchBox>
        </label>

        <div className="field">
          <span>Opponents</span>
          <Choice
            value={String(c.bots)}
            onChange={(v) => setC({ ...c, bots: Number(v) })}
            options={['1', '2', '3', '4'].map((n) => ({ value: n, label: n }))}
          />
        </div>

        <div className="field">
          <span>Bot skill</span>
          <Choice<BotLevel>
            value={c.botLevel}
            onChange={(v) => setC({ ...c, botLevel: v })}
            color="#ff8787"
            options={[
              { value: 'easy', label: 'Easy' },
              { value: 'medium', label: 'Medium' },
              { value: 'hard', label: 'Hard' },
            ]}
          />
        </div>

        <div className="field">
          <span>Word difficulty</span>
          <Choice<Tier>
            value={c.settings.tier}
            onChange={(v) => set({ tier: v })}
            color="#69db7c"
            options={[
              { value: 'easy', label: 'Easy', detail: 'happy, big' },
              { value: 'medium', label: 'Medium', detail: 'brave, calm' },
              { value: 'hard', label: 'Hard', detail: 'obstinate' },
            ]}
          />
        </div>

        <div className="field">
          <span>Time control</span>
          <Choice<TimeControl>
            value={c.settings.timeControl}
            onChange={(v) => set({ timeControl: v })}
            color="#4dabf7"
            options={(Object.keys(TIME_CONTROLS) as TimeControl[]).map((k) => ({
              value: k,
              label: TIME_CONTROLS[k].label,
              detail: TIME_CONTROLS[k].detail,
            }))}
          />
        </div>

        <div className="field">
          <span>Spelling</span>
          <Choice<Forgiveness>
            value={c.settings.forgiveness}
            onChange={(v) => set({ forgiveness: v })}
            color="#da77f2"
            options={[
              { value: 'strict', label: 'Strict', detail: 'exact spelling' },
              { value: 'typos', label: 'Typos OK', detail: '1–2 letters off' },
              { value: 'soundalike', label: 'Sounds-alike', detail: 'most forgiving' },
            ]}
          />
        </div>

        <div className="field">
          <span>After a knockout</span>
          <Choice<AfterElimination>
            value={c.settings.afterElimination}
            onChange={(v) => set({ afterElimination: v })}
            color="#ffa94d"
            options={[
              { value: 'newWord', label: 'New word' },
              { value: 'sameWord', label: 'Keep word' },
            ]}
          />
        </div>

        <div className="play-row">
          <SketchButton big color="#ffd43b" onClick={() => onPlay({ ...c, name: c.name.trim() || 'You' })}>
            Play!
          </SketchButton>
        </div>
      </SketchBox>

      <SketchBox className="panel how">
        <h2>How to play</h2>
        <ol>
          <li>Everyone gets the same <b>starter word</b>.</li>
          <li>On your turn, say a <b>synonym</b> nobody has said yet, before the timer runs out.</li>
          <li>Think the last player made one up? <b>Challenge!</b></li>
          <li>If it really is a synonym, the challenger is out. If not, the bluffer is out. Last one standing wins.</li>
        </ol>
      </SketchBox>
    </div>
  );
}
