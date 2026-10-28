'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, money, date } from '@/lib/client';
import { Intro, ErrorMessage, Loading } from '../components/ui';
export default function Library() {
  const [games, setGames] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => { let active = true; api('/api/library').then(result => { if (active) setGames(result); }).catch(err => { if (active) setError(err.message); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);
  return <><Intro label="Ready when you are" title="Your library">Good games, all yours. Find your next adventure in the collection.</Intro><ErrorMessage error={error}/>{loading ? <Loading/> : <section className="panel table-wrap">{games.length ? <table><thead><tr><th>Game</th><th>Price paid</th><th>Purchased</th></tr></thead><tbody>{games.map(game => <tr key={game.game_id}><td><Link href={`/games/${game.game_id}`}>{game.title}</Link></td><td>{money(game.price_paid)}</td><td>{date(game.purchased_at)}</td></tr>)}</tbody></table> : <p className="empty">Your next adventure is waiting. <Link href="/catalog">Browse games</Link></p>}</section>}</>;
}
