import Link from 'next/link';
import { money } from '@/lib/client';
export function Intro({ label, title, children }) { return <div className="page-intro"><div className="eyebrow">{label}</div><h1>{title}</h1><p className="muted">{children}</p></div>; }
export function ErrorMessage({ error }) { return error ? <p className="error" role="alert">{error}</p> : null; }
export function Loading() { return <p className="empty" role="status">Loading…</p>; }
export function GameCard({ game, children }) { return <article className="card"><div aria-hidden="true" className="game-mark">{game.title.split(' ').map(word => word[0]).slice(0, 2).join('')}</div><h2><Link href={`/games/${game.game_id}`}>{game.title}</Link></h2><div className="muted text-sm">{game.publisher}</div><div className="row">{game.genres?.map(genre => <span className="badge" key={genre}>{genre}</span>)}</div>{children}<div className="card-footer"><strong>{money(game.base_price)}</strong><span>★ {Number(game.avg_rating).toFixed(2)} <span className="muted">/ 5</span></span></div></article>; }
