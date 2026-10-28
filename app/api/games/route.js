import { NextResponse } from 'next/server';
import { pool } from '@/lib/mysql';
import { getDb } from '@/lib/mongo';
import { getUser, requireAdmin } from '@/lib/auth';
import { assert, id, route, body } from '@/lib/api';
import { saveGame } from '@/lib/admin-games';

export const GET = route(async request => {
  const user = await getUser(request);
  const query = request.nextUrl.searchParams;
  const genre = query.get('genre') ? id(query.get('genre'), 'genre') : null;
  const platform = query.get('platform') ? id(query.get('platform'), 'platform') : null;
  const maxPrice = query.get('maxPrice') ? Number(query.get('maxPrice')) : null;
  assert(maxPrice === null || (Number.isFinite(maxPrice) && maxPrice >= 0), 'Invalid maxPrice');
  const q = (query.get('q') || '').trim();
  assert(q.length <= 200, 'Search must be at most 200 characters');
  let matches = null;
  if (q) {
    const db = await getDb();
    matches = await db.collection('game_metadata').find({ $text: { $search: q } }, { projection: { _id: 0, game_id: 1, score: { $meta: 'textScore' } } }).sort({ score: { $meta: 'textScore' } }).toArray();
    if (!matches.length) return NextResponse.json([]);
  }
  const [rows] = await pool.execute(`SELECT g.* FROM Game g
    WHERE (? = TRUE OR g.is_active = TRUE)
      AND (? IS NULL OR g.base_price <= ?)
      AND (? IS NULL OR EXISTS (SELECT 1 FROM HasGenre hg WHERE hg.game_id = g.game_id AND hg.genre_id = ?))
      AND (? IS NULL OR EXISTS (SELECT 1 FROM OnPlatform op WHERE op.game_id = g.game_id AND op.platform_id = ?))
      AND (? IS NULL OR g.game_id IN (SELECT ids.game_id FROM JSON_TABLE(?, '$[*]' COLUMNS(game_id INT PATH '$')) ids))
    ORDER BY g.avg_rating DESC, g.title`, [user?.role === 'admin', maxPrice, maxPrice, genre, genre, platform, platform, matches ? 1 : null, JSON.stringify(matches?.map(match => Number(match.game_id)) || [])]);
  const [genres] = await pool.execute('SELECT hg.game_id, ge.name FROM HasGenre hg JOIN Genre ge ON ge.genre_id = hg.genre_id ORDER BY ge.name');
  const result = rows.map(game => ({ ...game, genres: genres.filter(genre => genre.game_id === game.game_id).map(genre => genre.name) }));
  if (matches) {
    const order = new Map(matches.map((match, index) => [Number(match.game_id), index]));
    result.sort((a, b) => order.get(a.game_id) - order.get(b.game_id));
  }
  return NextResponse.json(result);
});
export const POST = route(async request => {
  await requireAdmin(request);
  const game_id = await saveGame(await body(request));
  return NextResponse.json({ game_id }, { status: 201 });
});
