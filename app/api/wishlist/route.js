import { NextResponse } from 'next/server';
import { pool } from '@/lib/mysql';
import { requireUser } from '@/lib/auth';
import { body, id, route } from '@/lib/api';
import { activeGame } from '@/lib/games';
export const GET = route(async request => {
  const user = await requireUser(request);
  const [rows] = await pool.execute('SELECT g.*, a.added_at FROM Adds a JOIN Game g ON g.game_id = a.game_id WHERE a.user_id = ? AND g.is_active = TRUE ORDER BY a.added_at DESC', [user.user_id]);
  return NextResponse.json(rows);
});
export const POST = route(async request => {
  const user = await requireUser(request);
  const gameId = id((await body(request)).game_id);
  await activeGame(gameId);
  await pool.execute('INSERT INTO Adds (user_id, game_id) VALUES (?, ?)', [user.user_id, gameId]);
  return NextResponse.json({ ok: true }, { status: 201 });
});
export const DELETE = route(async request => {
  const user = await requireUser(request);
  const gameId = id((await body(request)).game_id);
  await pool.execute('DELETE FROM Adds WHERE user_id = ? AND game_id = ?', [user.user_id, gameId]);
  return NextResponse.json({ ok: true });
});
