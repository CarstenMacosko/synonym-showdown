// Top level: switches between the home screen and a game.

import { useState } from 'react';
import { loadConfig, saveConfig, type GameConfig } from './ui/config';
import { Game } from './ui/Game';
import { Home } from './ui/Home';
import { SoloGame } from './ui/SoloGame';
import { isMuted, setMuted } from './ui/sound';

export function App() {
  const [config, setConfig] = useState<GameConfig>(loadConfig);
  const [playing, setPlaying] = useState(false);
  const [muted, setMutedState] = useState(isMuted);

  return (
    <>
      <button
        className="mute"
        aria-label={muted ? 'Unmute' : 'Mute'}
        onClick={() => {
          setMuted(!muted);
          setMutedState(!muted);
        }}
      >
        {muted ? '🔇' : '🔊'}
      </button>
      {playing && (config.mode === 'score' || config.mode === 'daily' || config.mode === 'survival') ? (
        <SoloGame
          mode={config.mode}
          tier={config.settings.tier}
          forgiveness={config.settings.forgiveness}
          onExit={() => setPlaying(false)}
        />
      ) : playing ? (
        <Game config={config} onExit={() => setPlaying(false)} />
      ) : (
        <Home
          config={config}
          onPlay={(c) => {
            saveConfig(c);
            setConfig(c);
            setPlaying(true);
          }}
        />
      )}
    </>
  );
}
