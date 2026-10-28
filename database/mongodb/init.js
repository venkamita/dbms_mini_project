// =============================================================
// GameMatch — MongoDB setup
// Run with:  mongosh "mongodb://localhost:27017/gamematch" database/mongodb/init.js
//
// Collections
//   game_metadata : variable-shape details per game (1 doc per MySQL Game row)
//   activity_log  : append-only play sessions (high write volume, no joins)
// Link to MySQL: both collections store game_id / user_id = MySQL primary keys.
// =============================================================

db = db.getSiblingDB("gamematch");
db.game_metadata.drop();
db.activity_log.drop();

// ---------- Collections with JSON-Schema validators (DB-level validation) ----------

db.createCollection("game_metadata", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["game_id", "description", "tags"],
      properties: {
        game_id:     { bsonType: "int", minimum: 1 },
        description: { bsonType: "string", minLength: 10 },
        tags:        { bsonType: "array", items: { bsonType: "string" } },
        screenshots: { bsonType: "array", items: { bsonType: "string" } },
        system_requirements: { bsonType: "object" },   // shape differs per platform
        dlc:         { bsonType: "array" }
      }
    }
  }
});

db.createCollection("activity_log", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["user_id", "game_id", "session_start", "playtime_minutes", "device"],
      properties: {
        user_id:          { bsonType: "int", minimum: 1 },
        game_id:          { bsonType: "int", minimum: 1 },
        session_start:    { bsonType: "date" },
        playtime_minutes: { bsonType: "int", minimum: 1, maximum: 1440 },
        device:           { enum: ["PC", "PlayStation", "Xbox", "Switch"] }
      }
    }
  }
});

// ---------- Indexes ----------

db.game_metadata.createIndex({ game_id: 1 }, { unique: true });
db.game_metadata.createIndex({ description: "text", tags: "text" });   // full-text search
db.activity_log.createIndex({ session_start: -1, game_id: 1 });        // trending window
db.activity_log.createIndex({ user_id: 1, session_start: -1 });        // a user's history

// ---------- Seed data ----------

db.game_metadata.insertMany([
  {
    game_id: NumberInt(1),
    description: "Open-world action RPG with punishing boss fights and a vast fantasy world.",
    tags: ["open-world", "soulslike", "fantasy", "difficult"],
    screenshots: ["/img/g1-1.jpg", "/img/g1-2.jpg"],
    system_requirements: {
      minimum:     { os: "Windows 10", cpu: "Intel i5-8400", ram_gb: 12, gpu: "GTX 1060", storage_gb: 60 },
      recommended: { os: "Windows 10", cpu: "Intel i7-8700K", ram_gb: 16, gpu: "GTX 1070", storage_gb: 60 }
    },
    dlc: [{ name: "Shadow of the Erdtree", price: 39.99 }]
  },
  {
    game_id: NumberInt(2),
    description: "A relaxing farming and life-simulation RPG set in a small valley town.",
    tags: ["farming", "relaxing", "pixel-art", "co-op"],
    screenshots: ["/img/g2-1.jpg"],
    system_requirements: { minimum: { os: "Windows 7", ram_gb: 2, storage_gb: 1 } },
    dlc: []
  },
  {
    game_id: NumberInt(3),
    description: "Fast roguelike dungeon crawler where you fight your way out of the underworld.",
    tags: ["roguelike", "mythology", "fast-paced", "story-rich"],
    screenshots: ["/img/g3-1.jpg", "/img/g3-2.jpg", "/img/g3-3.jpg"],
    system_requirements: { minimum: { os: "Windows 7", ram_gb: 4, storage_gb: 15 } },
    dlc: []
  },
  {
    game_id: NumberInt(4),
    description: "Precise pixel-art platformer about climbing a mountain, with a heartfelt story.",
    tags: ["platformer", "pixel-art", "difficult", "story-rich"],
    screenshots: ["/img/g4-1.jpg"],
    // console-only style requirements: different shape, same collection
    system_requirements: { switch: { storage_gb: 1, joycon_support: true } },
    dlc: [{ name: "Farewell", price: 0 }]
  }
]);

// Play sessions within the last 7 days.
// Totals: G1 = 1000 min, G2 = 600 min, G3 = 300 min, G4 = 900 min
const daysAgo = (d) => new Date(Date.now() - d * 24 * 60 * 60 * 1000);
const session = (u, g, d, mins, device) => ({
  user_id: NumberInt(u), game_id: NumberInt(g),
  session_start: daysAgo(d), playtime_minutes: NumberInt(mins), device
});

db.activity_log.insertMany([
  session(1, 1, 1, 400, "PC"), session(4, 1, 2, 350, "PlayStation"), session(2, 1, 3, 250, "PC"),
  session(2, 2, 1, 300, "Switch"), session(3, 2, 4, 300, "PC"),
  session(1, 3, 2, 150, "PC"), session(4, 3, 5, 150, "Switch"),
  session(3, 4, 1, 500, "Switch"), session(4, 4, 3, 400, "PC"),
  session(2, 1, 20, 900, "PC")   // older than 7 days -> ignored by the trending pipeline
]);

// ---------- Aggregation: trending score per game (last 7 days) ----------
// trending_score = total playtime of the game / playtime of the most-played game  -> [0, 1]

const trending = db.activity_log.aggregate([
  { $match: { session_start: { $gte: daysAgo(7) } } },
  { $group: { _id: "$game_id",
              total_playtime: { $sum: "$playtime_minutes" },
              sessions: { $sum: 1 },
              players: { $addToSet: "$user_id" } } },
  { $group: { _id: null, max_playtime: { $max: "$total_playtime" }, games: { $push: "$$ROOT" } } },
  { $unwind: "$games" },
  { $project: { _id: 0,
                game_id: "$games._id",
                total_playtime: "$games.total_playtime",
                sessions: "$games.sessions",
                unique_players: { $size: "$games.players" },
                trending_score: { $round: [{ $divide: ["$games.total_playtime", "$max_playtime"] }, 4] } } },
  { $sort: { trending_score: -1 } }
]).toArray();

print("Trending games (last 7 days):");
printjson(trending);

// ---------- Full-text search ----------
print("Text search for 'pixel-art story':");
printjson(
  db.game_metadata.find(
    { $text: { $search: "pixel-art story" } },
    { _id: 0, game_id: 1, tags: 1, score: { $meta: "textScore" } }
  ).sort({ score: { $meta: "textScore" } }).toArray()
);

// ---------- Validation check (should fail) ----------
try {
  db.activity_log.insertOne({ user_id: NumberInt(1), game_id: NumberInt(1),
                              session_start: new Date(), playtime_minutes: NumberInt(-5), device: "PC" });
} catch (e) {
  print("Rejected invalid activity_log document: " + e.codeName);
}
