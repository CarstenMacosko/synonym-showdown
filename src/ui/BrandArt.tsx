// Development-only pages used to render the site's share image and app icons (screenshotted into public/).
//   /?og          1200×630 social share card
//   /?icon=512    square app icon at that size
//   /?cover       630×500 cover image (itch.io)

import type { AvatarConfig } from '../game/avatar';
import { Avatar } from './Avatar';

const FACES: AvatarConfig[] = [
  { color: 0, accent: 3, texture: 'hachure', shape: 'round', eyes: 'wide', mouth: 'grin', hat: 'party', extra: 'none' },
  { color: 1, accent: 4, texture: 'cross-hatch', shape: 'round', eyes: 'shades', mouth: 'smirk', hat: 'crown', extra: 'none' },
  { color: 2, accent: 9, texture: 'hachure', shape: 'blob', eyes: 'glasses', mouth: 'o', hat: 'wizard', extra: 'blush' },
];

/** `compact` = the 630×500 cover used on itch.io. */
export function OgCard({ compact = false }: { compact?: boolean }) {
  const k = compact ? 0.62 : 1;
  return (
    <div className={`og-card ${compact ? 'compact' : ''}`}>
      <div className="og-faces">
        <Avatar id="og1" config={FACES[0]} mood="think" size={170 * k} />
        <Avatar id="og2" config={FACES[1]} size={210 * k} />
        <Avatar id="og3" config={FACES[2]} mood="worried" size={170 * k} />
      </div>
      <h1>
        Synonym <span className="hl">Showdown</span>
      </h1>
      <p>Name a synonym… or call a bluff.</p>
      <small>Free multiplayer word game · synonymshowdown.com</small>
    </div>
  );
}

export function AppIcon({ size }: { size: number }) {
  return (
    <div className="app-icon" style={{ width: size, height: size }}>
      <Avatar id="icon" config={{ ...FACES[1], hat: 'crown', eyes: 'dots', mouth: 'grin' }} size={size * 0.86} />
    </div>
  );
}
