import { MongoClient } from 'mongodb';
import { env } from './env.js';

export async function getDb() {
  if (!globalThis.gameMatchMongo) {
    const client = new MongoClient(env('MONGODB_URI'), { serverSelectionTimeoutMS: 5000 });
    globalThis.gameMatchMongo = client.connect().catch(error => { globalThis.gameMatchMongo = undefined; throw error; });
  }
  const client = await globalThis.gameMatchMongo;
  return client.db();
}
