export async function register() {
  const { validateEnv } = await import('./lib/env.js');
  validateEnv();
}
