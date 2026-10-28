-- =============================================================
-- GameMatch — MySQL schema (DDL: CREATE)
-- Tables follow the hand-drawn relational schema (docs/relational-schema.png):
--   User, Game, Genre, Platform, Rates, Adds, Owns, Recommends, HasGenre, OnPlatform
-- Validation is done at the database level (NOT NULL, CHECK, UNIQUE, ENUM, FK).
-- =============================================================

DROP DATABASE IF EXISTS gamematch;
CREATE DATABASE gamematch;
USE gamematch;

-- ---------- Entities ----------

CREATE TABLE User (
  user_id       INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(50)  NOT NULL UNIQUE,
  email         VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('admin','player') NOT NULL DEFAULT 'player',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_user_email CHECK (email LIKE '%_@_%._%')
);

CREATE TABLE Game (
  game_id      INT AUTO_INCREMENT PRIMARY KEY,
  title        VARCHAR(150) NOT NULL,
  publisher    VARCHAR(100),
  base_price   DECIMAL(8,2) NOT NULL DEFAULT 0.00,
  avg_rating   DECIMAL(3,2) NOT NULL DEFAULT 0.00,   -- maintained by triggers
  release_date DATE,
  CONSTRAINT chk_game_price  CHECK (base_price >= 0),
  CONSTRAINT chk_game_rating CHECK (avg_rating BETWEEN 0 AND 5),
  FULLTEXT INDEX ft_game_title (title)                -- full-text search on titles
);

CREATE TABLE Genre (
  genre_id INT AUTO_INCREMENT PRIMARY KEY,
  name     VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE Platform (
  platform_id INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(50) NOT NULL UNIQUE
);

-- ---------- M:N relationships between Game and Genre / Platform ----------

CREATE TABLE HasGenre (
  game_id  INT NOT NULL,
  genre_id INT NOT NULL,
  PRIMARY KEY (game_id, genre_id),
  FOREIGN KEY (game_id)  REFERENCES Game(game_id)   ON DELETE CASCADE,
  FOREIGN KEY (genre_id) REFERENCES Genre(genre_id) ON DELETE CASCADE
);

CREATE TABLE OnPlatform (
  game_id     INT NOT NULL,
  platform_id INT NOT NULL,
  PRIMARY KEY (game_id, platform_id),
  FOREIGN KEY (game_id)     REFERENCES Game(game_id)         ON DELETE CASCADE,
  FOREIGN KEY (platform_id) REFERENCES Platform(platform_id) ON DELETE CASCADE
);

-- ---------- M:N relationships between User and Game ----------

-- Rates: a user rates a game at most once (composite PK enforces it)
CREATE TABLE Rates (
  user_id     INT NOT NULL,
  game_id     INT NOT NULL,
  score       TINYINT NOT NULL,
  review_text TEXT,
  rated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, game_id),
  CONSTRAINT chk_rates_score CHECK (score BETWEEN 1 AND 5),
  FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE CASCADE,
  FOREIGN KEY (game_id) REFERENCES Game(game_id) ON DELETE CASCADE
);

-- Adds: wishlist
CREATE TABLE Adds (
  user_id  INT NOT NULL,
  game_id  INT NOT NULL,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, game_id),
  FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE CASCADE,
  FOREIGN KEY (game_id) REFERENCES Game(game_id) ON DELETE CASCADE
);

-- Owns: library (filled only through sp_purchase_game)
CREATE TABLE Owns (
  user_id      INT NOT NULL,
  game_id      INT NOT NULL,
  price_paid   DECIMAL(8,2) NOT NULL,
  purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, game_id),
  CONSTRAINT chk_owns_price CHECK (price_paid >= 0),
  FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE CASCADE,
  FOREIGN KEY (game_id) REFERENCES Game(game_id) ON DELETE CASCADE
);

-- Recommends: latest recommendation per (user, game), overwritten on recompute
CREATE TABLE Recommends (
  user_id      INT NOT NULL,
  game_id      INT NOT NULL,
  method       ENUM('content','collaborative','trending','hybrid') NOT NULL DEFAULT 'hybrid',
  score        DECIMAL(5,4) NOT NULL,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, game_id),
  CONSTRAINT chk_rec_score CHECK (score BETWEEN 0 AND 1),
  FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE CASCADE,
  FOREIGN KEY (game_id) REFERENCES Game(game_id) ON DELETE CASCADE
);

-- ---------- Secondary indexes ----------
-- Composite PKs index (user_id, game_id); these cover lookups by game.
CREATE INDEX idx_rates_game ON Rates(game_id);
CREATE INDEX idx_hasgenre_genre ON HasGenre(genre_id);
CREATE INDEX idx_game_release ON Game(release_date);
