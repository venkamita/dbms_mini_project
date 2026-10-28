-- =============================================================
-- GameMatch — advanced SQL features
--   1. Views           vw_top_rated_by_genre, vw_user_library
--   2. Triggers        keep Game.avg_rating in sync with Rates
--   3. Function        fn_content_score      (content-based score)
--   4. Procedures      sp_collaborative_scores (Pearson-based CF)
--                      sp_purchase_game      (5. Transaction)
--   6. Indexing / full-text search are defined in 01_schema.sql
-- =============================================================
USE gamematch;

-- ---------- 1. Views ----------

CREATE OR REPLACE VIEW vw_top_rated_by_genre AS
SELECT ge.name AS genre, g.game_id, g.title, g.avg_rating
FROM Game g
JOIN HasGenre hg ON hg.game_id = g.game_id
JOIN Genre ge    ON ge.genre_id = hg.genre_id
WHERE g.avg_rating >= 4.0;

CREATE OR REPLACE VIEW vw_user_library AS
SELECT o.user_id, u.username, g.game_id, g.title, o.price_paid, o.purchased_at
FROM Owns o
JOIN User u ON u.user_id = o.user_id
JOIN Game g ON g.game_id = o.game_id;

-- ---------- 2. Triggers ----------
-- avg_rating is a denormalised column; three triggers keep it correct
-- whenever a rating is added, changed or removed.

DROP TRIGGER IF EXISTS trg_rates_after_insert;
DROP TRIGGER IF EXISTS trg_rates_after_update;
DROP TRIGGER IF EXISTS trg_rates_after_delete;

DELIMITER //

CREATE TRIGGER trg_rates_after_insert AFTER INSERT ON Rates
FOR EACH ROW
BEGIN
  UPDATE Game
  SET avg_rating = COALESCE((SELECT AVG(score) FROM Rates WHERE game_id = NEW.game_id), 0)
  WHERE game_id = NEW.game_id;
END//

CREATE TRIGGER trg_rates_after_update AFTER UPDATE ON Rates
FOR EACH ROW
BEGIN
  UPDATE Game
  SET avg_rating = COALESCE((SELECT AVG(score) FROM Rates WHERE game_id = NEW.game_id), 0)
  WHERE game_id = NEW.game_id;
END//

CREATE TRIGGER trg_rates_after_delete AFTER DELETE ON Rates
FOR EACH ROW
BEGIN
  UPDATE Game
  SET avg_rating = COALESCE((SELECT AVG(score) FROM Rates WHERE game_id = OLD.game_id), 0)
  WHERE game_id = OLD.game_id;
END//

-- ---------- 3. Stored function: content-based score ----------
-- User's weight for a genre = average score they gave to games of that genre (0 if none).
-- Content score of a game  = average of those weights over the game's genres, divided by 5
-- so the result is in [0, 1].

DROP FUNCTION IF EXISTS fn_content_score//
CREATE FUNCTION fn_content_score(p_user INT, p_game INT)
RETURNS DECIMAL(5,4)
READS SQL DATA
BEGIN
  DECLARE v_score DECIMAL(5,4);

  SELECT COALESCE(AVG(COALESCE(ug.weight, 0)), 0) / 5
  INTO v_score
  FROM HasGenre hg
  LEFT JOIN (
      SELECT hg2.genre_id, AVG(r.score) AS weight
      FROM Rates r
      JOIN HasGenre hg2 ON hg2.game_id = r.game_id
      WHERE r.user_id = p_user
      GROUP BY hg2.genre_id
  ) ug ON ug.genre_id = hg.genre_id
  WHERE hg.game_id = p_game;

  RETURN v_score;
END//

-- ---------- 4. Stored procedure: collaborative-filtering scores ----------
-- Step 1: Pearson-style similarity between p_user and every other user,
--         computed on games both have rated (scores centred on each user's mean).
--         Only neighbours with >= 2 common games and positive similarity count.
-- Step 2: For each game p_user has neither rated nor owned, predict a score as the
--         similarity-weighted average of neighbours' ratings, divided by 5.

DROP PROCEDURE IF EXISTS sp_collaborative_scores//
CREATE PROCEDURE sp_collaborative_scores(IN p_user INT)
BEGIN
  WITH user_avg AS (
      SELECT user_id, AVG(score) AS avg_score
      FROM Rates GROUP BY user_id
  ),
  similarity AS (
      SELECT r2.user_id AS neighbour,
             COUNT(*)   AS common_games,
             SUM((r1.score - a1.avg_score) * (r2.score - a2.avg_score)) /
             NULLIF(SQRT(SUM(POW(r1.score - a1.avg_score, 2))) *
                    SQRT(SUM(POW(r2.score - a2.avg_score, 2))), 0) AS sim
      FROM Rates r1
      JOIN Rates r2    ON r2.game_id = r1.game_id AND r2.user_id <> r1.user_id
      JOIN user_avg a1 ON a1.user_id = r1.user_id
      JOIN user_avg a2 ON a2.user_id = r2.user_id
      WHERE r1.user_id = p_user
      GROUP BY r2.user_id
      HAVING common_games >= 2
  )
  SELECT r.game_id,
         ROUND(SUM(s.sim * r.score) / SUM(s.sim) / 5, 4) AS collab_score
  FROM similarity s
  JOIN Rates r ON r.user_id = s.neighbour
  WHERE s.sim > 0
    AND r.game_id NOT IN (SELECT game_id FROM Rates WHERE user_id = p_user)
    AND r.game_id NOT IN (SELECT game_id FROM Owns  WHERE user_id = p_user)
  GROUP BY r.game_id
  ORDER BY collab_score DESC;
END//

-- ---------- 5. Stored procedure with a transaction: purchase ----------
-- Atomically: add the game to the library at its current price AND remove it
-- from the wishlist. Any error (already owned -> duplicate PK, unknown game,
-- unknown user -> FK) rolls back both steps.

DROP PROCEDURE IF EXISTS sp_purchase_game//
CREATE PROCEDURE sp_purchase_game(IN p_user INT, IN p_game INT)
BEGIN
  DECLARE v_price DECIMAL(8,2);

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;

    SELECT base_price INTO v_price
    FROM Game WHERE game_id = p_game
    FOR UPDATE;

    IF v_price IS NULL THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Game does not exist';
    END IF;

    INSERT INTO Owns (user_id, game_id, price_paid) VALUES (p_user, p_game, v_price);
    DELETE FROM Adds WHERE user_id = p_user AND game_id = p_game;

  COMMIT;
END//

DELIMITER ;
