import bcrypt from 'bcryptjs';
import { pool } from './mysql.js';
import { ApiError } from './api.js';
import { verifyToken } from './token.js';
export { signToken, verifyToken } from './token.js';

export const hashPassword = password => bcrypt.hash(password, 10);
export const verifyPassword = (password, hash) => bcrypt.compare(password, hash);
export async function getUser(request) {
  const claims = await verifyToken(request.cookies.get('token')?.value);
  if (!claims) return null;
  const [users] = await pool.execute('SELECT user_id, username, email, role FROM User WHERE user_id = ?', [claims.user_id]);
  return users[0] || null;
}
export async function requireUser(request) {
  const user = await getUser(request);
  if (!user) throw new ApiError(401, 'Please log in');
  return user;
}
export async function requireAdmin(request) {
  const user = await requireUser(request);
  if (user.role !== 'admin') throw new ApiError(403, 'Admin access required');
  return user;
}
export function setAuthCookie(response, token) {
  response.cookies.set('token', token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 7 * 24 * 60 * 60 });
  return response;
}
