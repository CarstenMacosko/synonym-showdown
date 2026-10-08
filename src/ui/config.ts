// What the player picked on the home screen, remembered between visits.

import type { BotLevel, Settings } from '../game/engine';

export type ModeId = 'bots' | 'score' | 'daily' | 'survival' | 'pass';

export interface GameConfig {
  mode: ModeId;
  name: string;
  /** Player names for pass-and-play. */
  passNames: string[];
  bots: number;
  botLevel: BotLevel;
  settings: Settings;
}

export const DEFAULT_CONFIG: GameConfig = {
  mode: 'bots',
  name: 'You',
  passNames: ['Player 1', 'Player 2'],
  bots: 2,
  botLevel: 'medium',
  settings: { tier: 'easy', timeControl: 'rapid', forgiveness: 'typos', afterElimination: 'newWord', range: 'standard' },
};

const KEY = 'ss-config';
export const PASS_MAX = 5;

export function loadConfig(): GameConfig {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (saved) return { ...DEFAULT_CONFIG, ...saved, settings: { ...DEFAULT_CONFIG.settings, ...saved.settings } };
  } catch {
    /* storage unavailable or corrupt */
  }
  return DEFAULT_CONFIG;
}

export function saveConfig(c: GameConfig) {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    /* storage unavailable */
  }
}

export const PLAYER_COLORS = ['#4dabf7', '#ff8787', '#69db7c', '#ffd43b', '#da77f2'];
