import { pool } from './mysql.js';
import { assert } from './api.js';
export async function activeGame(gameId, executor = pool) {
  const [rows] = await executor.execute('SELECT game_id FROM Game WHERE game_id = ? AND is_active = TRUE', [gameId]);
  assert(rows.length, 'Game does not exist', 400);
}
export async function gameGenres(gameId, executor = pool) {
  const [rows] = await executor.execute('SELECT ge.genre_id, ge.name FROM Genre ge JOIN HasGenre hg ON hg.genre_id = ge.genre_id WHERE hg.game_id = ? ORDER BY ge.name', [gameId]);
  return rows;
}
export async function gamePlatforms(gameId, executor = pool) {
  const [rows] = await executor.execute('SELECT p.platform_id, p.name FROM Platform p JOIN OnPlatform op ON op.platform_id = p.platform_id WHERE op.game_id = ? ORDER BY p.name', [gameId]);
  return rows;
}
