import { SignJWT, jwtVerify } from 'jose';
import { env } from './env.js';

const key = () => new TextEncoder().encode(env('JWT_SECRET'));
export async function signToken(user) {
  return new SignJWT({ username: user.username, role: user.role }).setProtectedHeader({ alg: 'HS256' }).setSubject(String(user.user_id)).setIssuedAt().setExpirationTime('7d').sign(key());
}
export async function verifyToken(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ['HS256'] });
    const user_id = Number(payload.sub);
    if (!Number.isSafeInteger(user_id) || user_id <= 0 || !['player', 'admin'].includes(payload.role)) return null;
    return { user_id, username: payload.username, role: payload.role };
  } catch { return null; }
}
