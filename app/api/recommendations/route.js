import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { route } from '@/lib/api';
import { computeForUser, readRecommendations } from '@/lib/recommend';
export const GET = route(async request => {
  const user = await requireUser(request);
  let rows = await readRecommendations(user.user_id);
  if (!rows.length) { await computeForUser(user.user_id); rows = await readRecommendations(user.user_id); }
  return NextResponse.json(rows);
});
