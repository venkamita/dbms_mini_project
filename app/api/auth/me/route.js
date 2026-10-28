import { NextResponse } from 'next/server';
import { route } from '@/lib/api';
import { getUser } from '@/lib/auth';
export const GET = route(async request => NextResponse.json({ user: await getUser(request) }));
