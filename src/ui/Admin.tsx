// Admin page (admin accounts only): review players' "Disagree?" reports and the cheat detector's tags.

import { useEffect, useState } from 'react';
import { api, type AdminFlag, type AdminReport } from '../net/api';
import { useAccount } from './account';
import { Choice, SketchBox, SketchButton } from './sketch';

export function AdminPage({ onExit }: { onExit: () => void }) {
  const { user } = useAccount();
  const [tab, setTab] = useState<'reports' | 'flags'>('reports');
  const [reports, setReports] = useState<AdminReport[] | null>(null);
  const [flags, setFlags] = useState<AdminFlag[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    api.adminReports().then(setReports).catch((e: Error) => setError(e.message));
    api.adminFlags().then(setFlags).catch((e: Error) => setError(e.message));
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
      <Choice<'reports' | 'flags'>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'reports', label: `Word reports${reports ? ` (${reports.length})` : ''}` },
          { value: 'flags', label: `Flagged players${flags ? ` (${players.size})` : ''}` },
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

      {tab === 'flags' && (
        <SketchBox className="panel">
          <h2>Flagged players</h2>
          <p className="muted hint">
            The cheat detector tags play that looks beyond human. Tagged players keep playing, show an “under review” tag, and are hidden from the
            leaderboard. Clear the tag if it was a false alarm.
          </p>
          {players.size === 0 && <p>Nobody is flagged.</p>}
          {[...players.entries()].map(([username, list]) => (
            <div key={username} className="admin-row">
              <div>
                <b>{username}</b> <small className="muted">· {Math.round(list[0].rating)} · {list[0].suspicious} tag(s)</small>
                {list.slice(0, 3).map((f) => (
                  <div key={f.created_at}>
                    <small className="muted">
                      {new Date(f.created_at).toLocaleString()} ({f.source}): {(JSON.parse(f.reasons) as string[]).join('; ')}
                    </small>
                  </div>
                ))}
              </div>
              <div className="admin-actions">
                <button className="disagree" onClick={() => api.clearFlag(username).then(load, (e: Error) => setError(e.message))}>
                  Clear tag
                </button>
              </div>
            </div>
          ))}
        </SketchBox>
      )}
    </div>
  );
}
