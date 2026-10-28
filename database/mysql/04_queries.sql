-- =============================================================
-- GameMatch — demo queries (DDL ALTER/DROP, DML, advanced features)
-- Run after 01_schema.sql, 02_features.sql, 03_seed.sql
-- =============================================================
USE gamematch;

-- ---------- DDL: ALTER and DROP ----------

-- ALTER: optional timestamp to record the user's most recent login
ALTER TABLE User ADD COLUMN last_login TIMESTAMP NULL;

-- ALTER: widen a column
ALTER TABLE Game MODIFY COLUMN publisher VARCHAR(150);

-- DROP: create a scratch table and drop it; drop and recreate a view
CREATE TABLE TempImport (id INT PRIMARY KEY, raw_title VARCHAR(150));
DROP TABLE TempImport;

DROP VIEW IF EXISTS vw_top_rated_by_genre;
CREATE VIEW vw_top_rated_by_genre AS
SELECT ge.name AS genre, g.game_id, g.title, g.avg_rating
FROM Game g
JOIN HasGenre hg ON hg.game_id = g.game_id
JOIN Genre ge    ON ge.genre_id = hg.genre_id
WHERE g.avg_rating >= 4.0 AND g.is_active = TRUE;

-- ---------- DML ----------

-- INSERT
INSERT INTO Genre (name) VALUES ('Puzzle');

-- UPDATE (rating change fires trg_rates_after_update -> avg_rating recalculated)
UPDATE Rates SET score = 5 WHERE user_id = 3 AND game_id = 2;
SELECT game_id, title, avg_rating FROM Game WHERE game_id = 2;

-- DELETE
DELETE FROM Adds WHERE user_id = 3 AND game_id = 1;

-- SELECT: catalog browse with filters (genre, platform, max price)
SELECT DISTINCT g.game_id, g.title, g.base_price, g.avg_rating
FROM Game g
JOIN HasGenre hg   ON hg.game_id = g.game_id
JOIN Genre ge      ON ge.genre_id = hg.genre_id
JOIN OnPlatform op ON op.game_id = g.game_id
JOIN Platform p    ON p.platform_id = op.platform_id
WHERE ge.name = 'RPG' AND p.name = 'PC' AND g.base_price <= 60
ORDER BY g.avg_rating DESC;

-- JOIN + GROUP BY + HAVING + ORDER BY + aggregates: genre statistics
SELECT ge.name AS genre,
       COUNT(DISTINCT g.game_id) AS games,
       ROUND(AVG(r.score), 2)    AS avg_score,
       COUNT(r.score)            AS total_ratings
FROM Genre ge
JOIN HasGenre hg ON hg.genre_id = ge.genre_id
JOIN Game g      ON g.game_id = hg.game_id
LEFT JOIN Rates r ON r.game_id = g.game_id
GROUP BY ge.name
HAVING COUNT(r.score) >= 2
ORDER BY avg_score DESC;

-- Subquery: games rated above the overall average rating
SELECT title, avg_rating
FROM Game
WHERE avg_rating > (SELECT AVG(score) FROM Rates)
ORDER BY avg_rating DESC;

-- Correlated subquery: most active reviewer(s)
SELECT u.username,
       (SELECT COUNT(*) FROM Rates r WHERE r.user_id = u.user_id) AS ratings_given
FROM User u
WHERE u.role = 'player'
ORDER BY ratings_given DESC;

-- ---------- Full-text search ----------
SELECT game_id, title,
       MATCH(title) AGAINST ('valley' IN NATURAL LANGUAGE MODE) AS relevance
FROM Game
WHERE MATCH(title) AGAINST ('valley' IN NATURAL LANGUAGE MODE);

-- ---------- Views ----------
SELECT * FROM vw_top_rated_by_genre ORDER BY genre, avg_rating DESC;
SELECT * FROM vw_user_library;

-- ---------- Recommendation building blocks (user 1) ----------
-- Content score for every game user 1 has not rated
SELECT g.game_id, g.title, fn_content_score(1, g.game_id) AS content_score
FROM Game g
WHERE g.game_id NOT IN (SELECT game_id FROM Rates WHERE user_id = 1)
ORDER BY content_score DESC;

-- Collaborative score
CALL sp_collaborative_scores(1);

-- The app combines content, collaborative and trending (from MongoDB) and saves the result:
-- hybrid = 0.3*content + 0.5*collaborative + 0.2*trending
INSERT INTO Recommends (user_id, game_id, method, score) VALUES
  (1, 2, 'hybrid', 0.7700),
  (1, 4, 'hybrid', 0.1800)
ON DUPLICATE KEY UPDATE score = VALUES(score), method = VALUES(method), generated_at = CURRENT_TIMESTAMP;

SELECT g.title, r.score, r.generated_at
FROM Recommends r JOIN Game g ON g.game_id = r.game_id
WHERE r.user_id = 1
ORDER BY r.score DESC;

-- ---------- Transaction ----------
-- Success: user 1 buys Stardew Valley; it leaves their wishlist in the same transaction
CALL sp_purchase_game(1, 2);
SELECT * FROM Owns WHERE user_id = 1;
SELECT * FROM Adds WHERE user_id = 1;      -- (1,2) is gone

-- Failure (uncomment to try): buying it again violates the Owns primary key,
-- the handler rolls back and re-raises the error
-- CALL sp_purchase_game(1, 2);

-- ---------- Integrity checks (each should FAIL; uncomment to try) ----------
-- INSERT INTO Rates (user_id, game_id, score) VALUES (3, 1, 7);        -- CHECK score 1..5
-- INSERT INTO Rates (user_id, game_id, score) VALUES (1, 1, 3);        -- duplicate rating
-- INSERT INTO Rates (user_id, game_id, score) VALUES (99, 1, 3);       -- FK: no such user
-- INSERT INTO Game (title, base_price) VALUES ('Bad', -5);             -- CHECK price >= 0
-- INSERT INTO User (username, email, password_hash) VALUES ('x', 'not-an-email', 'h'); -- CHECK email
