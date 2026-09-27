// db.js — SQLite database (file-based, zero external DB needed — perfect for free hosting)
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'data.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  elo INTEGER NOT NULL DEFAULT 1000,
  gsi_token TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  owner_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (owner_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS team_members (
  team_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (team_id, user_id),
  FOREIGN KEY (team_id) REFERENCES teams(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS invites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id INTEGER NOT NULL,
  inviter_id INTEGER NOT NULL,
  invited_user_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | accepted | declined
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (team_id) REFERENCES teams(id),
  FOREIGN KEY (invited_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  mode TEXT NOT NULL,        -- 'premier' | 'mm' | 'unknown'
  map TEXT,
  result TEXT NOT NULL,      -- 'win' | 'loss' | 'tie'
  score_team INTEGER,
  score_enemy INTEGER,
  elo_before INTEGER NOT NULL,
  elo_after INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS gsi_sessions (
  gsi_token TEXT PRIMARY KEY,
  last_map TEXT,
  last_phase TEXT,
  last_score_team INTEGER,
  last_score_enemy INTEGER,
  last_mode TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

module.exports = db;
