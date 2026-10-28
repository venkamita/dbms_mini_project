import { NextResponse } from 'next/server';
import { pool } from '@/lib/mysql';
import { requireAdmin } from '@/lib/auth';
import { route } from '@/lib/api';
import { getTrending } from '@/lib/recommend';
export const GET = route(async request => {
  await requireAdmin(request);
  const [[topRatedByGenre], trending, [mostActiveUsers], [titles]] = await Promise.all([
    pool.execute('SELECT v.* FROM vw_top_rated_by_genre v JOIN Game g ON g.game_id = v.game_id WHERE g.is_active = TRUE ORDER BY v.genre, v.avg_rating DESC'),
    getTrending(),
    pool.execute('SELECT u.user_id, u.username, COUNT(r.game_id) AS ratings_count FROM User u JOIN Rates r ON r.user_id = u.user_id GROUP BY u.user_id, u.username ORDER BY ratings_count DESC, u.user_id LIMIT 5'),
    pool.execute('SELECT game_id, title FROM Game WHERE is_active = TRUE'),
  ]);
  const names = new Map(titles.map(row => [row.game_id, row.title]));
  return NextResponse.json({ topRatedByGenre, trending: trending.filter(row => names.has(Number(row.game_id))).map(row => ({ ...row, title: names.get(Number(row.game_id)) })), mostActiveUsers });
});
