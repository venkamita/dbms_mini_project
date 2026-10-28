import { NextResponse } from 'next/server';
import { pool } from '@/lib/mysql';
import { body, route, textField, assert, ApiError } from '@/lib/api';
import { verifyPassword, signToken, setAuthCookie } from '@/lib/auth';

export const POST = route(async request => {
  const data = await body(request);
  const username = textField(data.username, 'Username', 50);
  assert(typeof data.password === 'string' && data.password.length > 0 && new TextEncoder().encode(data.password).length <= 72, 'Enter a valid password');
  const [users] = await pool.execute('SELECT user_id, username, email, role, password_hash FROM User WHERE username = ?', [username]);
  const found = users[0];
  if (!found || !await verifyPassword(data.password, found.password_hash)) throw new ApiError(401, 'Invalid username or password');
  const { user_id, email, role } = found;
  const user = { user_id, username: found.username, email, role };
  return setAuthCookie(NextResponse.json({ user }), await signToken(user));
});
