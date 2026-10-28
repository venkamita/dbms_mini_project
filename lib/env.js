export function env(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}. Configure .env.local using .env.example.`);
  return value;
}
export function validateEnv() {
  for (const name of ['MYSQL_URL', 'MONGODB_URI', 'JWT_SECRET']) env(name);
  if (env('JWT_SECRET').length < 32) throw new Error('JWT_SECRET must contain at least 32 characters.');
}
