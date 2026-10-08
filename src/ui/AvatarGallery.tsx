// Development-only page (open /?gallery while running `npm run dev`) showing every avatar option.

import { AVATAR_COLORS, EXTRAS, EYES, HATS, MOUTHS, SHAPES, TEXTURES, defaultAvatar, type AvatarConfig } from '../game/avatar';
import { Avatar, type Mood } from './Avatar';

export function AvatarGallery() {
  const base: AvatarConfig = { ...defaultAvatar('x'), color: 0, accent: 1 };
  const row = (label: string, configs: [string, AvatarConfig, Mood?][]) => (
    <div style={{ marginBottom: 12 }}>
      <b>{label}</b>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {configs.map(([name, c, mood]) => (
          <div key={name} style={{ textAlign: 'center', fontSize: 12 }}>
            <Avatar id={name} config={c} mood={mood} size={64} />
            <div>{name}</div>
          </div>
        ))}
      </div>
    </div>
  );
  return (
    <div className="page">
      {row('hats', HATS.map((h, i) => [h, { ...base, hat: h, accent: i % AVATAR_COLORS.length }]))}
      {row('eyes', EYES.map((e) => [e, { ...base, eyes: e }]))}
      {row('mouths', MOUTHS.map((m) => [m, { ...base, mouth: m }]))}
      {row('shapes', SHAPES.map((s) => [s, { ...base, shape: s }]))}
      {row('textures', TEXTURES.map((t) => [t, { ...base, texture: t }]))}
      {row('extras', EXTRAS.map((x) => [x, { ...base, extra: x, accent: 4 }]))}
      {row('colors', AVATAR_COLORS.map((_, i) => [`c${i}`, { ...base, color: i }]))}
      {row('moods', (['normal', 'think', 'worried', 'win', 'out'] as Mood[]).map((m) => [m, { ...base, hat: 'cap', eyes: 'glasses' }, m]))}
    </div>
  );
}
