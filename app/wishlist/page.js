'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, money } from '@/lib/client';
import { Intro, ErrorMessage, Loading } from '../components/ui';
export default function Wishlist() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  useEffect(() => { let active = true; api('/api/wishlist').then(result => { if (active) setGames(result); }).catch(err => { if (active) setError(err.message); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);
  async function act(gameId, purchase) {
    setBusy(true); setError(''); setNotice('');
    try { await api(purchase ? '/api/purchase' : '/api/wishlist', { method: purchase ? 'POST' : 'DELETE', body: JSON.stringify({ game_id: gameId }) }); setGames(await api('/api/wishlist')); if (purchase) setNotice('Game added to your library.'); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <><Intro label="Saved for later" title="Your wishlist">Keep the games you’re curious about in one place.</Intro><ErrorMessage error={error}/>{notice && <p className="notice" role="status">{notice} <Link href="/library">Open library →</Link></p>}{loading ? <Loading/> : <section className="panel table-wrap">{games.length ? <table><thead><tr><th>Game</th><th>Price</th><th>Rating</th><th>Actions</th></tr></thead><tbody>{games.map(game => <tr key={game.game_id}><td><Link href={`/games/${game.game_id}`}>{game.title}</Link></td><td>{money(game.base_price)}</td><td>★ {Number(game.avg_rating).toFixed(2)}</td><td><div className="row"><button disabled={busy} onClick={() => act(game.game_id, true)}>Buy</button><button className="secondary" disabled={busy} onClick={() => act(game.game_id, false)}>Remove</button></div></td></tr>)}</tbody></table> : <p className="empty">Your wishlist is empty. <Link href="/catalog">Explore the catalog</Link></p>}</section>}</>;
}
