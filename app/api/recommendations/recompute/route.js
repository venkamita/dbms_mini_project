import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { route } from '@/lib/api';
import { computeForAll } from '@/lib/recommend';
export const POST = route(async request => {
  await requireAdmin(request);
  return NextResponse.json(await computeForAll());
});
