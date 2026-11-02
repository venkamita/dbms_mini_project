# Expanded game catalog and real artwork

The optional expanded catalog contains **64 games**: the four original seed games plus 60 additional titles. Source records are in `data/catalog.json`; optimized local WebP artwork is under `public/images/games/<Steam app ID>/`.

## What is included

- Publisher, published USD base price, Steam edition release date, genre assignments and PC availability.
- Description, search tags and published Windows/macOS/Linux requirements where available.
- One real store cover and two gameplay screenshots per game: **192 local images**.
- Per-game Steam source URL, retrieval timestamp, original image URLs, currency and pricing notes.

Original descriptions for the first four games are retained. Additional short descriptions and requirements are sourced from the published Steam store records. Artwork and descriptive material belong to their respective rights holders; attribution is retained in the source manifest and on imported game detail pages. These are externally sourced assets, not original GameMatch artwork. The dataset is intended for this educational demonstration.

The PC store does not establish console availability, so newly imported games are linked to PC only. The original games retain their existing console/platform links. Requirements describe the store-listed computer editions. Prices are snapshots, not a live store-price feed; purchases remain simulated in GameMatch.

The expansion catalog is not a complete DLC database. `dlc` is an empty array for newly imported records, with that limitation stated in source metadata. Existing DLC entries are preserved. The UI says “No DLC listed,” rather than asserting that a game has no DLC.

## Populate an existing configured database

```bash
npm run seed:catalog
```

Run after the normal base-schema, feature, user seed and MongoDB initialization steps. No external API calls are needed: the manifest and images are already in the repository. Do not reload the destructive base initialization scripts merely to expand an existing catalog.

The importer:

1. Validates the manifest and all local image paths before writing.
2. Uses a database advisory lock and stable Steam IDs recorded as `game_metadata.catalog_source.steam_app_id` to prevent duplicate imports, even if an imported game's title is later edited.
3. Creates new SQL games, genre/platform links and MongoDB metadata. It uses BSON Int32 for game IDs.
4. Preserves existing SQL titles, prices, flags and relationship links; existing metadata descriptions, tags, requirements and DLC are also retained. It refreshes artwork and provenance for recognized existing games.
5. Holds a SQL transaction until the MongoDB write succeeds and compensates metadata on SQL commit failure. Completed games remain imported if a later game fails; rerunning safely resumes the import.
6. Checks fingerprints of User identifiers/roles, Rates, Owns and Adds before and after import, then refreshes recommendations through the existing SQL/MongoDB scoring engine.

It never resets passwords, manufactures reviews, or adds simulated play sessions. New games begin with zero ratings. Their content scores can contribute to recommendations immediately; collaborative and trending scores depend on the actual rating/activity data available. Existing user interactions are preserved.

Results are written to `output/catalog-import-results.json`. Repeated runs should report zero created games and unchanged game counts.

## Refresh the external source snapshot

```bash
npm run catalog:fetch
npm run seed:catalog
```

The fetcher uses the public Steam store app-details endpoint, requests US/English records, skips games without a published USD price or complete imagery, downloads artwork, and converts it to WebP using the existing Sharp dependency. Source responses are cached in ignored `output/steam-cache/` so interrupted fetches can resume. Remove the relevant cache entries to request a fresh source snapshot. Existing image files are reused.

## Presentation

Catalog and recommendation APIs attach cover paths using one batched MongoDB query. Cards use lazy-loaded Next.js images; detail pages show cover art, gameplay screenshots and source attribution. A text fallback remains only for missing/broken artwork or custom admin-created games without images. The neutral color palette and recommendation calculations are unchanged.

The first `screenshots` entry is the cover image. Subsequent entries form the screenshot gallery. The admin editor preserves this order. `catalog_source` is optional import provenance retained during subsequent admin edits; it is not a SQL foreign key or a new SQL column.

The original T1–T11 fixed-example suite assumes a fresh **four-game** seed. Run that suite against a disposable minimal seed database before importing the expansion; its hardcoded preflight deliberately rejects an expanded catalog. Use the expanded catalog for realistic browsing and recommendations, not for asserting that only games 2 and 4 exist as candidates.
