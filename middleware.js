import { NextResponse } from 'next/server';
import { verifyToken } from './lib/token';
export async function middleware(request) {
  const user = await verifyToken(request.cookies.get('token')?.value);
  if (!user) return NextResponse.redirect(new URL('/login', request.url));
  if (request.nextUrl.pathname.startsWith('/admin') && user.role !== 'admin') return NextResponse.redirect(new URL('/catalog', request.url));
  return NextResponse.next();
}
export const config = { matcher: ['/wishlist/:path*', '/library/:path*', '/recommendations/:path*', '/admin/:path*'] };
