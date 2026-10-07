// A doodled blob face. Mood changes the eyes and mouth.

import { useLayoutEffect, useRef } from 'react';
import rough from 'roughjs';
import { INK } from './sketch';

export type Mood = 'normal' | 'think' | 'out' | 'win' | 'worried';

function seedFrom(s: string): number {
  let h = 7;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 9973;
  return h + 1;
}

export function Avatar({ color, mood = 'normal', size = 64, id }: { color: string; mood?: Mood; size?: number; id: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useLayoutEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    svg.replaceChildren();
    const rc = rough.svg(svg);
    const seed = seedFrom(id);
    const line = { stroke: INK, strokeWidth: 2.2, roughness: 1.2, seed };
    const faded = mood === 'out';
    svg.appendChild(
      rc.circle(50, 52, 82, {
        ...line,
        fill: faded ? '#ccc' : color,
        fillStyle: 'hachure',
        hachureGap: 5,
        fillWeight: 2,
        hachureAngle: (seed % 90) - 45,
      }),
    );
    const add = (d: string) => svg.appendChild(rc.path(d, { ...line, roughness: 0.6 }));
    // eyes
    if (mood === 'out') {
      add('M30 38 L42 50 M42 38 L30 50');
      add('M58 38 L70 50 M70 38 L58 50');
    } else if (mood === 'win') {
      add('M29 47 Q36 37 43 47');
      add('M57 47 Q64 37 71 47');
    } else {
      const look = mood === 'think' ? -4 : 0;
      svg.appendChild(rc.circle(36, 44 + look, 7, { ...line, fill: INK, fillStyle: 'solid', roughness: 0.4 }));
      svg.appendChild(rc.circle(64, 44 + look, 7, { ...line, fill: INK, fillStyle: 'solid', roughness: 0.4 }));
    }
    // mouth
    if (mood === 'win') add('M32 62 Q50 82 68 62 Z');
    else if (mood === 'out') add('M36 72 Q50 62 64 72');
    else if (mood === 'worried') add('M36 70 Q43 64 50 70 Q57 76 64 68');
    else if (mood === 'think') add('M42 68 L58 66');
    else add('M36 64 Q50 76 64 64');
  }, [color, mood, id]);
  return <svg ref={ref} viewBox="0 0 100 100" width={size} height={size} className="avatar" aria-hidden />;
}
