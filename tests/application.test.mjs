import test from 'node:test';
import assert from 'node:assert/strict';
import { SignJWT } from 'jose';
import { NextRequest, NextResponse } from 'next/server.js';
import { route, body, id, ApiError } from '../lib/api.js';
import { signToken, verifyToken } from '../lib/token.js';
import { hashPassword, verifyPassword, getUser, requireAdmin, setAuthCookie } from '../lib/auth.js';
import { validateGame, saveGame } from '../lib/admin-games.js';
import { computeForAll, readRecommendations } from '../lib/recommend.js';

process.env.JWT_SECRET = 'offline-test-secret-with-at-least-32-characters';
const player = { user_id: 1, username: 'u1_arjun', email: 'arjun@example.com', role: 'player' };
const validGame = () => ({ title: 'A test game', publisher: null, base_price: 14.99, release_date: '2024-02-29', genre_ids: [1, 2], platform_ids: [1], metadata: { description: 'A sufficiently long game description.', tags: ['pixel-art'], screenshots: [], system_requirements: { switch: { joycon_support: true } }, dlc: [{ name: 'Expansion', price: 0 }] } });

test('JWTs are HS256, expire after seven days, and reject forgery, expiry and bad claims', async () => {
  const token = await signToken(player);
  assert.deepEqual(await verifyToken(token), { user_id: 1, username: 'u1_arjun', role: 'player' });
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url'));
  assert.equal(payload.exp - payload.iat, 7 * 86400);
  assert.equal(await verifyToken(token + 'x'), null);
  const expired = await new SignJWT({ role: 'admin' }).setProtectedHeader({ alg: 'HS256' }).setSubject('1').setExpirationTime('0s').sign(new TextEncoder().encode(process.env.JWT_SECRET));
  assert.equal(await verifyToken(expired), null);
  const invalid = await signToken({ ...player, role: 'superuser' });
  assert.equal(await verifyToken(invalid), null);
});

test('bcrypt uses cost 10, verifies correctly, and cookies have security attributes', async () => {
  const hash = await hashPassword('password123');
  assert.match(hash, /^\$2[aby]\$10\$/);
  assert.equal(await verifyPassword('password123', hash), true);
  assert.equal(await verifyPassword('wrong', hash), false);
  const response = setAuthCookie(NextResponse.json({ ok: true }), 'example');
  const cookie = response.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly/i); assert.match(cookie, /SameSite=lax/i); assert.match(cookie, /Max-Age=604800/i);
});

test('API validation rejects malformed JSON, invalid IDs, dates and metadata', async () => {
  await assert.rejects(() => body(new Request('http://localhost', { method: 'POST', body: '{' })), error => error.status === 400);
  for (const value of [null, {}, [], true, 0, -1, 1.1, '1 OR 1=1', '']) assert.throws(() => id(value), ApiError);
  for (const override of [{ release_date: '2023-02-29' }, { base_price: -1 }, { base_price: 1.234 }, { publisher: 1 }, { genre_ids: ['bad'] }, { metadata: { ...validGame().metadata, system_requirements: [] } }]) assert.throws(() => validateGame({ ...validGame(), ...override }), ApiError);
  assert.equal(validateGame(validGame()).release, '2024-02-29');
});

test('API maps duplicate, constraint, SIGNAL, Mongo validation and unexpected errors', async () => {
  const cases = [[{ errno: 1062 }, 409], [{ errno: 3819 }, 400], [{ errno: 1452 }, 400], [{ sqlState: '45000', sqlMessage: 'Game does not exist' }, 400], [{ code: 121 }, 400], [new Error('private internal detail'), 500]];
  for (const [error, expected] of cases) {
    const response = await route(async () => { throw error; })();
    assert.equal(response.status, expected);
    const result = await response.json();
    assert.deepEqual(Object.keys(result), ['error']);
    if (expected === 500) assert.equal(result.error, 'Internal error');
    if (error.sqlState) assert.equal(result.error, 'Game does not exist');
  }
});

test('authentication refreshes roles from MySQL and rejects players at admin APIs', async () => {
  globalThis.gameMatchPool = { execute: async () => [[player]] };
  const token = await signToken(player);
  const request = new NextRequest('http://localhost/api/admin/analytics', { headers: { cookie: `token=${token}` } });
  assert.equal((await getUser(request)).role, 'player');
  await assert.rejects(() => requireAdmin(request), error => error.status === 403);
  globalThis.gameMatchPool = { execute: async () => [[]] };
  assert.equal(await getUser(request), null);
  await assert.rejects(() => requireAdmin(new NextRequest('http://localhost')), error => error.status === 401);
});

function gameHarness({ mongoFails = false, commitFails = false, update = false } = {}) {
  const events = [];
  const previous = { game_id: 4, description: 'Previous metadata', tags: [] };
  const collection = {
    findOne: async () => previous,
    insertOne: async document => { events.push(['mongo insert', document]); if (mongoFails) throw Object.assign(new Error('validation'), { code: 121 }); },
    replaceOne: async (filter, document) => { events.push(['mongo replace', document]); if (mongoFails) throw new Error('unavailable'); },
    deleteOne: async filter => events.push(['mongo delete', filter]),
  };
  const connection = {
    beginTransaction: async () => events.push(['begin']),
    execute: async (sql, params) => { events.push([sql, params]); return sql.startsWith('SELECT') ? [[{ game_id: 4 }]] : [{ insertId: 9 }]; },
    commit: async () => { events.push(['commit']); if (commitFails) throw new Error('commit failed'); },
    rollback: async () => events.push(['rollback']), release: () => events.push(['release']),
  };
  globalThis.gameMatchPool = { getConnection: async () => connection };
  globalThis.gameMatchMongo = Promise.resolve({ db: () => ({ collection: () => collection }) });
  return { events, previous, run: () => saveGame(validGame(), update ? 4 : null) };
}

test('admin game creation writes SQL links then BSON Int32 metadata before committing', async () => {
  const harness = gameHarness();
  assert.equal(await harness.run(), 9);
  const index = harness.events.findIndex(event => event[0] === 'mongo insert');
  assert.equal(harness.events[index][1].game_id._bsontype, 'Int32');
  assert.ok(harness.events.findIndex(event => event[0].startsWith('INSERT INTO OnPlatform')) < index);
  assert.ok(harness.events.findIndex(event => event[0] === 'commit') > index);
  assert.deepEqual(harness.events.at(-1), ['release']);
});

test('failed Mongo create or edit rolls back SQL and never commits', async () => {
  for (const update of [false, true]) {
    const harness = gameHarness({ mongoFails: true, update });
    await assert.rejects(harness.run, error => error.status === 500);
    assert.ok(harness.events.some(event => event[0] === 'rollback'));
    assert.ok(!harness.events.some(event => event[0] === 'commit'));
    assert.deepEqual(harness.events.at(-1), ['release']);
  }
});

test('SQL commit failure compensates created or replaced Mongo metadata', async () => {
  for (const update of [false, true]) {
    const harness = gameHarness({ commitFails: true, update });
    await assert.rejects(harness.run);
    if (update) assert.deepEqual(harness.events.filter(event => event[0] === 'mongo replace').at(-1)[1], harness.previous);
    else assert.deepEqual(harness.events.find(event => event[0] === 'mongo delete')[1], { game_id: 9 });
    assert.ok(harness.events.some(event => event[0] === 'rollback'));
  }
});

test('recommendation orchestration saves expected fixture scores and aggregates trending once for all users', async () => {
  const inserts = [];
  let aggregationCount = 0;
  let commitCount = 0;
  const connection = {
    beginTransaction: async () => {}, rollback: async () => {}, release: () => {}, commit: async () => { commitCount++; },
    execute: async (sql, params) => {
      if (sql.startsWith('SELECT user_id')) return [[{ user_id: params[0] }]];
      if (sql.startsWith('SELECT g.game_id')) return [[{ game_id: 2 }, { game_id: 4 }]];
      if (sql.includes('fn_content_score')) return [[{ game_id: 2, s: '0.5000' }, { game_id: 4, s: '0.0000' }]];
      if (sql.startsWith('CALL')) return [[[{ game_id: 2, collab_score: '1.0000' }], {}], []];
      if (sql.startsWith('INSERT')) inserts.push(params);
      return [{ affectedRows: 1 }];
    },
  };
  globalThis.gameMatchPool = { execute: async () => [[{ user_id: 1 }, { user_id: 2 }]], getConnection: async () => connection };
  globalThis.gameMatchMongo = Promise.resolve({ db: () => ({ collection: () => ({ aggregate: pipeline => {
    aggregationCount++;
    assert.ok(pipeline[0].$match.session_start.$gte instanceof Date);
    assert.deepEqual(pipeline[4].$project.trending_score, { $round: [{ $divide: ['$games.total_playtime', '$max_playtime'] }, 4] });
    return { toArray: async () => [{ game_id: 2, trending_score: .6 }, { game_id: 4, trending_score: .9 }] };
  } }) }) });
  assert.deepEqual(await computeForAll(), { users: 2, rows: 4 });
  assert.equal(aggregationCount, 1); assert.equal(commitCount, 2);
  assert.deepEqual(inserts.slice(0, 2), [[1, 2, .77, .5, 1, .6], [1, 4, .18, 0, 0, .9]]);
});

test('recommendation reads explain the largest weighted contribution and exclude rated or owned games', async () => {
  globalThis.gameMatchPool = { execute: async sql => {
    assert.match(sql, /g.is_active = TRUE/); assert.match(sql, /NOT EXISTS.*Rates/s); assert.match(sql, /NOT EXISTS.*Owns/s);
    return [[{ content_score: .5, collab_score: 1, trending_score: .6 }, { content_score: 0, collab_score: 0, trending_score: .9 }]];
  } };
  const rows = await readRecommendations(1);
  assert.equal(rows[0].reason, 'Players with similar taste rated this highly');
  assert.equal(rows[1].reason, 'Popular this week');
});
