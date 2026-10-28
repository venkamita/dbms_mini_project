import { NextResponse } from 'next/server';
import { pool } from '@/lib/mysql';
import { requireUser } from '@/lib/auth';
import { route } from '@/lib/api';
export const GET = route(async request => {
  const user = await requireUser(request);
  const [rows] = await pool.execute('SELECT l.* FROM vw_user_library l JOIN Game g ON g.game_id = l.game_id WHERE l.user_id = ? AND g.is_active = TRUE ORDER BY l.purchased_at DESC', [user.user_id]);
  return NextResponse.json(rows);
});
