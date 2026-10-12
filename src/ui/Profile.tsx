// Profile: build your doodle face (colors, texture, shape, eyes, mouth, hat, extras) and see your stats.

import { AnimatePresence, motion } from 'framer-motion';
import { Fragment, useEffect, useState } from 'react';
import { AVATAR_COLORS, AVATAR_PARTS, defaultAvatar, randomAvatar, unlockCost, type AvatarConfig } from '../game/avatar';
import { api, type RecentMatch } from '../net/api';
import { useAccount } from './account';
import { Avatar, type Mood } from './Avatar';
import { useMusic } from './music';
import { useMyAvatar } from './myAvatar';
import { Choice, SketchBox, SketchButton } from './sketch';
import { sfx } from './sound';

type Part = keyof typeof AVATAR_PARTS;
type Tab = Part | 'colors';

const TABS: { value: Tab; label: string }[] = [
  { value: 'hat', label: 'Hat' },
  { value: 'eyes', label: 'Eyes' },
  { value: 'mouth', label: 'Mouth' },
  { value: 'colors', label: 'Colors' },
  { value: 'texture', label: 'Texture' },
  { value: 'shape', label: 'Shape' },
  { value: 'extra', label: 'Extras' },
];

const NICE: Record<string, string> = {
  none: 'None',
  hachure: 'Pencil',
  'cross-hatch': 'Cross-hatch',
  zigzag: 'Scribble',
  dots: 'Dots',
  solid: 'Marker',
  dashed: 'Dashes',
  'zigzag-line': 'Squiggle',
  tophat: 'Top hat',
  santa: 'Santa hat',
  shades: 'Sunglasses',
  headphones: 'Headphones',
  bandaid: 'Bandage',
  bowtie: 'Bow tie',
  o: 'Oh!',
};
const label = (v: string) => NICE[v] ?? v[0].toUpperCase() + v.slice(1);
/** 10000 → "10k", to fit under a small picture. */
const short = (n: number) => (n >= 1000 ? `${n / 1000}k` : String(n));

/** Free options first (in their usual order), then the ones earned with points, cheapest first. */
function byCost(part: Part): string[] {
  const all = AVATAR_PARTS[part] as readonly string[];
  const earned = all.filter((o) => unlockCost(part, o)).sort((a, b) => unlockCost(part, a) - unlockCost(part, b));
  return [...all.filter((o) => !unlockCost(part, o)), ...earned];
}

const MOODS: Mood[] = ['normal', 'think', 'worried', 'win'];

export function ProfilePage({ onExit }: { onExit: () => void }) {
  const { user, openSignIn } = useAccount();
  const { avatar, save } = useMyAvatar();
  useMusic('studio');
  const [draft, setDraft] = useState<AvatarConfig>(() => avatar ?? defaultAvatar(user?.username ?? 'guest'));
  const [tab, setTab] = useState<Tab>('hat');
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [mood, setMood] = useState(0);
  const [recent, setRecent] = useState<RecentMatch[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const points = user?.points ?? 0;
  const dirty = JSON.stringify(draft) !== JSON.stringify(avatar);

  // The preview cycles through expressions so you can see your face mid-game.
  useEffect(() => {
    const id = setInterval(() => setMood((m) => (m + 1) % MOODS.length), 1600);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (user) api.profile().then((p) => setRecent(p.recent), () => setRecent([]));
  }, [user]);

  const change = (patch: Partial<AvatarConfig>) => {
    sfx.pop();
    setSaved('idle');
    setNote(null);
    setDraft({ ...draft, ...patch });
  };

  async function onSave() {
    setSaved('saving');
    try {
      await save(draft);
      setSaved('saved');
      sfx.good();
    } catch {
      setSaved('error');
    }
  }

  return (
    <div className="page profile">
      <div className="topbar">
        <SketchButton onClick={onExit} className="small">
          ✕ Close
        </SketchButton>
        <span className="pill">Your profile</span>
      </div>

      <SketchBox className="panel profile-hero">
        <AnimatePresence mode="popLayout">
          <motion.div key={JSON.stringify(draft)} initial={{ scale: 0.7, rotate: -8 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', bounce: 0.6 }}>
            <Avatar id={user?.username ?? 'me'} config={draft} mood={MOODS[mood]} size={150} />
          </motion.div>
        </AnimatePresence>
        <h2>{user ? user.username : 'Guest'}</h2>
        <div className="play-row">
          <SketchButton className="small" onClick={() => change(randomAvatar(Math.random, points))}>
            🎲 Shuffle
          </SketchButton>
          <SketchButton color="#69db7c" onClick={onSave} disabled={!dirty || saved === 'saving'}>
            {saved === 'saving' ? 'Saving…' : saved === 'saved' && !dirty ? 'Saved!' : 'Save face'}
          </SketchButton>
        </div>
        {saved === 'error' && <p className="error">Couldn’t save. Check your connection and try again.</p>}
        {!user && <p className="muted small-note">Saved on this device. Sign in to keep your face everywhere.</p>}
      </SketchBox>

      <SketchBox className="panel">
        <div className="tab-row">
          <Choice<Tab> value={tab} onChange={(t) => {
              setTab(t);
              setNote(null);
            }} color="#ffd43b" options={TABS} />
        </div>
        {tab === 'colors' ? (
          <>
            <Swatches title="Face" value={draft.color} onPick={(color) => change({ color })} />
            <Swatches title="Hats & accessories" value={draft.accent} onPick={(accent) => change({ accent })} />
          </>
        ) : (
          <div className="part-grid">
            {byCost(tab).map((option, i, list) => {
              const preview = { ...draft, [tab]: option } as AvatarConfig;
              const selected = draft[tab] === option;
              const cost = unlockCost(tab, option);
              const locked = cost > points;
              const pick = () => {
                if (locked) {
                  sfx.bad();
                  return setNote(
                    user
                      ? `🔒 ${label(option)} unlocks at ${cost.toLocaleString()} points. You have ${points.toLocaleString()}, so ${(cost - points).toLocaleString()} to go!`
                      : `🔒 ${label(option)} unlocks at ${cost.toLocaleString()} points. Create an account to start earning points.`,
                  );
                }
                change({ [tab]: option } as Partial<AvatarConfig>);
                if (cost) setNote(`✨ ${label(option)}: unlocked by earning ${cost.toLocaleString()} points.`);
              };
              return (
                <Fragment key={option}>
                  {cost > 0 && unlockCost(tab, list[i - 1]) === 0 && <p className="part-divider">★ Earned with points</p>}
                  <motion.button
                    className={`part-option ${selected ? 'selected' : ''} ${locked ? 'locked' : cost ? 'earned' : ''}`}
                    onClick={pick}
                    whileHover={{ scale: 1.08, rotate: -2 }}
                    whileTap={locked ? { x: [0, -5, 5, -3, 3, 0] } : { scale: 0.92 }}
                    aria-pressed={selected}
                    aria-label={locked ? `${label(option)}, locked until ${cost} points` : undefined}
                  >
                    <Avatar id={`opt-${tab}-${option}`} config={preview} size={58} />
                    <span>{locked ? `🔒 ${short(cost)} pts` : label(option)}</span>
                  </motion.button>
                </Fragment>
              );
            })}
          </div>
        )}
        {tab !== 'colors' && (
          <p className={note ? 'saved-note' : 'muted small-note'}>
            {note ?? 'Earn points in solo modes and online games to unlock the ★ parts.'}
          </p>
        )}
      </SketchBox>

      {user ? (
        <SketchBox className="panel">
          <h2>Stats</h2>
          <div className="stat-grid">
            <Stat value={`${user.rating}${user.provisional ? '?' : ''}`} label={user.provisional ? 'rating (settling)' : 'rating'} />
            <Stat value={`${user.rankedWins}–${user.rankedGames - user.rankedWins}`} label="ranked record" />
            <Stat value={String(user.games)} label="online games" />
            <Stat value={String(user.points)} label="points" />
          </div>
          <p className="muted">Playing since {new Date(user.joined).toLocaleDateString()}</p>
          <h3 className="subhead">Recent games</h3>
          {recent?.length === 0 && <p className="muted">No online games yet. Try Play Friends or Ranked!</p>}
          {recent?.map((m) => (
            <p key={m.at} className="recent">
              <b>{m.place === 1 ? 'Won' : m.place ? `${ordinal(m.place)} of ${m.players}` : 'Played'}</b>
              {m.opponents.length ? ` vs ${m.opponents.slice(0, 3).join(', ')}` : ''}
              {m.ranked ? ' · ranked' : ''}
              {m.change && (
                <span className={m.change.after >= m.change.before ? 'up' : 'down'}>
                  {' '}
                  {m.change.after >= m.change.before ? '+' : ''}
                  {m.change.after - m.change.before}
                </span>
              )}
              <small className="muted"> · “{m.word}” · {new Date(m.at).toLocaleDateString()}</small>
            </p>
          ))}
        </SketchBox>
      ) : (
        <SketchBox className="panel">
          <h2>Stats</h2>
          <p>Create an account to keep a rating, points and match history.</p>
          <SketchButton color="#ffd43b" onClick={openSignIn}>
            Create account / Sign in
          </SketchButton>
        </SketchBox>
      )}
    </div>
  );
}

function ordinal(n: number) {
  return ['1st', '2nd', '3rd'][n - 1] ?? `${n}th`;
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="stat">
      <b>{value}</b>
      <small>{label}</small>
    </div>
  );
}

function Swatches({ title, value, onPick }: { title: string; value: number; onPick: (i: number) => void }) {
  return (
    <div className="field">
      <span>{title}</span>
      <div className="swatches">
        {AVATAR_COLORS.map((c, i) => (
          <motion.button
            key={c}
            className={`swatch ${i === value ? 'selected' : ''}`}
            style={{ background: c }}
            onClick={() => onPick(i)}
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.9 }}
            aria-label={`Color ${i + 1}`}
            aria-pressed={i === value}
          />
        ))}
      </div>
    </div>
  );
}
