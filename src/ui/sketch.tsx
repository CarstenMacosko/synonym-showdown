// Hand-drawn UI pieces. Rough.js draws wobbly "pencil" outlines into an SVG that sits behind the content.

import { motion, type HTMLMotionProps } from 'framer-motion';
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import rough from 'roughjs';
import type { Options } from 'roughjs/bin/core';

export const INK = '#2b2b2b';

/** A quick wobble for the text box when a guess is rejected. Use with framer-motion's `useAnimate`. */
export const JIGGLE = {
  keyframes: { x: [0, -7, 7, -5, 5, -2, 0], rotate: [0, -3, 3, -2, 2, -1, 0] },
  options: { duration: 0.45 },
};

type Shape = 'rect' | 'ellipse';

/** Draws a rough outline that fills its parent and redraws when the parent resizes. */
function useRoughOutline(shape: Shape, opts: Options, deps: unknown[]) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [seed] = useState(() => Math.floor(Math.random() * 10_000) + 1);
  useLayoutEffect(() => {
    const svg = svgRef.current;
    const host = svg?.parentElement;
    if (!svg || !host) return;
    const draw = () => {
      // Layout size, not on-screen size: a box inside something that's zooming in (like a dialog
      // popping open) would otherwise be measured mid-animation and get a too-small outline.
      const width = host.offsetWidth;
      const height = host.offsetHeight;
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
      svg.replaceChildren();
      if (width < 4 || height < 4) return;
      const rc = rough.svg(svg);
      const o: Options = { stroke: INK, strokeWidth: 2, roughness: 1.4, bowing: 1, seed, ...opts };
      const pad = 3;
      svg.appendChild(
        shape === 'ellipse'
          ? rc.ellipse(width / 2, height / 2, width - pad * 2, height - pad * 2, o)
          : rc.rectangle(pad, pad, width - pad * 2, height - pad * 2, o),
      );
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(host);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return svgRef;
}

function Outline({ shape = 'rect', opts = {} }: { shape?: Shape; opts?: Options }) {
  const ref = useRoughOutline(shape, opts, [shape, JSON.stringify(opts)]);
  return <svg ref={ref} className="sketch-outline" aria-hidden />;
}

export function SketchBox({
  children,
  className = '',
  style,
  fill,
  fillStyle = 'hachure',
  shape = 'rect',
  strokeWidth,
}: {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  fill?: string;
  fillStyle?: Options['fillStyle'];
  shape?: Shape;
  strokeWidth?: number;
}) {
  return (
    <div className={`sketch ${className}`} style={style}>
      <Outline shape={shape} opts={{ fill, fillStyle, hachureGap: 6, fillWeight: 1.5, ...(strokeWidth ? { strokeWidth } : {}) }} />
      <div className="sketch-content">{children}</div>
    </div>
  );
}

type ButtonProps = Omit<HTMLMotionProps<'button'>, 'children'> & {
  children: ReactNode;
  color?: string;
  big?: boolean;
};

/** A bouncy hand-drawn button. `color` fills it with pencil hatching. */
export function SketchButton({ children, color, big, className = '', disabled, ...rest }: ButtonProps) {
  return (
    <motion.button
      className={`sketch sketch-button ${big ? 'big' : ''} ${className}`}
      disabled={disabled}
      whileHover={disabled ? undefined : { scale: 1.05, rotate: -1 }}
      whileTap={disabled ? undefined : { scale: 0.93, rotate: 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 15 }}
      {...rest}
    >
      <Outline opts={{ fill: color, fillStyle: 'hachure', hachureGap: 5, fillWeight: 2.5, strokeWidth: big ? 2.5 : 2 }} />
      <span className="sketch-content">{children}</span>
    </motion.button>
  );
}

/** A row of choices like [Easy] [Medium] [Hard]; the selected one gets colored in. */
export function Choice<T extends string>({
  value,
  options,
  onChange,
  color = '#ffd43b',
}: {
  value: T;
  options: { value: T; label: string; detail?: string }[];
  onChange: (v: T) => void;
  color?: string;
}) {
  return (
    <div className="choice-row" role="radiogroup">
      {options.map((o) => (
        <SketchButton
          key={o.value}
          role="radio"
          aria-checked={o.value === value}
          className={`choice ${o.value === value ? 'selected' : ''}`}
          color={o.value === value ? color : undefined}
          onClick={() => onChange(o.value)}
        >
          {o.label}
          {o.detail && <small>{o.detail}</small>}
        </SketchButton>
      ))}
    </div>
  );
}
