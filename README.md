# GameMatch — Explainable Game Recommendation Platform

DBMS Level 3 Project · Section H · Team 15 — Sharat Doddihal (PES1UG24CS430), Shashannk Palcharla (PES1UG24CS436)

GameMatch recommends games with a score players can inspect: **content** (genres you rate highly, MySQL function) + **collaborative** (players who rate like you, MySQL procedure) + **trending** (recent playtime, MongoDB aggregation).

Full specification: [`docs/PROJECT_SPEC.md`](docs/PROJECT_SPEC.md)

## Repository layout

```
docs/
  PROJECT_SPEC.md          problem, design, data dictionary, features, test cases
  er-diagram.png           hand-drawn ER diagram
  relational-schema.png    hand-drawn relational schema
  requirements.pdf         course requirements
database/
  mysql/01_schema.sql      tables, keys, constraints, indexes
  mysql/02_features.sql    views, triggers, function, procedures, transaction
  mysql/03_seed.sql        sample data
  mysql/04_queries.sql     ALTER/DROP, DML, demo queries, failing integrity tests
  mongodb/init.js          collections, validators, indexes, seed, aggregation, text search
.env.example
```

## Stack
MySQL 8 · MongoDB 6+ · Next.js (API routes) · `mysql2` · `mongodb` driver · bcrypt + JWT

## Setup

### 1. MySQL
```bash
mysql -u root -p < database/mysql/01_schema.sql
mysql -u root -p < database/mysql/02_features.sql
mysql -u root -p < database/mysql/03_seed.sql
mysql -u root -p --table < database/mysql/04_queries.sql   # demo queries (adds Game.is_active)
```

### 2. MongoDB
```bash
mongosh "mongodb://localhost:27017" database/mongodb/init.js
```
This prints the trending scores (G1 1.0, G4 0.9, G2 0.6, G3 0.3) and a text-search result.

### 3. Environment
```bash
cp .env.example .env.local   # then fill in real values
```

### 4. Web app
_Next.js app to be added under `app/` — `npm install && npm run dev`._

## Expected result on seed data
For user 1: `fn_content_score` → G2 0.50, G4 0.00 · `sp_collaborative_scores` → G2 1.00 · trending → G2 0.60, G4 0.90
→ hybrid **G2 = 0.77**, **G4 = 0.18**.
