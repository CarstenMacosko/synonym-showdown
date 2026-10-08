// Measures how each word was entered, for the server's cheat detector: time from first keystroke to submit,
// whether it was pasted or dropped in, and whether this is a touch device (where whole words get inserted by
// the keyboard, so typing speed means nothing). This only ever feeds the detector; it never affects scoring.

import { useMemo, useRef } from 'react';

export interface TypingInfo {
  typedMs: number | null;
  pasted: boolean;
  touch: boolean;
}

export function useTypingMeter() {
  const firstKey = useRef<number | null>(null);
  const pasted = useRef(false);
  const touch = useMemo(() => {
    try {
      return window.matchMedia('(pointer: coarse)').matches;
    } catch {
      return false;
    }
  }, []);
  return {
    /** Call from the input's onChange with the new value. */
    onInput(value: string) {
      if (!value) firstKey.current = null;
      else if (firstKey.current === null) firstKey.current = performance.now();
    },
    /** Call from onPaste / onDrop. */
    onPaste() {
      pasted.current = true;
    },
    /** Read and reset, when a word is submitted. */
    take(): TypingInfo {
      const info = {
        typedMs: firstKey.current === null ? null : Math.round(performance.now() - firstKey.current),
        pasted: pasted.current,
        touch,
      };
      firstKey.current = null;
      pasted.current = false;
      return info;
    },
  };
}
