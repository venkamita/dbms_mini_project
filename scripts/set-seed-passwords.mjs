import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

if (!process.env.MYSQL_URL) throw new Error('Missing environment variable: MYSQL_URL');
const connection = await mysql.createConnection(process.env.MYSQL_URL);
try {
  const hash = await bcrypt.hash('password123', 10);
  await connection.beginTransaction();
  await connection.execute('UPDATE User SET password_hash = ?', [hash]);
  const [users] = await connection.execute('SELECT username FROM User ORDER BY user_id');
  await connection.commit();
  console.log('Updated demo passwords for: ' + users.map(user => user.username).join(', '));
} catch (error) {
  await connection.rollback();
  console.error('Could not set demo passwords:', error.code || error.name);
  process.exitCode = 1;
} finally {
  await connection.end();
}
