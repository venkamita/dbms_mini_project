'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { Intro, GameCard, ErrorMessage, Loading } from '../components/ui';
export default function Catalog() {
  const [games, setGames] = useState([]);
  const [genres, setGenres] = useState([]);
  const [platforms, setPlatforms] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  async function load(params = '') {
    setLoading(true); setError('');
    try { setGames(await api('/api/games?' + params)); } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    let active = true;
    Promise.all([api('/api/games'), api('/api/genres'), api('/api/platforms')]).then(([g, ge, p]) => { if (active) { setGames(g); setGenres(ge); setPlatforms(p); } }).catch(err => { if (active) setError(err.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  return <><Intro label="The collection" title="Find your next favorite.">Explore the catalog, follow your curiosity, and find something worth playing.</Intro><form className="panel filters" onSubmit={event => { event.preventDefault(); load(new URLSearchParams(new FormData(event.currentTarget))); }}><label>Search games<input name="q" placeholder="Try pixel-art or fantasy" maxLength={200}/></label><label>Genre<select name="genre"><option value="">All genres</option>{genres.map(g => <option key={g.genre_id} value={g.genre_id}>{g.name}</option>)}</select></label><label>Platform<select name="platform"><option value="">All platforms</option>{platforms.map(p => <option key={p.platform_id} value={p.platform_id}>{p.name}</option>)}</select></label><label>Max price ($)<input name="maxPrice" type="number" min="0" step="0.01" placeholder="Any price"/></label><button disabled={loading}>Search</button></form><ErrorMessage error={error}/>{loading ? <Loading/> : !error && <><p className="muted text-sm mb-4">{games.length} games to explore · Highest rated first</p><div className="grid">{games.map(game => <GameCard key={game.game_id} game={game}/>)}</div>{!games.length && <p className="panel empty">No games match your filters. Try a different search.</p>}</>}</>;
}
