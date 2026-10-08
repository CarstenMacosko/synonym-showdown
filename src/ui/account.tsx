// Signed-in state, the account bar at the top of the page, and the sign-in / create-account dialog.

import { AnimatePresence, motion } from 'framer-motion';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { api, type Account } from '../net/api';
import { Choice, SketchBox, SketchButton } from './sketch';

interface AccountState {
  user: Account | null;
  signOut: () => Promise<void>;
  /** False until we've asked the server who's signed in. */
  ready: boolean;
  refresh: () => Promise<void>;
  openSignIn: () => void;
}

const Ctx = createContext<AccountState>({ user: null, ready: false, refresh: async () => {}, openSignIn: () => {}, signOut: async () => {} });

export function useAccount() {
  return useContext(Ctx);
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Account | null>(null);
  const [ready, setReady] = useState(false);
  const [dialog, setDialog] = useState(false);
  const refresh = useCallback(async () => {
    try {
      setUser(await api.me());
    } catch {
      /* offline or server unavailable: play as a guest */
    }
    setReady(true);
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <Ctx.Provider
      value={{
        user,
        ready,
        refresh,
        openSignIn: () => setDialog(true),
        signOut: async () => {
          await api.logout().catch(() => {});
          setUser(null);
        },
      }}
    >
      {children}
      <AnimatePresence>
        {dialog && (
          <AuthDialog
            onClose={() => setDialog(false)}
            onDone={(u) => {
              setUser(u);
              setDialog(false);
            }}
          />
        )}
      </AnimatePresence>
    </Ctx.Provider>
  );
}

/** "Sign in" button, or the signed-in player's name, rating and points (shown on the home screen). */
export function AccountBar({ onAdmin }: { onAdmin?: () => void }) {
  const { user, openSignIn: onSignIn, signOut: onSignOut } = useAccount();
  const [menu, setMenu] = useState(false);
  if (!user) {
    return (
      <button className="account-bar" onClick={onSignIn}>
        Sign in
      </button>
    );
  }
  return (
    <div className="account-bar signed-in">
      <button onClick={() => setMenu(!menu)} aria-expanded={menu}>
        <b>{user.username}</b> · {user.rating}
        {user.provisional ? '?' : ''} · {user.points} pts
      </button>
      {menu && (
        <SketchBox className="account-menu">
          <p>
            Ranked: {user.rankedWins}–{user.rankedGames - user.rankedWins}
            {user.provisional && <small> (rating still settling)</small>}
          </p>
          <p>Games played: {user.games}</p>
          {user.isAdmin && onAdmin && (
            <p>
              <button className="disagree" onClick={onAdmin}>
                Admin page
              </button>
            </p>
          )}
          <button className="disagree" onClick={onSignOut}>
            Sign out
          </button>
        </SketchBox>
      )}
    </div>
  );
}

const KNOWN = 'ss-has-account';

function AuthDialog({ onClose, onDone }: { onClose: () => void; onDone: (u: Account) => void }) {
  // First-time visitors most likely want to create an account; returning ones want to sign in.
  const [mode, setMode] = useState<'signin' | 'create'>(() => {
    try {
      return localStorage.getItem(KNOWN) ? 'signin' : 'create';
    } catch {
      return 'create';
    }
  });
  // Only close when a click both starts and ends on the dark backdrop (not when a text selection
  // that began inside the form ends outside it).
  const pressedBackdrop = useRef(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const user = mode === 'create' ? await api.register(username.trim(), password) : await api.login(username.trim(), password);
      try {
        localStorage.setItem(KNOWN, '1');
      } catch {
        /* storage unavailable */
      }
      onDone(user);
    } catch (err) {
      const msg = (err as Error).message;
      setError(mode === 'signin' && /wrong username/i.test(msg) ? `${msg} New here? Use “Create account” above.` : msg);
    }
    setBusy(false);
  }

  return (
    <motion.div
      className="overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onPointerDown={(e) => (pressedBackdrop.current = e.target === e.currentTarget)}
      onClick={(e) => {
        if (pressedBackdrop.current && e.target === e.currentTarget) onClose();
        pressedBackdrop.current = false;
      }}
    >
      <motion.div initial={{ scale: 0.6, rotate: -3 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', bounce: 0.5 }}>
        <SketchBox className="result-card auth-card" fill="#fff">
          <div className="auth-tabs">
            <Choice<'create' | 'signin'>
              value={mode}
              onChange={(m) => {
                setMode(m);
                setError(null);
              }}
              options={[
                { value: 'create', label: 'Create account' },
                { value: 'signin', label: 'Sign in' },
              ]}
            />
          </div>
          <p className="muted">Keep your ranking and points across devices.</p>
          <form onSubmit={submit} className="auth-form">
            <label>
              <span>Username</span>
              <SketchBox className="input-wrap">
                <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" maxLength={16} autoFocus />
              </SketchBox>
            </label>
            <label>
              <span>Password</span>
              <SketchBox className="input-wrap">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
                />
              </SketchBox>
            </label>
            {mode === 'create' && <small className="muted">3–16 letters, numbers or _ · password 8+ characters</small>}
            {error && <p className="error">{error}</p>}
            <SketchButton type="submit" color="#ffd43b" disabled={busy}>
              {busy ? '…' : mode === 'create' ? 'Create account' : 'Sign in'}
            </SketchButton>
          </form>
          <button className="disagree" onClick={onClose}>
            Cancel
          </button>
        </SketchBox>
      </motion.div>
    </motion.div>
  );
}
