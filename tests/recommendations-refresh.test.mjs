import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { NextResponse } from 'next/server.js';
import { route, ApiError } from '../lib/api.js';
const source = (await readFile(new URL('../app/api/recommendations/route.js', import.meta.url), 'utf8')).replace(/^import .*;\r?\n/gm, '');
const makeHandler = (dependencies) => new Function('NextResponse', 'route', 'requireUser', 'computeForUser', 'readRecommendations', 'attachGameMedia', source.replace('export const GET', 'const GET') + '\nreturn GET;')(NextResponse, route, ...dependencies);
test('every recommendations request recomputes before reading, including when stored results exist', async () => {
  const events=[]; let generation=0;
  const handler=makeHandler([
    async()=>({user_id:7}),
    async id=>{events.push(['compute',id]);generation++;},
    async id=>{events.push(['read',id]);return [{game_id:2,score:generation/10}];},
    async rows=>rows,
  ]);
  for(const expected of [.1,.2]){const response=await handler({});assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal((await response.json())[0].score,expected);}
  assert.deepEqual(events,[['compute',7],['read',7],['compute',7],['read',7]]);
});
test('failed authentication cannot trigger recommendation computation', async()=>{
  let computed=false;
  const handler=makeHandler([async()=>{throw new ApiError(401,'Please log in');},async()=>{computed=true;},async()=>[],async rows=>rows]);
  assert.equal((await handler({})).status,401);assert.equal(computed,false);
});
