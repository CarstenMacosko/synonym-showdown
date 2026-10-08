// Admin page (admin accounts only): review players' "Disagree?" reports and the cheat detector's tags.

import { useEffect, useState } from 'react';
import { api, type AdminFlag, type AdminReport, type AdminUser } from '../net/api';
import { useAccount } from './account';
import { Choice, SketchBox, SketchButton } from './sketch';

export function AdminPage({ onExit }: { onExit: () => void }) {
  const { user } = useAccount();
  const [tab, setTab] = useState<'reports' | 'flags' | 'accounts'>('reports');
  const [accounts, setAccounts] = useState<{ total: number; users: AdminUser[] } | null>(null);
  const [reports, setReports] = useState<AdminReport[] | null>(null);
  const [flags, setFlags] = useState<AdminFlag[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    api.adminReports().then(setReports).catch((e: Error) => setError(e.message));
    api.adminFlags().then(setFlags).catch((e: Error) => setError(e.message));
    api.adminUsers().then(setAccounts).catch((e: Error) => setError(e.message));
  };
  useEffect(load, []);

  if (!user?.isAdmin) {
    return (
      <div className="page">
        <p>Admins only.</p>
        <SketchButton onClick={onExit}>Back</SketchButton>
      </div>
    );
  }

  // One row per tagged player (the API returns one row per tag).
  const players = new Map<string, AdminFlag[]>();
  for (const f of flags ?? []) players.set(f.username, [...(players.get(f.username) ?? []), f]);

  return (
    <div className="page admin">
      <div className="topbar">
        <SketchButton onClick={onExit} className="small">
          ✕ Close
        </SketchButton>
        <span className="pill">Admin</span>
      </div>
      <Choice<'reports' | 'flags' | 'accounts'>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'reports', label: `Word reports${reports ? ` (${reports.length})` : ''}` },
          { value: 'flags', label: `Cheat watch${flags ? ` (${players.size})` : ''}` },
          { value: 'accounts', label: `Accounts${accounts ? ` (${accounts.total})` : ''}` },
        ]}
      />
      {error && <p className="error">{error}</p>}

      {tab === 'reports' && (
        <SketchBox className="panel">
          <h2>“Disagree?” reports</h2>
          <p className="muted hint">
            Fix a word in <code>tools/wordbank/overrides.json</code> (or ask Claude to), then mark it fixed. Dismiss reports you disagree with.
          </p>
          {reports?.length === 0 && <p>No open reports. 🎉</p>}
          {reports?.map((r) => (
            <div key={`${r.starter}-${r.word}-${r.ruling}`} className="admin-row">
              <div>
                <b>{r.starter}</b> → <b>{r.word}</b> <small className="muted">×{r.n}</small>
                <br />
                <small className="muted">
                  Game {r.ruling} it ({r.range}); players say it {r.ruling === 'rejected' ? 'should count' : 'should not count'}.
                </small>
              </div>
              <div className="admin-actions">
                {(['fixed', 'dismissed'] as const).map((status) => (
                  <button
                    key={status}
                    className="disagree"
                    onClick={() => api.resolveReport(r.starter, r.word, status).then(load, (e: Error) => setError(e.message))}
                  >
                    {status === 'fixed' ? 'Fixed' : 'Dismiss'}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </SketchBox>
      )}

      {tab === 'accounts' && (
        <SketchBox className="panel">
          <h2>Accounts ({accounts?.total ?? '…'})</h2>
          {accounts?.users.map((u) => (
            <div key={u.username} className="admin-row">
              <div>
                <b>{u.username}</b>
                {u.is_admin ? <small> · admin</small> : null}
                {u.suspicious ? <span className="flag-tag"> flagged</span> : null}
                <br />
                <small className="muted">
                  joined {new Date(u.created_at).toLocaleDateString()} · rating {Math.round(u.rating)}
                  {u.rd > 110 ? '?' : ''} · ranked {u.ranked_wins}–{u.ranked_games - u.ranked_wins} · {u.games} games · {u.points} pts
                </small>
              </div>
            </div>
          ))}
        </SketchBox>
      )}

      {tab === 'flags' && (
        <SketchBox className="panel">
          <h2>Cheat watch</h2>
          <p className="muted hint">
            Every game gets a suspicion score (0–100) from timing, typing speed, pasting, rare words and volume. <b>Tagged</b> players had a
            blatant session or repeated suspicion: they show “under review” and are hidden from the leaderboard. <b>Watching</b> players had
            odd sessions but not enough evidence yet. Clear a tag if it was a false alarm.
          </p>
          {players.size === 0 && <p>Nothing suspicious so far.</p>}
          {[...players.entries()].map(([username, list]) => (
            <div key={username} className="admin-row">
              <div>
                <b>{username}</b>{' '}
                {list[0].suspicious > 0 ? <span className="flag-tag">tagged</span> : <small className="muted">watching</small>}
                <small className="muted">
                  {' '}
                  · average score {Math.round(list[0].cheat_score)} over {list[0].cheat_sessions} session(s) · rating {Math.round(list[0].rating)}
                </small>
                {list.slice(0, 4).map((f) => (
                  <div key={f.created_at}>
                    <small className="muted">
                      {new Date(f.created_at).toLocaleString()} ({f.source}, score {f.score ?? '?'}
                      {f.tagged ? ', tagged' : ''}): {(JSON.parse(f.reasons) as string[]).join('; ')}
                    </small>
                  </div>
                ))}
              </div>
              {list[0].suspicious > 0 && (
                <div className="admin-actions">
                  <button className="disagree" onClick={() => api.clearFlag(username).then(load, (e: Error) => setError(e.message))}>
                    Clear tag
                  </button>
                </div>
              )}
            </div>
          ))}
        </SketchBox>
      )}
    </div>
  );
}
