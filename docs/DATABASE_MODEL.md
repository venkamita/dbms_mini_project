# GameMatch — final database model

This reference and the digital diagrams describe `database/mysql/01_schema.sql`, not the optional mutations in `04_queries.sql`. No application or database behavior was changed to make these drawings.

## Final drawings and originals

| Artifact | PNG | Editable SVG |
|---|---|---|
| Chen entity–relationship diagram | [ER diagram](er-diagram.png) | [Vector original](er-diagram.svg) |
| Boxed-row relational schema | [Relational schema](relational-schema.png) | [Vector original](relational-schema.svg) |

The original handwritten drawings are preserved in [originals/](originals/). The digital drawings retain their rectangle/oval/diamond ER notation and horizontal attribute-cell relational notation. The SVGs can be edited in a vector editor without loss of resolution.

## Exact base relations

`PK(...)` means the complete primary key. In a composite key, neither column alone is required to be unique. All timestamps present in the base DDL are included.

```text
User(user_id, username, email, password_hash, role, created_at)
  PK(user_id)
Game(game_id, title, publisher, base_price, avg_rating, release_date, is_active)
  PK(game_id)
Genre(genre_id, name)
  PK(genre_id)
Platform(platform_id, name)
  PK(platform_id)
Rates(user_id, game_id, score, review_text, rated_at)
  PK(user_id, game_id)
Adds(user_id, game_id, added_at)
  PK(user_id, game_id)
Owns(user_id, game_id, price_paid, purchased_at)
  PK(user_id, game_id)
Recommends(user_id, game_id, method, score, content_score, collab_score,
           trending_score, generated_at)
  PK(user_id, game_id)
HasGenre(game_id, genre_id)
  PK(game_id, genre_id)
OnPlatform(game_id, platform_id)
  PK(game_id, platform_id)
```

There are **10 tables, 41 columns, and 12 foreign-key constraints**. `Recommends.method` is not part of its primary key: the table stores one current recommendation per user/game, not one row for each method.

## Foreign keys, cardinality and participation

Every FK listed below is `NOT NULL` and uses **ON DELETE CASCADE**.

| Child table | Foreign-key mappings |
|---|---|
| Rates | `user_id → User.user_id`; `game_id → Game.game_id` |
| Adds | `user_id → User.user_id`; `game_id → Game.game_id` |
| Owns | `user_id → User.user_id`; `game_id → Game.game_id` |
| Recommends | `user_id → User.user_id`; `game_id → Game.game_id` |
| HasGenre | `game_id → Game.game_id`; `genre_id → Genre.genre_id` |
| OnPlatform | `game_id → Game.game_id`; `platform_id → Platform.platform_id` |

The six conceptual relationships are M:N. Each entity may participate in **zero or many** relationship occurrences. Each junction row references **exactly one existing parent on each side**. For example, a User can have no ratings, but a Rates row cannot omit its user or game. The DDL does not require every game to have a genre or platform; the diagram deliberately does not invent mandatory participation.

The ER drawing uses shared connector trunks to preserve the original vertical arrangement. They bundle lines from the same entity; they do not create additional entities or relationships. The relational drawing bundles User/Game references on outside rails, has arrows into the parent PKs, and states each FK mapping beneath its child table.

## Constraints, defaults and stored values

| Table / columns | Implemented rules |
|---|---|
| Entity IDs | `INT`, auto-increment PKs for User, Game, Genre and Platform |
| All junction IDs | `INT NOT NULL`; combined PK; FKs as listed above |
| User.username | `VARCHAR(50) NOT NULL UNIQUE` |
| User.email | `VARCHAR(100) NOT NULL UNIQUE`; `CHECK (email LIKE '%_@_%._%')` |
| User.password_hash | `VARCHAR(255) NOT NULL`; app stores bcrypt hashes, cost 10 |
| User.role | `ENUM('admin','player') NOT NULL DEFAULT 'player'` |
| Game.title | `VARCHAR(150) NOT NULL`; full-text index |
| Game.publisher | Nullable `VARCHAR(100)` in the base schema |
| Game.base_price | `DECIMAL(8,2) NOT NULL DEFAULT 0.00`; non-negative |
| Game.avg_rating | `DECIMAL(3,2) NOT NULL DEFAULT 0.00`; range 0–5; stored and maintained by Rates insert/update/delete triggers |
| Game.release_date | Nullable `DATE`; secondary index |
| Game.is_active | `BOOLEAN NOT NULL DEFAULT TRUE`; app soft-deletion flag |
| Genre.name / Platform.name | Each is `VARCHAR(50) NOT NULL UNIQUE` |
| Rates.score | `TINYINT NOT NULL`; integer range 1–5 |
| Rates.review_text | Nullable `TEXT` |
| Owns.price_paid | `DECIMAL(8,2) NOT NULL`; non-negative; purchase-time price |
| Recommends.method | `ENUM('content','collaborative','trending','hybrid') NOT NULL DEFAULT 'hybrid'` |
| Recommends.score | `DECIMAL(5,4) NOT NULL`; range 0–1 |
| Recommends.content_score / collab_score / trending_score | Each `DECIMAL(5,4) NOT NULL DEFAULT 0`; each checked within 0–1 |
| User.created_at / Rates.rated_at / Adds.added_at / Owns.purchased_at / Recommends.generated_at | `TIMESTAMP DEFAULT CURRENT_TIMESTAMP`; the DDL does not explicitly declare these columns `NOT NULL` |

Only ID columns are underlined as PKs in the relational drawing. Separate unique constraints are labeled **UQ**; username and email do not form a composite primary key. `is_active` is implemented with MySQL BOOLEAN (a TINYINT alias); the drawing does not imply an additional CHECK limiting it to 0/1. Likewise, the diagram does not imply non-empty-string constraints absent from the DDL.

Other indexes are `idx_rates_game`, `idx_hasgenre_genre`, `idx_game_release`, and `ft_game_title`, in addition to PK/UNIQUE indexes. Triggers and routines are defined in `02_features.sql`; the stored purchase procedure inserts into Owns and deletes from Adds in one transaction.

`04_queries.sql` is a classroom demonstration, not part of the base model. It adds optional `User.last_login` and widens publisher to `VARCHAR(150)`; it also changes seed data. Those optional changes are not silently included in these final base-schema drawings.

## Separate MongoDB document model

MongoDB collections are not SQL tables and do not add SQL foreign keys to Game or User.

### game_metadata

```text
_id                    MongoDB-generated document identifier
game_id                BSON int, >= 1; required; unique index
description            string, >= 10 characters; required
tags                   array of strings; required
screenshots            optional array of strings
system_requirements    optional object; nested keys vary by game/platform
dlc                    optional array
```

The collection has a `$jsonSchema` validator, a unique `{game_id: 1}` index, and a text index on description and tags. Detail retrieval uses `findOne({game_id})`; text search uses `$text` and sorts by `textScore`. Optional means optional at the database-validator level; the admin API requires the complete metadata shape. The validator only constrains DLC as an array; the API additionally validates each DLC name and price.

### activity_log

```text
_id                    MongoDB-generated document identifier
user_id                BSON int, >= 1; required
game_id                BSON int, >= 1; required
session_start          BSON date; required
playtime_minutes       BSON int, 1–1440; required
device                 PC | PlayStation | Xbox | Switch; required
```

Indexes are `{session_start: -1, game_id: 1}` and `{user_id: 1, session_start: -1}`. Trending selects the last seven days, groups playtime by game, divides by the largest total, and rounds the score to four decimals; it also returns sessions and unique-player counts.

### Cross-database associations

```text
Game.game_id  ↔ game_metadata.game_id   intended one metadata document per game
Game.game_id  ↔ activity_log.game_id    zero or many activity documents per game
User.user_id  ↔ activity_log.user_id    zero or many activity documents per user
```

These are **logical/application-maintained associations**, not database-enforced cross-store referential constraints. The unique metadata index enforces at most one document per game ID, but it cannot prove that a matching SQL Game exists. MongoDB `_id` is not copied into Game; **there is no `mongo_metadata_id` column**. SQL cascades do not automatically delete MongoDB documents. Admin writes use the existing application compensation logic, not a distributed foreign key or guaranteed distributed transaction.

## Regeneration and approved corrections

Run `node scripts/generate-diagrams.mjs` from the repo root after `npm install`. The script uses Node built-ins and the `sharp` renderer supplied by the existing Next.js installation. SVGs are resolution-independent; PNGs are 3200×3650 and 3600×2540 pixels. `schema-model.json` records the parsed table/column/key model.

The generator reads the base SQL directly, verifies 10 tables / 41 columns / 12 FKs, and includes all columns with exact names. Approved corrections implemented: removed obsolete metadata IDs; added active/recommendation/timestamp fields; clarified PK, composite PK, FK and UNIQUE notation; retained M:N relationships with optional participation; annotated the stored rating; documented constraints and MongoDB associations separately; replaced cropped scans with clean digital drawings while preserving the originals. App and SQL source behavior remain unchanged.
