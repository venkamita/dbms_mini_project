import { NextResponse } from 'next/server';
import { pool } from '@/lib/mysql';
import { requireUser } from '@/lib/auth';
import { body, id, route, ApiError } from '@/lib/api';
import { activeGame } from '@/lib/games';
export const POST = route(async request => {
  const user = await requireUser(request);
  const gameId = id((await body(request)).game_id);
  await activeGame(gameId);
  try { await pool.execute('CALL sp_purchase_game(?, ?)', [user.user_id, gameId]); }
  catch (error) { if (error.errno === 1062) throw new ApiError(409, 'You already own this game'); throw error; }
  return NextResponse.json({ ok: true }, { status: 201 });
});
