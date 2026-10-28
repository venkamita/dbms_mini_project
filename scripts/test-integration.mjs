// Run only against a disposable, freshly seeded GameMatch database.
// This script creates then cleans up a temporary player; it also recomputes
// Recommends for seed players. It never reloads or drops either database.
import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
import mysql from 'mysql2/promise';
import { MongoClient, Int32 } from 'mongodb';

if (!process.argv.includes('--confirm-demo-db')) {
  console.error('This suite changes demo data. Use a fresh disposable seed database, then run npm run test:integration -- --confirm-demo-db');
  process.exit(1);
}
for (const name of ['MYSQL_URL', 'MONGODB_URI']) if (!process.env[name]) throw new Error(`Missing environment variable: ${name}`);
const origin = process.env.TEST_BASE_URL || 'http://localhost:3000';
const sql = await mysql.createConnection(process.env.MYSQL_URL);
const mongo = new MongoClient(process.env.MONGODB_URI);
const results = [];
let temporaryUserId;

async function request(path, { method = 'GET', cookie, data } = {}) {
  const response = await fetch(origin + path, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, ...(data ? { body: JSON.stringify(data) } : {}), redirect: 'manual' });
  const payload = (response.headers.get('content-type') || '').includes('application/json') ? await response.json() : null;
  return { status: response.status, payload, cookie: response.headers.get('set-cookie')?.split(';')[0], location: response.headers.get('location') };
}
async function check(name, action) {
  try { await action(); results.push({ test: name, result: 'PASS' }); console.log(`${name}: PASS`); }
  catch (error) { results.push({ test: name, result: 'FAIL', detail: error.message }); console.error(`${name}: FAIL: ${error.message}`); }
}
try {
  const [seed] = await sql.execute('SELECT game_id, title FROM Game ORDER BY game_id');
  assert.deepEqual(seed.map(row => [row.game_id, row.title]), [[1, 'Elden Ring'], [2, 'Stardew Valley'], [3, 'Hades'], [4, 'Celeste']], 'Use fresh seed data for the integration suite');
  const admin = await request('/api/auth/login', { method: 'POST', data: { username: 'admin', password: 'password123' } });
  assert.equal(admin.status, 200, 'Run npm run seed:passwords first');
  await check('T9', async () => {
    const recompute = await request('/api/recommendations/recompute', { method: 'POST', cookie: admin.cookie });
    assert.equal(recompute.status, 200);
    const player = await request('/api/auth/login', { method: 'POST', data: { username: 'u1_arjun', password: 'password123' } });
    assert.equal(player.status, 200);
    const response = await request('/api/recommendations', { cookie: player.cookie });
    assert.equal(response.status, 200);
    assert.deepEqual(response.payload.map(row => [row.game_id, Number(row.content_score), Number(row.collab_score), Number(row.trending_score), Number(row.score)]), [[2, .5, 1, .6, .77], [4, 0, 0, .9, .18]]);
  });
  const suffix = Date.now().toString(36);
  const registered = await request('/api/auth/register', { method: 'POST', data: { username: `test_${suffix}`, email: `test_${suffix}@example.com`, password: 'test-password-123' } });
  assert.equal(registered.status, 201);
  temporaryUserId = registered.payload.user.user_id;
  const cookie = registered.cookie;
  await check('T1', async () => { assert.equal((await request('/api/ratings', { method: 'POST', cookie, data: { game_id: 1, score: 7 } })).status, 400); });
  await check('T3', async () => {
    const before = await request('/api/games/1');
    assert.equal(before.status, 200);
    assert.equal((await request('/api/ratings', { method: 'POST', cookie, data: { game_id: 1, score: 1, review_text: 'Integration test; removed during cleanup.' } })).status, 201);
    const after = await request('/api/games/1');
    assert.equal(after.status, 200);
    assert.notEqual(Number(after.payload.game.avg_rating), Number(before.payload.game.avg_rating));
    assert.equal(Number(after.payload.game.avg_rating), 3.75);
  });
  await check('T2', async () => { assert.equal((await request('/api/ratings', { method: 'POST', cookie, data: { game_id: 1, score: 3 } })).status, 409); });
  await check('T4', async () => {
    assert.equal((await request('/api/wishlist', { method: 'POST', cookie, data: { game_id: 2 } })).status, 201);
    assert.equal((await request('/api/purchase', { method: 'POST', cookie, data: { game_id: 2 } })).status, 201);
    const library = await request('/api/library', { cookie });
    const wishlist = await request('/api/wishlist', { cookie });
    assert.ok(library.payload.some(row => row.game_id === 2));
    assert.ok(!wishlist.payload.some(row => row.game_id === 2));
  });
  await check('T5', async () => {
    const before = await request('/api/library', { cookie });
    const response = await request('/api/purchase', { method: 'POST', cookie, data: { game_id: 2 } });
    assert.equal(response.status, 409); assert.equal(response.payload.error, 'You already own this game');
    assert.deepEqual((await request('/api/library', { cookie })).payload, before.payload);
  });
  await check('T6', async () => {
    const response = await request('/api/purchase', { method: 'POST', cookie, data: { game_id: 9999 } });
    assert.equal(response.status, 400); assert.equal(response.payload.error, 'Game does not exist');
  });
  await check('T7', async () => {
    await mongo.connect();
    await assert.rejects(() => mongo.db().collection('activity_log').insertOne({ user_id: new Int32(temporaryUserId), game_id: new Int32(1), session_start: new Date(), playtime_minutes: new Int32(-5), device: 'PC' }), error => error.code === 121);
  });
  await check('T8', async () => { assert.equal((await request('/api/admin/analytics', { cookie })).status, 403); });
  await check('T10', async () => {
    const response = await request('/api/games?q=pixel-art');
    assert.equal(response.status, 200);
    assert.deepEqual(response.payload.map(row => row.title).sort(), ['Celeste', 'Stardew Valley']);
  });
  await check('T11', async () => {
    const response = await request('/library');
    assert.ok([302, 303, 307, 308].includes(response.status));
    assert.equal(new URL(response.location, origin).pathname, '/login');
  });
} finally {
  if (temporaryUserId) {
    // Explicit DELETE fires the ratings trigger; FK cascade alone does not.
    await sql.execute('DELETE FROM Rates WHERE user_id = ?', [temporaryUserId]);
    await sql.execute('DELETE FROM User WHERE user_id = ?', [temporaryUserId]);
  }
  await sql.end(); await mongo.close();
  await mkdir('output', { recursive: true });
  await writeFile('output/integration-results.json', JSON.stringify({ timestamp: new Date().toISOString(), results }, null, 2));
}
if (results.length !== 11 || results.some(row => row.result !== 'PASS')) process.exitCode = 1;
