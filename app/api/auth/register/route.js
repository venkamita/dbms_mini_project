import { NextResponse } from 'next/server';
import { pool } from '@/lib/mysql';
import { body, route, textField, assert } from '@/lib/api';
import { hashPassword, signToken, setAuthCookie } from '@/lib/auth';

export const POST = route(async request => {
  const data = await body(request);
  const username = textField(data.username, 'Username', 50);
  const email = textField(data.email, 'Email', 100).toLowerCase();
  assert(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 'Enter a valid email');
  assert(typeof data.password === 'string' && data.password.length >= 6 && new TextEncoder().encode(data.password).length <= 72, 'Password must be at least 6 characters and at most 72 bytes');
  const hash = await hashPassword(data.password);
  const [result] = await pool.execute("INSERT INTO User (username, email, password_hash, role) VALUES (?, ?, ?, 'player')", [username, email, hash]);
  const user = { user_id: result.insertId, username, email, role: 'player' };
  return setAuthCookie(NextResponse.json({ user }, { status: 201 }), await signToken(user));
});
