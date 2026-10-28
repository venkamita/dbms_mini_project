'use client';
import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, money, date } from '@/lib/client';
import { useSession } from '../../components/session';
import { Intro, ErrorMessage, Loading } from '../../components/ui';
export default function GameDetail({ params }) {
  const { id } = use(params);
  const { user } = useSession();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const load = useCallback(async () => { const result = await api(`/api/games/${id}`); setData(result); }, [id]);
  useEffect(() => { let active = true; api(`/api/games/${id}`).then(result => { if (active) setData(result); }).catch(err => { if (active) setError(err.message); }); return () => { active = false; }; }, [id, user?.user_id]);
  async function action(url, method, payload, message) {
    setBusy(true); setError(''); setNotice('');
    try { await api(url, { method, body: JSON.stringify(payload) }); await load(); setNotice(message); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  if (!data) return <><ErrorMessage error={error}/>{!error && <Loading/>}</>;
  const { game, genres, platforms, metadata, reviews } = data;
  return <><Link href="/catalog">← Back to catalog</Link><Intro label={genres.map(g => g.name).join(' / ')} title={game.title}>{game.publisher} · Released {date(game.release_date)}</Intro><ErrorMessage error={error}/>{notice && <p role="status" className="notice">{notice}</p>}<div className="columns"><div><section className="panel"><h2>About the game</h2><p>{metadata?.description || 'No description available.'}</p><div className="row">{metadata?.tags?.map(tag => <span className="badge" key={tag}>{tag}</span>)}</div></section><section className="panel"><h2>System requirements</h2>{metadata?.system_requirements && Object.keys(metadata.system_requirements).length ? <pre>{JSON.stringify(metadata.system_requirements, null, 2)}</pre> : <p className="muted">No requirements specified.</p>}</section><section className="panel"><h2>Downloadable content</h2>{metadata?.dlc?.length ? metadata.dlc.map((item, index) => <p key={index}>{typeof item === 'string' ? item : <>{item.name || 'DLC'} · {money(item.price)}</>}</p>) : <p className="muted">No DLC listed.</p>}</section><section className="panel"><h2>Player reviews <span className="muted">({reviews.length})</span></h2>{reviews.length ? reviews.map((review, index) => <article key={index} className="review"><div className="row"><strong>{review.username}</strong><span>★ {review.score}/5</span><span className="muted text-sm">{date(review.rated_at)}</span></div><p>{review.review_text || 'No written review.'}</p></article>) : <p className="muted">Be the first to leave a review.</p>}</section></div><aside><section className="panel stack"><div className="eyebrow">Make time to play</div><h2 className="text-3xl">{money(game.base_price)}</h2><p>★ {Number(game.avg_rating).toFixed(2)} / 5 average rating</p><div className="row">{platforms.map(p => <span className="badge" key={p.platform_id}>{p.name}</span>)}</div>{!game.is_active && <p className="notice">This game is inactive.</p>}{user ? <><button disabled={busy || data.owned || !game.is_active} onClick={() => action('/api/purchase', 'POST', { game_id: game.game_id }, 'Added to your library.')}>{data.owned ? 'Owned' : 'Buy game'}</button><button className="secondary" disabled={busy || !game.is_active} onClick={() => action('/api/wishlist', data.wishlisted ? 'DELETE' : 'POST', { game_id: game.game_id }, data.wishlisted ? 'Removed from wishlist.' : 'Added to wishlist.')}>{data.wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}</button></> : <Link className="button" href="/login">Log in to buy or rate</Link>}</section>{user && <RatingForm key={`${game.game_id}-${JSON.stringify(data.myRating)}`} rating={data.myRating} busy={busy} active={Boolean(game.is_active)} onSave={(method, values) => action('/api/ratings', method, { game_id: game.game_id, ...values }, method === 'DELETE' ? 'Rating removed.' : 'Rating saved.')}/>}</aside></div></>;
}
function RatingForm() { return null; }
