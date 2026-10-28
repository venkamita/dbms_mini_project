// Produces a Playwright CLI snippet for isolated UI previews. All /api/**
// requests are fulfilled with fixtures. This does not test either database.
import { mkdir, writeFile } from 'node:fs/promises';
import { signToken } from '../lib/token.js';

process.loadEnvFile('.env.preview.local');
const genres = ['Action', 'RPG', 'Simulation', 'Roguelike', 'Platformer', 'Indie'].map((name, index) => ({ genre_id: index + 1, name }));
const platforms = ['PC', 'PlayStation', 'Xbox', 'Switch'].map((name, index) => ({ platform_id: index + 1, name }));
const games = [
  { game_id: 1, title: 'Elden Ring', publisher: 'Bandai Namco', base_price: 59.99, avg_rating: 4.67, release_date: '2022-02-25', is_active: 1, genres: ['Action', 'RPG'] },
  { game_id: 2, title: 'Stardew Valley', publisher: 'ConcernedApe', base_price: 14.99, avg_rating: 4.5, release_date: '2016-02-26', is_active: 1, genres: ['RPG', 'Simulation'] },
  { game_id: 3, title: 'Hades', publisher: 'Supergiant Games', base_price: 24.99, avg_rating: 4, release_date: '2020-09-17', is_active: 1, genres: ['Action', 'Roguelike'] },
  { game_id: 4, title: 'Celeste', publisher: 'Maddy Makes Games', base_price: 19.99, avg_rating: 3.5, release_date: '2018-01-25', is_active: 1, genres: ['Platformer', 'Indie'] },
];
const metadata = { game_id: 1, description: 'Open-world action RPG with punishing boss fights and a vast fantasy world.', tags: ['open-world', 'soulslike', 'fantasy', 'difficult'], screenshots: [], system_requirements: { minimum: { os: 'Windows 10', cpu: 'Intel i5-8400', ram_gb: 12, gpu: 'GTX 1060', storage_gb: 60 }, recommended: { os: 'Windows 10', cpu: 'Intel i7-8700K', ram_gb: 16, gpu: 'GTX 1070', storage_gb: 60 } }, dlc: [{ name: 'Shadow of the Erdtree', price: 39.99 }] };
const reviews = [{ username: 'u1_arjun', score: 5, review_text: 'Huge world, brutal bosses.', rated_at: '2026-10-27T12:00:00Z' }, { username: 'u2_meera', score: 4, review_text: null, rated_at: '2026-10-27T11:00:00Z' }, { username: 'u4_kavya', score: 5, review_text: null, rated_at: '2026-10-26T10:00:00Z' }];
const player = { user_id: 1, username: 'u1_arjun', email: 'arjun@example.com', role: 'player' };
const admin = { user_id: 5, username: 'admin', email: 'admin@example.com', role: 'admin' };
const recommendations = [
  { ...games[1], score: .77, content_score: .5, collab_score: 1, trending_score: .6, reason: 'Players with similar taste rated this highly' },
  { ...games[3], score: .18, content_score: 0, collab_score: 0, trending_score: .9, reason: 'Popular this week' },
];
const analytics = { topRatedByGenre: games.filter(game => game.avg_rating >= 4).flatMap(game => game.genres.map(genre => ({ genre, game_id: game.game_id, title: game.title, avg_rating: game.avg_rating }))), trending: [0, 3, 1, 2].map(index => ({ game_id: index + 1, title: games[index].title, total_playtime: [1000,600,300,900][index], sessions: [3,2,2,2][index], unique_players: [3,2,2,2][index], trending_score: [1,.6,.3,.9][index] })), mostActiveUsers: [{ user_id: 2, username: 'u2_meera', ratings_count: 3 }, { user_id: 4, username: 'u4_kavya', ratings_count: 3 }, { user_id: 1, username: 'u1_arjun', ratings_count: 2 }, { user_id: 3, username: 'u3_rohan', ratings_count: 2 }] };
const fixture = { games, genres, platforms, metadata, reviews, player, admin, recommendations, analytics, playerToken: await signToken(player), adminToken: await signToken(admin) };
await mkdir('output/playwright', { recursive: true });
await mkdir('docs/screenshots', { recursive: true });
const code = `async (page) => {
  const fixture = ${JSON.stringify(fixture)};
  let currentUser = null;
  const consoleErrors = [];
  page.on('pageerror', error => consoleErrors.push(error.message));
  await page.context().clearCookies();
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    let payload;
    if (url.pathname === '/api/auth/me') payload = { user: currentUser };
    else if (url.pathname === '/api/genres') payload = fixture.genres;
    else if (url.pathname === '/api/platforms') payload = fixture.platforms;
    else if (url.pathname === '/api/games') {
      payload = fixture.games;
      if (url.searchParams.get('q') === 'pixel-art') payload = payload.filter(game => [2,4].includes(game.game_id));
    }
    else if (url.pathname.startsWith('/api/games/')) payload = { game: fixture.games[0], genres: fixture.genres.slice(0,2), platforms: fixture.platforms.slice(0,3), metadata: fixture.metadata, reviews: fixture.reviews, myRating: { score: 5, review_text: 'Huge world, brutal bosses.' }, owned: false, wishlisted: false };
    else if (url.pathname === '/api/wishlist') payload = [fixture.games[1]];
    else if (url.pathname === '/api/library') payload = [{ game_id: 3, title: 'Hades', price_paid: 24.99, purchased_at: '2026-10-27T12:00:00Z' }];
    else if (url.pathname === '/api/recommendations') payload = fixture.recommendations;
    else if (url.pathname === '/api/admin/analytics') payload = fixture.analytics;
    else if (url.pathname === '/api/recommendations/recompute') payload = { users: 4, rows: 6 };
    else return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Fixture preview does not support this mutation' }) });
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
  });
  await page.addInitScript(() => {
    window.addEventListener('DOMContentLoaded', () => {
      const badge = document.createElement('div');
      badge.textContent = 'UI PREVIEW · FIXTURE DATA';
      badge.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:9999;padding:7px 11px;background:#18213a;color:white;font:11px Arial;border-radius:5px;letter-spacing:.06em';
      document.body.appendChild(badge);
    });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  const captured = [];
  for (const [path, name, heading] of [['/login','login','Welcome back'], ['/register','register','Join GameMatch'], ['/catalog','catalog','Find your next favorite.']]) {
    await page.goto('http://127.0.0.1:3000'+path);
    await page.getByRole('heading', { name: heading, exact: true }).waitFor();
    if (path === '/catalog') await page.getByRole('link', { name: 'Elden Ring', exact: true }).waitFor();
    await page.screenshot({ path: 'docs/screenshots/'+name+'.png', fullPage: true }); captured.push(name);
  }
  currentUser = fixture.player;
  await page.context().addCookies([{ name:'token', value:fixture.playerToken, url:'http://127.0.0.1:3000', httpOnly:true, sameSite:'Lax' }]);
  for (const [path,name,heading] of [['/games/1','game-detail','Elden Ring'], ['/wishlist','wishlist','Your wishlist'], ['/library','library','Your library'], ['/recommendations','recommendations','Good games. Clear reasons.']]) {
    await page.goto('http://127.0.0.1:3000'+path);
    await page.getByRole('heading', { name:heading, exact:true }).waitFor();
    if (path === '/wishlist') await page.getByRole('button', { name:'Remove', exact:true }).waitFor();
    if (path === '/library') await page.getByRole('link', { name:'Hades', exact:true }).waitFor();
    if (path === '/recommendations') await page.getByText('77.0% match', { exact:true }).waitFor();
    await page.screenshot({ path:'docs/screenshots/'+name+'.png', fullPage:true }); captured.push(name);
  }
  currentUser = fixture.admin;
  await page.context().addCookies([{ name:'token', value:fixture.adminToken, url:'http://127.0.0.1:3000', httpOnly:true, sameSite:'Lax' }]);
  for (const [path,name,heading] of [['/admin/games','admin-games','Manage the collection'], ['/admin/analytics','admin-analytics','A pulse on the players']]) {
    await page.goto('http://127.0.0.1:3000'+path);
    await page.getByRole('heading', { name:heading, exact:true }).waitFor();
    if (path === '/admin/games') await page.getByRole('button', { name:'Edit', exact:true }).first().waitFor();
    else await page.getByRole('heading', { name:'Trending this week', exact:true }).waitFor();
    await page.screenshot({ path:'docs/screenshots/'+name+'.png', fullPage:true }); captured.push(name);
  }
  await page.setViewportSize({ width:390, height:844 });
  await page.goto('http://127.0.0.1:3000/catalog');
  await page.getByRole('link', { name:'Elden Ring', exact:true }).waitFor();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  if (overflow) throw new Error('Catalog overflows the mobile viewport');
  await page.screenshot({ path:'docs/screenshots/catalog-mobile.png', fullPage:true });
  if (consoleErrors.length) throw new Error(consoleErrors.join('; '));
  return { captured, mobileOverflow:overflow, pageErrors:consoleErrors, note:'All API responses were fixtures; no live database tests were run.' };
}`;
await writeFile('output/playwright/capture.js', code);
console.log('Prepared isolated preview snippet in output/playwright/capture.js');
