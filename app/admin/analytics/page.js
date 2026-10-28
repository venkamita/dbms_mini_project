'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { Intro, ErrorMessage, Loading } from '../../components/ui';
export default function Analytics() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  useEffect(() => { let active = true; api('/api/admin/analytics').then(result => { if (active) setData(result); }).catch(err => { if (active) setError(err.message); }); return () => { active = false; }; }, []);
  async function recompute() {
    setBusy(true); setError(''); setResult(null);
    try { setResult(await api('/api/recommendations/recompute', { method: 'POST' })); setData(await api('/api/admin/analytics')); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <><Intro label="Administration" title="A pulse on the players">See what’s getting played, what’s loved, and who’s sharing their opinion.</Intro><section className="panel row justify-between"><div><h2>Refresh recommendations</h2><p className="muted text-sm">Rebuild every player’s matches from the latest ratings and weekly activity.</p></div><button disabled={busy} onClick={recompute}>{busy ? 'Recomputing…' : 'Recompute recommendations'}</button></section>{result && <p role="status" className="notice">Recomputed {result.rows} recommendations for {result.users} players.</p>}<ErrorMessage error={error}/>{!data ? !error && <Loading/> : <><section className="panel table-wrap"><h2>Trending this week</h2><p className="muted text-sm">Play sessions in the past 7 days, normalized by the most-played game.</p><table><thead><tr><th>Game</th><th>Playtime (min)</th><th>Sessions</th><th>Unique players</th><th>Score</th></tr></thead><tbody>{data.trending.map(row => <tr key={row.game_id}><td>{row.title}</td><td>{row.total_playtime}</td><td>{row.sessions}</td><td>{row.unique_players}</td><td>{Number(row.trending_score).toFixed(4)}</td></tr>)}</tbody></table>{!data.trending.length && <p className="empty">No play activity in the last 7 days.</p>}</section><div className="columns"><section className="panel table-wrap"><h2>Top rated by genre</h2><table><thead><tr><th>Genre</th><th>Game</th><th>Rating</th></tr></thead><tbody>{data.topRatedByGenre.map(row => <tr key={`${row.genre}-${row.game_id}`}><td>{row.genre}</td><td>{row.title}</td><td>★ {Number(row.avg_rating).toFixed(2)}</td></tr>)}</tbody></table></section><section className="panel table-wrap"><h2>Most active reviewers</h2><table><thead><tr><th>Player</th><th>Ratings</th></tr></thead><tbody>{data.mostActiveUsers.map(row => <tr key={row.user_id}><td>{row.username}</td><td>{row.ratings_count}</td></tr>)}</tbody></table></section></div></>}</>;
}
