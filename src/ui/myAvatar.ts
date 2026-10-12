// The player's own face: from their account when signed in, otherwise kept on this device.

import { useCallback, useState } from 'react';
import { lockAvatar, randomAvatar, sanitizeAvatar, type AvatarConfig } from '../game/avatar';
import { api } from '../net/api';
import { useAccount } from './account';

const KEY = 'ss-avatar';

function readLocal(): AvatarConfig | null {
  try {
    return sanitizeAvatar(JSON.parse(localStorage.getItem(KEY) ?? 'null'));
  } catch {
    return null;
  }
}

/** Bots get a fun face of their own, the same every time for the same name. */
export function botAvatar(name: string): AvatarConfig {
  let h = 2166136261;
  for (const c of name) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  let seed = h >>> 0;
  const rng = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  return randomAvatar(rng);
}

export function useMyAvatar() {
  const { user, refresh } = useAccount();
  const [local, setLocal] = useState<AvatarConfig | null>(readLocal);
  // Guests have no points, so a locked hat saved on this device comes off.
  const avatar = user?.avatar ?? (local && lockAvatar(local, 0));

  const save = useCallback(
    async (a: AvatarConfig) => {
      try {
        localStorage.setItem(KEY, JSON.stringify(a));
      } catch {
        /* storage unavailable */
      }
      setLocal(a);
      if (user) {
        await api.saveAvatar(a);
        await refresh();
      }
    },
    [user, refresh],
  );
  return { avatar, save };
}
