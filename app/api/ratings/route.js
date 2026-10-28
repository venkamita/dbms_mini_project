import { NextResponse } from 'next/server';
import { pool } from '@/lib/mysql';
import { requireUser } from '@/lib/auth';
import { body, id, assert, route } from '@/lib/api';
import { activeGame } from '@/lib/games';
function handler(method) {
  return route(async request => {
    const user = await requireUser(request);
    const data = await body(request);
    const gameId = id(data.game_id);
    await activeGame(gameId);
    if (method === 'DELETE') {
      const [result] = await pool.execute('DELETE FROM Rates WHERE user_id = ? AND game_id = ?', [user.user_id, gameId]);
      assert(result.affectedRows, 'Rating not found', 404);
    } else {
      assert(Number.isInteger(data.score) && data.score >= 1 && data.score <= 5, 'Score must be an integer from 1 to 5');
      assert(data.review_text == null || (typeof data.review_text === 'string' && data.review_text.length <= 10000), 'Review must be at most 10000 characters');
      if (method === 'POST') await pool.execute('INSERT INTO Rates (user_id, game_id, score, review_text) VALUES (?, ?, ?, ?)', [user.user_id, gameId, data.score, data.review_text || null]);
      else {
        const [result] = await pool.execute('UPDATE Rates SET score = ?, review_text = ?, rated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND game_id = ?', [data.score, data.review_text || null, user.user_id, gameId]);
        assert(result.affectedRows, 'Rating not found', 404);
      }
    }
    return NextResponse.json({ ok: true }, { status: method === 'POST' ? 201 : 200 });
  });
}
export const POST = handler('POST');
export const PUT = handler('PUT');
export const DELETE = handler('DELETE');
