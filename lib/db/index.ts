import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

const dbDir = process.env.DB_DIR || path.join(process.cwd(), "data");
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, "quiz.db");
const sqlite = new Database(dbPath);

sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });

try {
  sqlite.exec(`ALTER TABLE sessions ADD COLUMN scheduled_start_at INTEGER`);
} catch {}
try {
  sqlite.exec(`ALTER TABLE sessions ADD COLUMN scheduled_end_at INTEGER`);
} catch {}
try {
  sqlite.exec(`ALTER TABLE questions ADD COLUMN simulation_script TEXT`);
} catch {}
try {
  sqlite.exec(`ALTER TABLE questions ADD COLUMN simulation_n INTEGER`);
} catch {}
try {
  sqlite.exec(`ALTER TABLE questions ADD COLUMN simulation_results TEXT`);
} catch {}
try {
  sqlite.exec(`ALTER TABLE questions ADD COLUMN answer_source TEXT NOT NULL DEFAULT 'point'`);
} catch {}

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    admin_password TEXT NOT NULL,
    join_code TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'lobby',
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id),
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS team_session_name ON teams(session_id, name);
  CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL REFERENCES teams(id),
    username TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id),
    title TEXT NOT NULL,
    description TEXT,
    answer REAL NOT NULL,
    answer_type TEXT NOT NULL DEFAULT 'exact',
    range_tolerance REAL,
    max_points INTEGER NOT NULL DEFAULT 100,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    points_drop_off TEXT NOT NULL DEFAULT '[100,50,25]',
    status TEXT NOT NULL DEFAULT 'hidden',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS submissions (
    id TEXT PRIMARY KEY,
    question_id TEXT NOT NULL REFERENCES questions(id),
    team_id TEXT NOT NULL REFERENCES teams(id),
    attempt_number INTEGER NOT NULL,
    submission_type TEXT NOT NULL,
    answer_value REAL,
    range_min REAL,
    range_max REAL,
    is_correct INTEGER NOT NULL DEFAULT 0,
    points_awarded INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
`);
