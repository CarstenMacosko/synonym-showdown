// A doodled face drawn with Rough.js. Players customize it (src/game/avatar.ts); the mood changes the
// expression during games (thinking, worried, out, winning).

import { useLayoutEffect, useRef } from 'react';
import rough from 'roughjs';
import type { Options } from 'roughjs/bin/core';
import { AVATAR_COLORS, defaultAvatar, type AvatarConfig } from '../game/avatar';
import { INK } from './sketch';

export type Mood = 'normal' | 'think' | 'out' | 'win' | 'worried';

function seedFrom(s: string): number {
  let h = 7;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 9973;
  return h + 1;
}

const PINK = '#ff8fab';
const GOLD = '#fcc419';

/** Draw a face into an <svg> (viewBox 0 0 100 100). */
function drawFace(svg: SVGSVGElement, a: AvatarConfig, mood: Mood, seed: number) {
  svg.replaceChildren();
  const rc = rough.svg(svg);
  const line: Options = { stroke: INK, strokeWidth: 2.2, roughness: 1.1, seed };
  const color = mood === 'out' ? '#ced4da' : AVATAR_COLORS[a.color];
  const accent = AVATAR_COLORS[a.accent];
  const put = (node: SVGGElement) => svg.appendChild(node);
  const path = (d: string, o: Options = {}) => put(rc.path(d, { ...line, roughness: 0.6, ...o }));
  const fill = (fillColor: string, style: Options['fillStyle'] = 'solid'): Options => ({ fill: fillColor, fillStyle: style, hachureGap: 4, fillWeight: 1.6 });

  // ---- head ----
  const skin: Options = {
    ...line,
    fill: color,
    fillStyle: a.texture,
    hachureGap: a.texture === 'dots' ? 6 : 5,
    fillWeight: a.texture === 'dots' ? 1.2 : 2,
    hachureAngle: (seed % 90) - 45,
  };
  if (a.shape === 'square') put(rc.rectangle(17, 28, 66, 64, skin));
  else if (a.shape === 'blob') put(rc.path('M50 27 C78 25 88 48 84 66 C80 88 62 95 46 93 C24 91 14 76 16 58 C18 38 28 29 50 27 Z', skin));
  else if (a.shape === 'tall') put(rc.ellipse(50, 61, 58, 74, skin));
  else if (a.shape === 'wide') put(rc.ellipse(50, 63, 82, 60, skin));
  else put(rc.circle(50, 61, 66, skin));

  // ---- hat (behind-the-face parts first) ----
  if (a.hat === 'headphones') {
    path('M17 62 Q15 22 50 21 Q85 22 83 62', { strokeWidth: 4 });
    put(rc.rectangle(9, 52, 14, 22, { ...line, ...fill(accent) }));
    put(rc.rectangle(77, 52, 14, 22, { ...line, ...fill(accent) }));
  }

  // ---- eyes ----
  const dot = (x: number, y: number, r = 7) => put(rc.circle(x, y, r, { ...line, fill: INK, fillStyle: 'solid', roughness: 0.4 }));
  const eyes = mood === 'out' ? 'x' : mood === 'win' && a.eyes !== 'shades' ? 'happy' : a.eyes;
  const look = mood === 'think' ? -4 : 0;
  const ey = 55 + look;
  switch (eyes) {
    case 'x':
      path('M32 50 L44 62 M44 50 L32 62');
      path('M56 50 L68 62 M68 50 L56 62');
      break;
    case 'happy':
      path('M31 58 Q38 48 45 58');
      path('M55 58 Q62 48 69 58');
      break;
    case 'wide':
      put(rc.circle(38, ey, 15, { ...line, fill: '#fff', fillStyle: 'solid', roughness: 0.5 }));
      put(rc.circle(62, ey, 15, { ...line, fill: '#fff', fillStyle: 'solid', roughness: 0.5 }));
      dot(39, ey + 1, 6);
      dot(63, ey + 1, 6);
      break;
    case 'sleepy':
      path(`M31 ${ey} Q38 ${ey + 5} 45 ${ey}`);
      path(`M55 ${ey} Q62 ${ey + 5} 69 ${ey}`);
      break;
    case 'wink':
      dot(38, ey);
      path(`M55 ${ey + 2} Q62 ${ey - 6} 69 ${ey + 2}`);
      break;
    case 'glasses':
      put(rc.circle(38, ey, 17, { ...line, strokeWidth: 2.4, roughness: 0.5 }));
      put(rc.circle(62, ey, 17, { ...line, strokeWidth: 2.4, roughness: 0.5 }));
      path(`M46 ${ey} L54 ${ey}`);
      dot(38, ey, 5);
      dot(62, ey, 5);
      break;
    case 'shades':
      put(rc.rectangle(27, ey - 6, 20, 11, { ...line, fill: INK, fillStyle: 'solid', roughness: 0.5 }));
      put(rc.rectangle(53, ey - 6, 20, 11, { ...line, fill: INK, fillStyle: 'solid', roughness: 0.5 }));
      path(`M47 ${ey - 3} L53 ${ey - 3}`);
      break;
    case 'star': {
      const star = (cx: number, cy: number) =>
        put(
          rc.polygon(
            [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => {
              const r = i % 2 ? 3 : 7.5;
              const t = (Math.PI / 5) * i - Math.PI / 2;
              return [cx + r * Math.cos(t), cy + r * Math.sin(t)] as [number, number];
            }),
            { ...line, fill: GOLD, fillStyle: 'solid', strokeWidth: 1.4, roughness: 0.4 },
          ),
        );
      star(38, ey);
      star(62, ey);
      break;
    }
    default:
      dot(38, ey);
      dot(62, ey);
  }

  // ---- extras on the face ----
  if (a.extra === 'blush') {
    put(rc.ellipse(29, 68, 11, 6, { stroke: 'none', fill: PINK, fillStyle: 'solid', seed }));
    put(rc.ellipse(71, 68, 11, 6, { stroke: 'none', fill: PINK, fillStyle: 'solid', seed }));
  } else if (a.extra === 'freckles') {
    for (const [x, y] of [[29, 66], [33, 70], [26, 70], [71, 66], [67, 70], [74, 70]]) dot(x, y, 2.4);
  } else if (a.extra === 'bandaid') {
    put(rc.polygon([[62, 38], [76, 32], [79, 39], [65, 45]], { ...line, fill: '#ffe8cc', fillStyle: 'solid', strokeWidth: 1.4 }));
  }

  // ---- mouth ----
  const mouth = mood === 'win' ? 'grin' : mood === 'out' ? 'frown' : mood === 'worried' ? 'wavy' : mood === 'think' ? 'flat' : a.mouth;
  switch (mouth) {
    case 'grin':
      path('M36 71 Q50 89 64 71 Z', fill('#fff'));
      break;
    case 'frown':
      path('M38 81 Q50 71 62 81');
      break;
    case 'wavy':
      path('M37 78 Q43 72 50 78 Q57 84 63 76');
      break;
    case 'flat':
      path('M41 77 L59 76');
      break;
    case 'o':
      put(rc.circle(50, 77, 10, { ...line, roughness: 0.5 }));
      break;
    case 'tongue':
      path('M37 72 Q50 84 63 72');
      path('M45 78 Q50 88 55 78', fill(PINK));
      break;
    case 'smirk':
      path('M40 78 Q53 80 62 71');
      break;
    case 'teeth':
      put(rc.rectangle(39, 71, 22, 10, { ...line, fill: '#fff', fillStyle: 'solid', roughness: 0.5 }));
      path('M50 71 L50 81 M44.5 71 L44.5 81 M55.5 71 L55.5 81', { strokeWidth: 1.2 });
      break;
    default:
      path('M37 72 Q50 84 63 72');
  }
  if (a.extra === 'mustache') path('M36 70 Q43 63 50 69 Q57 63 64 70 Q57 73 50 70 Q43 73 36 70 Z', fill(INK));
  if (a.extra === 'bowtie') {
    put(rc.polygon([[36, 99], [50, 94], [36, 89]], { ...line, ...fill(accent), strokeWidth: 1.6 }));
    put(rc.polygon([[64, 99], [50, 94], [64, 89]], { ...line, ...fill(accent), strokeWidth: 1.6 }));
  }

  // ---- hats ----
  const hatFill: Options = { ...line, ...fill(accent, 'hachure'), hachureAngle: 60 };
  switch (a.hat) {
    case 'cap':
      path('M24 35 Q50 3 76 35 Z', hatFill);
      path('M58 34 L94 38', { strokeWidth: 5 });
      break;
    case 'beanie':
      path('M23 37 Q50 -1 77 37 Z', hatFill);
      put(rc.rectangle(21, 30, 58, 9, { ...line, ...fill(accent) }));
      put(rc.circle(50, 7, 11, { ...line, ...fill('#fff') }));
      break;
    case 'crown':
      put(rc.polygon([[26, 35], [26, 12], [38, 25], [50, 6], [62, 25], [74, 12], [74, 35]], { ...line, ...fill(GOLD) }));
      dot(50, 28, 4);
      break;
    case 'tophat':
      put(rc.rectangle(33, 3, 34, 29, { ...line, ...fill(INK) }));
      put(rc.rectangle(33, 22, 34, 6, { ...line, ...fill(accent) }));
      path('M19 32 L81 32', { strokeWidth: 5 });
      break;
    case 'party':
      put(rc.polygon([[33, 33], [50, 1], [67, 33]], { ...line, ...fill(accent, 'zigzag') }));
      put(rc.circle(50, 3, 8, { ...line, ...fill(GOLD) }));
      break;
    case 'wizard':
      put(rc.polygon([[24, 35], [58, -2], [76, 35]], { ...line, ...fill(accent, 'hachure') }));
      put(rc.ellipse(50, 35, 60, 8, { ...line, ...fill(accent) }));
      dot(52, 18, 3);
      dot(44, 26, 2.5);
      break;
    case 'bow':
      put(rc.polygon([[56, 24], [68, 16], [68, 32]], { ...line, ...fill(accent) }));
      put(rc.polygon([[80, 24], [68, 16], [68, 32]], { ...line, ...fill(accent) }));
      put(rc.circle(68, 24, 6, { ...line, ...fill(accent) }));
      break;
    case 'propeller':
      path('M33 33 Q50 15 67 33 Z', hatFill);
      path('M50 22 L50 12', { strokeWidth: 2.5 });
      put(rc.ellipse(39, 11, 22, 6, { ...line, ...fill('#ff6b6b') }));
      put(rc.ellipse(61, 11, 22, 6, { ...line, ...fill('#4dabf7') }));
      break;
    case 'halo':
      put(rc.ellipse(50, 14, 46, 11, { ...line, stroke: GOLD, strokeWidth: 4 }));
      break;
    case 'horns':
      put(rc.polygon([[29, 34], [22, 10], [41, 29]], { ...line, ...fill(accent) }));
      put(rc.polygon([[71, 34], [78, 10], [59, 29]], { ...line, ...fill(accent) }));
      break;
  }
}

export function Avatar({
  config,
  color,
  mood = 'normal',
  size = 64,
  id,
}: {
  /** The player's chosen face; without it, a plain face in `color`. */
  config?: AvatarConfig | null;
  color?: string;
  mood?: Mood;
  size?: number;
  id: string;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const a = config ?? defaultAvatar(id, color);
  const key = JSON.stringify(a);
  useLayoutEffect(() => {
    if (ref.current) drawFace(ref.current, a, mood, seedFrom(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, mood, id]);
  return <svg ref={ref} viewBox="0 0 100 100" width={size} height={size} className="avatar" aria-hidden />;
}
