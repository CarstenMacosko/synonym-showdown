// Top level: switches between the home screen, local games, online rooms and the ranked queue.

import { useCallback, useState } from 'react';
import { ROOM_CODE_RE } from './game/protocol';
import { api } from './net/api';
import { AccountProvider } from './ui/account';
import { loadConfig, saveConfig, type GameConfig } from './ui/config';
import { Game } from './ui/Game';
import { Home, type OnlineAction } from './ui/Home';
import { AdminPage } from './ui/Admin';
import { AvatarGallery } from './ui/AvatarGallery';
import { AppIcon, OgCard } from './ui/BrandArt';
import { OnlineGame, RankedQueue } from './ui/OnlineGame';
import { ProfilePage } from './ui/Profile';
import { SoloGame } from './ui/SoloGame';
import { isMusicOn, refreshMusic, setMusicOn } from './ui/music';
import { isMuted, setMuted } from './ui/sound';

/** Online, a guest who never picked a name gets "Guest 37" rather than "You" (which reads oddly to others). */
function onlineName(name: string): string {
  if (name.trim() && name.trim() !== 'You') return name.trim();
  try {
    const saved = sessionStorage.getItem('ss-guest-name');
    if (saved) return saved;
    const made = `Guest ${10 + Math.floor(Math.random() * 90)}`;
    sessionStorage.setItem('ss-guest-name', made);
    return made;
  } catch {
    return 'Guest';
  }
}

type Screen = { kind: 'home' } | { kind: 'local' } | { kind: 'room'; code: string } | { kind: 'queue' } | { kind: 'admin' } | { kind: 'profile' };

/** An invite link like synonymshowdown.com/?room=ABCD opens that room directly. */
function initialScreen(): Screen {
  const code = new URLSearchParams(window.location.search).get('room')?.toUpperCase();
  if (code && ROOM_CODE_RE.test(code)) {
    window.history.replaceState(null, '', window.location.pathname);
    return { kind: 'room', code };
  }
  return { kind: 'home' };
}

export function App() {
  if (import.meta.env.DEV) {
    const q = new URLSearchParams(window.location.search);
    if (q.has('gallery')) return <AvatarGallery />;
    if (q.has('og')) return <OgCard />;
    if (q.has('cover')) return <OgCard compact />;
    if (q.has('icon')) return <AppIcon size={Number(q.get('icon')) || 512} />;
  }
  return <MainApp />;
}

function MainApp() {
  const [config, setConfig] = useState<GameConfig>(loadConfig);
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [notice, setNotice] = useState<string | null>(null);
  const [muted, setMutedState] = useState(isMuted);
  const [music, setMusicState] = useState(isMusicOn);
  const home = useCallback(() => setScreen({ kind: 'home' }), []);
  const matched = useCallback((code: string) => setScreen({ kind: 'room', code }), []);

  async function online(c: GameConfig, action: OnlineAction) {
    saveConfig(c);
    setConfig(c);
    setNotice(null);
    if (action.kind === 'ranked') return setScreen({ kind: 'queue' });
    if (action.kind === 'join') return setScreen({ kind: 'room', code: action.code });
    try {
      setScreen({ kind: 'room', code: await api.createRoom() });
    } catch (e) {
      setNotice((e as Error).message);
    }
  }

  const solo = config.mode === 'score' || config.mode === 'daily' || config.mode === 'survival';

  return (
    <AccountProvider>
      <button
        className="mute"
        aria-label={muted ? 'Unmute' : 'Mute'}
        onClick={() => {
          setMuted(!muted);
          setMutedState(!muted);
          refreshMusic();
        }}
      >
        {muted ? '🔇' : '🔊'}
      </button>
      <button
        className={`music-toggle ${music && !muted ? '' : 'off'}`}
        aria-label={music ? 'Turn music off' : 'Turn music on'}
        title={music ? 'Music on' : 'Music off'}
        onClick={() => {
          setMusicOn(!music);
          setMusicState(!music);
        }}
      >
        🎵
      </button>
      {screen.kind === 'profile' ? (
        <ProfilePage onExit={home} />
      ) : screen.kind === 'admin' ? (
        <AdminPage onExit={home} />
      ) : screen.kind === 'room' ? (
        <OnlineGame key={screen.code} code={screen.code} name={onlineName(config.name)} onExit={home} onFindMatch={() => setScreen({ kind: 'queue' })} />
      ) : screen.kind === 'queue' ? (
        <RankedQueue onMatched={matched} onCancel={home} />
      ) : screen.kind === 'local' && solo ? (
        <SoloGame
          mode={config.mode as 'score' | 'daily' | 'survival'}
          tier={config.settings.tier}
          forgiveness={config.settings.forgiveness}
          range={config.settings.range}
          onExit={home}
        />
      ) : screen.kind === 'local' ? (
        <Game config={config} onExit={home} />
      ) : (
        <Home
          config={config}
          notice={notice}
          onPlay={(c) => {
            saveConfig(c);
            setConfig(c);
            setScreen({ kind: 'local' });
          }}
          onOnline={online}
          onAdmin={() => setScreen({ kind: 'admin' })}
          onProfile={() => setScreen({ kind: 'profile' })}
        />
      )}
    </AccountProvider>
  );
}
