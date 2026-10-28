import mysql from 'mysql2/promise';
import { env } from './env.js';

export function getPool() {
  if (!globalThis.gameMatchPool) {
    globalThis.gameMatchPool = mysql.createPool({ uri: env('MYSQL_URL'), connectionLimit: 10, decimalNumbers: true, dateStrings: true });
  }
  return globalThis.gameMatchPool;
}
// Lazy initialization allows compilation without opening database connections.
export const pool = { execute: (...args) => getPool().execute(...args), getConnection: () => getPool().getConnection() };
