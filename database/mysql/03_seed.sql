-- =============================================================
-- GameMatch — sample data (matches the worked example in docs/PROJECT_SPEC.md §9)
-- password_hash values are placeholders; the app stores real bcrypt hashes.
-- =============================================================
USE gamematch;

INSERT INTO User (user_id, username, email, password_hash, role) VALUES
  (1, 'u1_arjun', 'arjun@example.com', '$2b$10$placeholderhashplaceholderhashplacehold', 'player'),
  (2, 'u2_meera', 'meera@example.com', '$2b$10$placeholderhashplaceholderhashplacehold', 'player'),
  (3, 'u3_rohan', 'rohan@example.com', '$2b$10$placeholderhashplaceholderhashplacehold', 'player'),
  (4, 'u4_kavya', 'kavya@example.com', '$2b$10$placeholderhashplaceholderhashplacehold', 'player'),
  (5, 'admin',    'admin@example.com', '$2b$10$placeholderhashplaceholderhashplacehold', 'admin');

INSERT INTO Genre (genre_id, name) VALUES
  (1, 'Action'), (2, 'RPG'), (3, 'Simulation'), (4, 'Roguelike'), (5, 'Platformer'), (6, 'Indie');

INSERT INTO Platform (platform_id, name) VALUES
  (1, 'PC'), (2, 'PlayStation'), (3, 'Xbox'), (4, 'Switch');

INSERT INTO Game (game_id, title, publisher, base_price, release_date) VALUES
  (1, 'Elden Ring',     'Bandai Namco',     59.99, '2022-02-25'),
  (2, 'Stardew Valley', 'ConcernedApe',     14.99, '2016-02-26'),
  (3, 'Hades',          'Supergiant Games', 24.99, '2020-09-17'),
  (4, 'Celeste',        'Maddy Makes Games',19.99, '2018-01-25');

INSERT INTO HasGenre (game_id, genre_id) VALUES
  (1, 1), (1, 2),     -- Elden Ring: Action, RPG
  (2, 3), (2, 2),     -- Stardew Valley: Simulation, RPG
  (3, 1), (3, 4),     -- Hades: Action, Roguelike
  (4, 5), (4, 6);     -- Celeste: Platformer, Indie

INSERT INTO OnPlatform (game_id, platform_id) VALUES
  (1, 1), (1, 2), (1, 3),
  (2, 1), (2, 2), (2, 3), (2, 4),
  (3, 1), (3, 2), (3, 4),
  (4, 1), (4, 4);

-- Ratings (the triggers fill Game.avg_rating automatically)
INSERT INTO Rates (user_id, game_id, score, review_text) VALUES
  (1, 1, 5, 'Huge world, brutal bosses.'),
  (1, 3, 4, 'Great runs, a bit repetitive.'),
  (2, 1, 4, NULL),
  (2, 2, 5, 'So relaxing.'),
  (2, 3, 3, NULL),
  (3, 2, 4, NULL),
  (3, 4, 5, 'Tight controls.'),
  (4, 1, 5, NULL),
  (4, 3, 5, NULL),
  (4, 4, 2, 'Too hard for me.');

INSERT INTO Adds (user_id, game_id) VALUES
  (1, 2), (3, 1), (4, 2);

-- Library rows go through the transactional procedure
CALL sp_purchase_game(2, 2);
CALL sp_purchase_game(3, 4);
