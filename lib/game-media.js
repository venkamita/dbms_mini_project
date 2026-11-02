import { getDb } from './mongo.js';

// One batched metadata query for the list, instead of one query per game card.
export async function attachGameMedia(games) {
  if (!games.length) return [];
  const db = await getDb();
  const metadata = await db.collection('game_metadata').find(
    { game_id: { $in: games.map(game => Number(game.game_id)) } },
    { projection: { _id: 0, game_id: 1, screenshots: 1 } },
  ).toArray();
  const covers = new Map(metadata.map(row => [Number(row.game_id), row.screenshots?.[0] || null]));
  return games.map(game => ({ ...game, cover_image: covers.get(Number(game.game_id)) || null }));
}
