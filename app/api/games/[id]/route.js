import { NextResponse } from 'next/server';
import { pool } from '@/lib/mysql';
import { getDb } from '@/lib/mongo';
import { getUser } from '@/lib/auth';
import { id, route, assert } from '@/lib/api';
import { gameGenres, gamePlatforms } from '@/lib/games';

export const GET = route(async (request, context) => {
  const gameId = id((await context.params).id);
  const user = await getUser(request);
  const [games] = await pool.execute('SELECT * FROM Game WHERE game_id = ? AND (? = TRUE OR is_active = TRUE)', [gameId, user?.role === 'admin']);
  assert(games.length, 'Game not found', 404);
  const db = await getDb();
  const [genres, platforms, metadata, [reviews]] = await Promise.all([
    gameGenres(gameId), gamePlatforms(gameId), db.collection('game_metadata').findOne({ game_id: gameId }, { projection: { _id: 0 } }),
    pool.execute('SELECT u.username, r.score, r.review_text, r.rated_at FROM Rates r JOIN User u ON u.user_id = r.user_id WHERE r.game_id = ? ORDER BY r.rated_at DESC', [gameId]),
  ]);
  const result = { game: games[0], genres, platforms, metadata, reviews };
  if (user) {
    const [[ratings], [owns], [wishes]] = await Promise.all([
      pool.execute('SELECT score, review_text FROM Rates WHERE user_id = ? AND game_id = ?', [user.user_id, gameId]),
      pool.execute('SELECT game_id FROM Owns WHERE user_id = ? AND game_id = ?', [user.user_id, gameId]),
      pool.execute('SELECT game_id FROM Adds WHERE user_id = ? AND game_id = ?', [user.user_id, gameId]),
    ]);
    Object.assign(result, { myRating: ratings[0] || null, owned: owns.length > 0, wishlisted: wishes.length > 0 });
  }
  return NextResponse.json(result);
});
