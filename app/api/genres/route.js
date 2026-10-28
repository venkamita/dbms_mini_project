import { NextResponse } from 'next/server';
import { pool } from '@/lib/mysql';
import { requireAdmin } from '@/lib/auth';
import { body, route, textField } from '@/lib/api';
export const GET = route(async () => {
  const [rows] = await pool.execute('SELECT * FROM Genre ORDER BY name');
  return NextResponse.json(rows);
});
export const POST = route(async request => {
  await requireAdmin(request);
  const name = textField((await body(request)).name, 'Name', 50);
  const [result] = await pool.execute('INSERT INTO Genre (name) VALUES (?)', [name]);
  return NextResponse.json({ genre_id: result.insertId, name }, { status: 201 });
});
