// Top level: switches between the home screen and a game.

import { useState } from 'react';
import { loadConfig, saveConfig, type BotGameConfig } from './ui/config';
import { Game } from './ui/Game';
import { Home } from './ui/Home';
import { isMuted, setMuted } from './ui/sound';

export function App() {
  const [config, setConfig] = useState<BotGameConfig>(loadConfig);
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
      {playing ? (
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
