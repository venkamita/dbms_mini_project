import { pool } from './mysql.js';
import { getDb } from './mongo.js';

export const WEIGHTS = { content: 0.3, collab: 0.5, trending: 0.2 };

export async function getTrending() {
  const db = await getDb();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  // Same pipeline as database/mongodb/init.js, including normalization and rounding.
  return db.collection('activity_log').aggregate([
    { $match: { session_start: { $gte: sevenDaysAgo } } },
    { $group: { _id: '$game_id', total_playtime: { $sum: '$playtime_minutes' }, sessions: { $sum: 1 }, players: { $addToSet: '$user_id' } } },
    { $group: { _id: null, max_playtime: { $max: '$total_playtime' }, games: { $push: '$$ROOT' } } },
    { $unwind: '$games' },
    { $project: { _id: 0, game_id: '$games._id', total_playtime: '$games.total_playtime', sessions: '$games.sessions', unique_players: { $size: '$games.players' }, trending_score: { $round: [{ $divide: ['$games.total_playtime', '$max_playtime'] }, 4] } } },
    { $sort: { trending_score: -1 } },
  ]).toArray();
}

export function combineScores(content, collab, trending) {
  return Number((WEIGHTS.content * content + WEIGHTS.collab * collab + WEIGHTS.trending * trending).toFixed(4));
}
export function reasonFor(row) {
  const contributions = [
    [Number(row.content_score) * WEIGHTS.content, 'Matches genres you rate highly'],
    [Number(row.collab_score) * WEIGHTS.collab, 'Players with similar taste rated this highly'],
    [Number(row.trending_score) * WEIGHTS.trending, 'Popular this week'],
  ];
  return contributions.reduce((best, current) => current[0] > best[0] ? current : best)[1];
}

async function compute(userId, trending) {
  const connection = await pool.getConnection();
  const trendingScores = new Map(trending.map(row => [Number(row.game_id), Number(row.trending_score)]));
  try {
    await connection.beginTransaction();
    // Serialize recomputes for this user so two first-time requests cannot race.
    await connection.execute('SELECT user_id FROM User WHERE user_id = ? FOR UPDATE', [userId]);
    const [candidates] = await connection.execute(`SELECT g.game_id FROM Game g WHERE g.is_active = TRUE
      AND NOT EXISTS (SELECT 1 FROM Rates r WHERE r.user_id = ? AND r.game_id = g.game_id)
      AND NOT EXISTS (SELECT 1 FROM Owns o WHERE o.user_id = ? AND o.game_id = g.game_id)`, [userId, userId]);
    let rows = [];
    if (candidates.length) {
      const [content] = await connection.execute(`SELECT game_id, fn_content_score(?, game_id) AS s FROM Game
        WHERE game_id IN (SELECT ids.game_id FROM JSON_TABLE(?, '$[*]' COLUMNS(game_id INT PATH '$')) ids)`, [userId, JSON.stringify(candidates.map(row => row.game_id))]);
      const result = await connection.execute('CALL sp_collaborative_scores(?)', [userId]);
      const collaborative = new Map(result[0][0].map(row => [row.game_id, Number(row.collab_score)]));
      rows = content.map(row => {
        const content_score = Number(row.s);
        const collab_score = collaborative.get(row.game_id) || 0;
        const trending_score = trendingScores.get(row.game_id) || 0;
        return { game_id: row.game_id, content_score, collab_score, trending_score, score: combineScores(content_score, collab_score, trending_score) };
      }).filter(row => row.score > 0);
    }
    await connection.execute('DELETE FROM Recommends WHERE user_id = ?', [userId]);
    for (const row of rows) await connection.execute("INSERT INTO Recommends (user_id, game_id, method, score, content_score, collab_score, trending_score) VALUES (?, ?, 'hybrid', ?, ?, ?, ?)", [userId, row.game_id, row.score, row.content_score, row.collab_score, row.trending_score]);
    await connection.commit();
    return rows.length;
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}
export async function computeForUser(userId) { return compute(userId, await getTrending()); }
export async function computeForAll() {
  const trending = await getTrending();
  const [users] = await pool.execute("SELECT user_id FROM User WHERE role = 'player' ORDER BY user_id");
  let rows = 0;
  for (const user of users) rows += await compute(user.user_id, trending);
  return { users: users.length, rows };
}
export async function readRecommendations(userId) {
  const [rows] = await pool.execute(`SELECT r.*, g.title, g.publisher, g.base_price, g.avg_rating FROM Recommends r
    JOIN Game g ON g.game_id = r.game_id WHERE r.user_id = ? AND g.is_active = TRUE
    AND NOT EXISTS (SELECT 1 FROM Rates rated WHERE rated.user_id = r.user_id AND rated.game_id = r.game_id)
    AND NOT EXISTS (SELECT 1 FROM Owns owned WHERE owned.user_id = r.user_id AND owned.game_id = r.game_id)
    ORDER BY r.score DESC, g.title`, [userId]);
  return rows.map(row => ({ ...row, reason: reasonFor(row) }));
}
