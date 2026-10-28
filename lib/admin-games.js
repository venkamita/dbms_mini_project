import { Int32 } from 'mongodb';
import { pool } from './mysql.js';
import { getDb } from './mongo.js';
import { ApiError, assert, id, textField } from './api.js';

export function validateGame(data) {
  const title = textField(data.title, 'Title', 150);
  assert(data.publisher === null || typeof data.publisher === 'string', 'Publisher must be a string or null');
  const publisher = data.publisher === null ? null : data.publisher.trim();
  assert(!publisher || publisher.length <= 100, 'Publisher must be at most 100 characters');
  const price = data.base_price;
  assert(typeof price === 'number' && Number.isFinite(price) && price >= 0 && price <= 999999.99 && Math.abs(price * 100 - Math.round(price * 100)) < 0.00001, 'Price must be between 0 and 999999.99 with at most 2 decimal places');
  const release = data.release_date;
  assert(release === null || (typeof release === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(release) && Number(release.slice(0, 4)) >= 1000 && !Number.isNaN(Date.parse(release)) && new Date(release).toISOString().slice(0, 10) === release), 'Release date must be a valid YYYY-MM-DD or null');
  for (const field of ['genre_ids', 'platform_ids']) {
    assert(Array.isArray(data[field]) && data[field].length <= 100, `${field} must be an array of up to 100 IDs`);
    data[field] = [...new Set(data[field].map(value => id(value, field)))];
  }
  const meta = data.metadata;
  assert(meta && typeof meta === 'object' && !Array.isArray(meta), 'Metadata is required');
  const description = textField(meta.description, 'Description', 30000, 10);
  for (const field of ['tags', 'screenshots']) assert(Array.isArray(meta[field]) && meta[field].length <= 100 && meta[field].every(value => typeof value === 'string' && value.length <= 1000), `${field} must be an array of strings`);
  assert(meta.system_requirements && typeof meta.system_requirements === 'object' && !Array.isArray(meta.system_requirements), 'System requirements must be a JSON object');
  assert(Array.isArray(meta.dlc) && meta.dlc.length <= 100, 'DLC must be an array');
  assert(meta.dlc.every(item => item && typeof item === 'object' && !Array.isArray(item) && typeof item.name === 'string' && item.name.trim().length > 0 && typeof item.price === 'number' && Number.isFinite(item.price) && item.price >= 0), 'Each DLC needs a name and a non-negative numeric price');
  assert(JSON.stringify(meta).length <= 100000, 'Metadata is too large');
  return { title, publisher, price, release, genreIds: data.genre_ids, platformIds: data.platform_ids, metadata: { description, tags: meta.tags, screenshots: meta.screenshots, system_requirements: meta.system_requirements, dlc: meta.dlc } };
}

// Hold the SQL transaction until MongoDB succeeds. A Mongo failure rolls back
// Game and its links together; a SQL commit failure compensates the Mongo write.
export async function saveGame(data, gameId = null) {
  const value = validateGame(data);
  const db = await getDb();
  const collection = db.collection('game_metadata');
  const connection = await pool.getConnection();
  let previousMetadata;
  let mongoWritten = false;
  let createdId;
  try {
    await connection.beginTransaction();
    if (gameId) {
      const [rows] = await connection.execute('SELECT game_id FROM Game WHERE game_id = ? FOR UPDATE', [gameId]);
      assert(rows.length, 'Game not found', 404);
      previousMetadata = await collection.findOne({ game_id: gameId });
      await connection.execute('UPDATE Game SET title = ?, publisher = ?, base_price = ?, release_date = ? WHERE game_id = ?', [value.title, value.publisher, value.price, value.release, gameId]);
      await connection.execute('DELETE FROM HasGenre WHERE game_id = ?', [gameId]);
      await connection.execute('DELETE FROM OnPlatform WHERE game_id = ?', [gameId]);
    } else {
      const [result] = await connection.execute('INSERT INTO Game (title, publisher, base_price, release_date) VALUES (?, ?, ?, ?)', [value.title, value.publisher, value.price, value.release]);
      createdId = result.insertId;
    }
    const savedId = gameId || createdId;
    for (const genreId of value.genreIds) await connection.execute('INSERT INTO HasGenre (game_id, genre_id) VALUES (?, ?)', [savedId, genreId]);
    for (const platformId of value.platformIds) await connection.execute('INSERT INTO OnPlatform (game_id, platform_id) VALUES (?, ?)', [savedId, platformId]);
    const document = { game_id: new Int32(savedId), ...value.metadata };
    try {
      if (gameId) await collection.replaceOne({ game_id: gameId }, document, { upsert: true });
      else await collection.insertOne(document);
      mongoWritten = true;
    } catch (error) {
      console.error('Game metadata write failed', { name: error.name, code: error.code });
      throw new ApiError(500, 'Internal error');
    }
    await connection.commit();
    return savedId;
  } catch (error) {
    if (mongoWritten) {
      try {
        if (previousMetadata) await collection.replaceOne({ game_id: gameId }, previousMetadata, { upsert: true });
        else await collection.deleteOne({ game_id: gameId || createdId });
      } catch (compensationError) { console.error('Metadata compensation failed', { name: compensationError.name, code: compensationError.code }); }
    }
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}
