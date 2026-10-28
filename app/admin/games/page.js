'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, money } from '@/lib/client';
import { Intro, ErrorMessage, Loading } from '../../components/ui';

const emptyForm = () => ({ title: '', publisher: '', base_price: '0', release_date: '', genre_ids: [], platform_ids: [], description: '', tags: '', screenshots: '', system_requirements: '{}', dlc: '[]' });

export default function AdminGames() {
  const [games, setGames] = useState([]);
  const [genres, setGenres] = useState([]);
  const [platforms, setPlatforms] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const load = useCallback(async () => {
    const [g, ge, p] = await Promise.all([api('/api/games'), api('/api/genres'), api('/api/platforms')]);
    setGames(g); setGenres(ge); setPlatforms(p);
  }, []);
  useEffect(() => { let active = true; Promise.all([api('/api/games'), api('/api/genres'), api('/api/platforms')]).then(([g, ge, p]) => { if (active) { setGames(g); setGenres(ge); setPlatforms(p); } }).catch(err => { if (active) setError(err.message); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);
  function change(field, value) { setForm(current => ({ ...current, [field]: value })); }
  function toggle(field, value) { setForm(current => ({ ...current, [field]: current[field].includes(value) ? current[field].filter(id => id !== value) : [...current[field], value] })); }
  async function perform(action, message) {
    setBusy(true); setError(''); setNotice('');
    try { await action(); await load(); setNotice(message); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  async function edit(gameId) {
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await api(`/api/games/${gameId}`);
      const meta = result.metadata || {};
      setEditing(gameId);
      setForm({ title: result.game.title, publisher: result.game.publisher || '', base_price: result.game.base_price, release_date: result.game.release_date?.slice(0, 10) || '', genre_ids: result.genres.map(g => g.genre_id), platform_ids: result.platforms.map(p => p.platform_id), description: meta.description || '', tags: (meta.tags || []).join(', '), screenshots: (meta.screenshots || []).join('\n'), system_requirements: JSON.stringify(meta.system_requirements || {}, null, 2), dlc: JSON.stringify(meta.dlc || [], null, 2) });
      document.getElementById('game-form').scrollIntoView({ behavior: 'smooth' });
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  async function save(event) {
    event.preventDefault();
    let requirements, dlc;
    try {
      requirements = JSON.parse(form.system_requirements); dlc = JSON.parse(form.dlc);
      if (!requirements || typeof requirements !== 'object' || Array.isArray(requirements)) throw new Error();
      if (!Array.isArray(dlc)) throw new Error();
    } catch { setError('System requirements must be a JSON object and DLC must be a JSON array.'); return; }
    const payload = { title: form.title, publisher: form.publisher || null, base_price: Number(form.base_price), release_date: form.release_date || null, genre_ids: form.genre_ids, platform_ids: form.platform_ids, metadata: { description: form.description, tags: form.tags.split(',').map(tag => tag.trim()).filter(Boolean), screenshots: form.screenshots.split('\n').map(url => url.trim()).filter(Boolean), system_requirements: requirements, dlc } };
    await perform(async () => { await api(editing ? `/api/games/${editing}` : '/api/games', { method: editing ? 'PUT' : 'POST', body: JSON.stringify(payload) }); setEditing(null); setForm(emptyForm()); }, editing ? 'Game updated.' : 'Game created.');
  }
  return <><Intro label="Administration" title="Manage the collection">Create games, keep their details up to date, and organize the catalog.</Intro><ErrorMessage error={error}/>{notice && <p className="notice" role="status">{notice}</p>}{loading ? <Loading/> : <section className="panel table-wrap"><table><thead><tr><th>Game</th><th>Price</th><th>Status</th><th>Actions</th></tr></thead><tbody>{games.map(game => <tr key={game.game_id}><td><Link href={`/games/${game.game_id}`}>{game.title}</Link></td><td>{money(game.base_price)}</td><td><span className="badge">{game.is_active ? 'Active' : 'Inactive'}</span></td><td><div className="row"><button className="secondary" disabled={busy} onClick={() => edit(game.game_id)}>Edit</button><button className="danger" disabled={busy || !game.is_active} onClick={() => perform(() => api(`/api/games/${game.game_id}`, { method: 'DELETE' }), 'Game deactivated.')}>Deactivate</button></div></td></tr>)}</tbody></table>{!games.length && <p className="empty">No games yet. Add your first game below.</p>}</section>}<section className="panel" id="game-form"><h2>{editing ? `Edit game #${editing}` : 'Add a game'}</h2><form className="stack" onSubmit={save}><div className="form-grid"><label>Title<input required maxLength={150} value={form.title} onChange={e => change('title', e.target.value)}/></label><label>Publisher<input maxLength={100} value={form.publisher} onChange={e => change('publisher', e.target.value)}/></label><label>Price ($)<input required type="number" min="0" max="999999.99" step="0.01" value={form.base_price} onChange={e => change('base_price', e.target.value)}/></label><label>Release date<input type="date" value={form.release_date} onChange={e => change('release_date', e.target.value)}/></label></div><div className="form-grid"><fieldset><legend>Genres</legend><div className="row">{genres.map(genre => <label className="row" key={genre.genre_id}><input type="checkbox" checked={form.genre_ids.includes(genre.genre_id)} onChange={() => toggle('genre_ids', genre.genre_id)}/>{genre.name}</label>)}</div></fieldset><fieldset><legend>Platforms</legend><div className="row">{platforms.map(platform => <label className="row" key={platform.platform_id}><input type="checkbox" checked={form.platform_ids.includes(platform.platform_id)} onChange={() => toggle('platform_ids', platform.platform_id)}/>{platform.name}</label>)}</div></fieldset></div><label>Description<textarea required minLength={10} maxLength={30000} value={form.description} onChange={e => change('description', e.target.value)}/></label><label>Tags (comma-separated)<input value={form.tags} onChange={e => change('tags', e.target.value)} placeholder="pixel-art, relaxing"/></label><label>Screenshot URLs (one per line)<textarea value={form.screenshots} onChange={e => change('screenshots', e.target.value)}/></label><div className="form-grid"><label>System requirements (JSON object)<textarea className="font-mono" value={form.system_requirements} onChange={e => change('system_requirements', e.target.value)} required/></label><label>DLC (JSON array of name and price)<textarea className="font-mono" value={form.dlc} onChange={e => change('dlc', e.target.value)} placeholder={'[{"name":"Expansion","price":9.99}]'} required/></label></div><div className="row"><button disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Create game'}</button>{editing && <button className="secondary" type="button" disabled={busy} onClick={() => { setEditing(null); setForm(emptyForm()); }}>Cancel edit</button>}</div></form></section><div className="form-grid"><TaxonomyForm title="Add a genre" url="/api/genres" busy={busy} perform={perform}/><TaxonomyForm title="Add a platform" url="/api/platforms" busy={busy} perform={perform}/></div></>;
}
function TaxonomyForm({ title, url, busy, perform }) {
  const [name, setName] = useState('');
  return <section className="panel"><h2>{title}</h2><form className="stack" onSubmit={event => { event.preventDefault(); perform(async () => { await api(url, { method: 'POST', body: JSON.stringify({ name }) }); setName(''); }, 'Added successfully.'); }}><label>Name<input value={name} onChange={e => setName(e.target.value)} maxLength={50} required/></label><button disabled={busy}>Add</button></form></section>;
}
