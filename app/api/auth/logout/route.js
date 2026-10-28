import { NextResponse } from 'next/server';
import { route } from '@/lib/api';
import { requireUser } from '@/lib/auth';
export const POST = route(async request => {
  await requireUser(request);
  const response = NextResponse.json({ ok: true });
  response.cookies.set('token', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 });
  return response;
});
