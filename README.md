# GameMatch — Explainable Game Recommendation Platform

DBMS Level 3 Project · Section H · Team 15 — Sharat Doddihal (PES1UG24CS430), Shashank Palcharla (PES1UG24CS436).

Browse games, write reviews, save a wishlist, buy into a mock library, and see why each game is recommended. Admins manage games and analytics. The score combines **30% content** (MySQL function), **50% collaborative** (MySQL procedure), and **20% trending** (MongoDB aggregation). Triggers maintain ratings; the purchase procedure updates library and wishlist atomically. No real payments are involved.

Full design and test status: [PROJECT_SPEC.md](docs/PROJECT_SPEC.md).

## Prerequisites

- Node.js **20.19+** and npm (MongoDB driver 7 requires 20.19+; Node 22 LTS works).
- MySQL **8.0.16+**, running, with privileges to create the schema, functions, procedures, triggers and views. With restricted binary logging, ask your database administrator about `log_bin_trust_function_creators` before loading the function.
- MongoDB **6+**, running, and `mongosh`.
- `mysql` and `mongosh` on PATH, or use full executable paths.

## Setup

Run from the repo root. Initialization scripts **drop and recreate the gamematch database/collections**. Use disposable development data.

```bash
npm install
mysql -u root -p --execute="SOURCE database/mysql/01_schema.sql"
mysql -u root -p --execute="SOURCE database/mysql/02_features.sql"
mysql -u root -p --execute="SOURCE database/mysql/03_seed.sql"
mongosh "mongodb://localhost:27017/gamematch" database/mongodb/init.js
```

These commands work in PowerShell and Bash. `04_queries.sql` is an **optional, mutating classroom demo**, not app setup. It changes ratings/purchases and contains non-repeatable ALTER statements. Reload 01 → 02 → 03 before checking the worked example if you ran 04. The active flag and recommendation signals are already in 01.

Copy `.env.example` to `.env.local`, then edit your database URLs:

```powershell
Copy-Item .env.example .env.local
```

Bash equivalent: `cp .env.example .env.local`. Generate a JWT secret and paste its output into `JWT_SECRET`:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

All three variables (`MYSQL_URL`, `MONGODB_URI`, `JWT_SECRET`) are required. Missing configuration stops startup clearly. URL-encode punctuation in passwords and include `/gamematch` in the MongoDB URL. `.env*.local` files are ignored; credentials and hashes are never logged.

```bash
npm run seed:passwords
npm run dev
```

The password script loads `.env.local` with `node --env-file=.env.local`, hashes at bcrypt cost 10, and prints usernames only. It resets **every user's** password, so run it only on seed data.

Open [GameMatch](http://localhost:3000). Production: `npm run build`, then `npm start`. Production authentication cookies require HTTPS; use `npm run dev` for a local HTTP demo.

## Demo logins

After setting seed passwords: **`u1_arjun`** (player) or **`admin`**, password **`password123`**. Other players: `u2_meera`, `u3_rohan`, `u4_kavya`.

As admin, open Analytics and click **Recompute recommendations**. Then log in as `u1_arjun` and open For You. Fresh, untouched seed data should produce:

| Game | Content | Collaborative | Trending | Hybrid |
|---|---|---|---|---|
| Stardew Valley | 0.5000 | 1.0000 | 0.6000 | **0.7700** |
| Celeste | 0.0000 | 0.0000 | 0.9000 | **0.1800** |

MongoDB sessions use relative dates. Re-run `init.js` when sessions are more than a few days old. Live database tests were skipped at the user's request. The offline orchestration test verifies the expected numbers using fixture outputs from database objects.

## Pages

| Page | Access | Purpose |
|---|---|---|
| `/` | Public | Redirect to catalog |
| `/login`, `/register` | Public | Authentication |
| `/catalog` | Public | Search; genre/platform/price filters |
| `/games/[id]` | Public | Details/reviews; signed-in rating, wishlist and buy actions |
| `/wishlist` | Signed in | Saved games; remove or buy |
| `/library` | Signed in | Games, price paid, purchase date |
| `/recommendations` | Signed in | Ranked matches and labeled score breakdown |
| `/admin/games` | Admin | Create, edit, deactivate; add genres/platforms |
| `/admin/analytics` | Admin | Trending, top rated, active reviewers, recompute |

## API routes

Client pages call APIs with `fetch`. Protected handlers verify the JWT and fetch the current user and role from MySQL. Error bodies always use `{ "error": "message" }`.

| Route | Methods | Access |
|---|---|---|
| `/api/auth/register`, `/api/auth/login` | POST | Public |
| `/api/auth/logout` | POST | Signed in |
| `/api/auth/me` | GET | Public; user or null |
| `/api/games` | GET / POST | Public / Admin |
| `/api/games/[id]` | GET / PUT / DELETE | Public / Admin / Admin |
| `/api/genres`, `/api/platforms` | GET / POST | Public / Admin |
| `/api/ratings` | POST, PUT, DELETE | Signed in |
| `/api/wishlist` | GET, POST, DELETE | Signed in |
| `/api/purchase` | POST | Signed in |
| `/api/library`, `/api/recommendations` | GET | Signed in |
| `/api/recommendations/recompute` | POST | Admin |
| `/api/admin/analytics` | GET | Admin |

`GET /api/games` accepts `genre`, `platform`, `maxPrice`, `q`. Text search preserves MongoDB relevance order while applying SQL filters. Otherwise results use average rating order. Inactive games are hidden from players; recommendations exclude rated and owned games.

Admin saves write SQL first and hold the transaction until MongoDB succeeds. Mongo failures roll SQL back; SQL commit failures trigger metadata compensation. This is application-level compensation, not a distributed transaction: simultaneous database outages can require manual reconciliation.

## Verification

```bash
npm run lint
npm test
npm run build
```

Offline tests need no services or credentials. They cover JWTs, bcrypt/cookies, validation, error mapping, current-role checks, cross-database rollback/compensation, recommendation persistence, and one trending aggregation per batch.

For T1–T11 later, initialize **disposable fresh seed databases**, start the development server, and explicitly opt in:

```bash
npm run test:integration -- --confirm-demo-db
```

The suite checks seed recommendations before creating a temporary player for rating/wishlist/purchase tests. Cleanup explicitly deletes their ratings before deleting the user, so triggers fire. It recomputes seed recommendations and attempts an invalid MongoDB insert. Results go to `output/integration-results.json`. `TEST_BASE_URL` optionally selects a different development server. Do not use valuable data.

T3 checks the trigger-maintained average returned to the game page. T7 uses the MongoDB driver; the equivalent `mongosh` validator demo is at the end of `init.js`. Screenshots in [the project spec](docs/PROJECT_SPEC.md#screenshots) visibly say **UI PREVIEW · FIXTURE DATA** and demonstrate layout, not live database results.

## Repository layout

```text
app/                 App Router pages, client UI, API handlers
lib/                 shared clients, authentication, validation, hybrid scoring
proxy.js             page access checks; APIs enforce access separately
scripts/             passwords, opt-in integration tests, fixture previews
tests/               offline application tests
database/mysql/      schema, features, seed, classroom queries
database/mongodb/    validators, indexes, metadata, sessions, aggregation
docs/                design, requirements, diagrams, screenshots
.env.example         configuration template
```

Next.js 16 calls middleware Proxy, so `proxy.js` implements the spec's `middleware.js` behavior using the [current convention](https://nextjs.org/docs/app/getting-started/proxy). The root scaffold was created directly to preserve existing files; it uses JavaScript, App Router, Tailwind, ESLint, Turbopack, the default `@/*` alias, and no `src/` directory.

Keep commits separate and use each contributor's real Git identity for their work. The implementation does not fabricate contribution history for team members.
