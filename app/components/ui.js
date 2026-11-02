import Link from 'next/link';
import { money } from '@/lib/client';
import GameArtwork from './game-artwork';
export function Intro({ label, title, children }) { return <div className="page-intro"><div className="eyebrow">{label}</div><h1>{title}</h1><p className="muted">{children}</p></div>; }
export function ErrorMessage({ error }) { return error ? <p className="error" role="alert">{error}</p> : null; }
export function Loading() { return <p className="empty" role="status">Loading…</p>; }
export function GameCard({ game, children, eager = false }) { return <article className="card"><Link href={`/games/${game.game_id}`} aria-label={`View ${game.title}`}><GameArtwork src={game.cover_image} title={game.title} eager={eager}/></Link><h2><Link href={`/games/${game.game_id}`}>{game.title}</Link></h2><div className="muted text-sm">{game.publisher}</div><div className="row">{game.genres?.map(genre => <span className="badge" key={genre}>{genre}</span>)}</div>{children}<div className="card-footer"><strong>{money(game.base_price)}</strong><span>{Number(game.avg_rating) > 0 ? <>★ {Number(game.avg_rating).toFixed(2)} <span className="muted">/ 5</span></> : <span className="muted">Not rated</span>}</span></div></article>; }
