import Database from "better-sqlite3";
import path from "path";

const dbPath =
  process.env.NODE_ENV === "production"
    ? "/data/data.db"
    : path.resolve("./data.db");

console.log("Using SQLite database at:", dbPath);


// Initialize SQLite database (file-based, not memory)
const db = new Database("data.db");

// Create table if not exists
db.prepare(`
  CREATE TABLE IF NOT EXISTS analyses (
    id TEXT PRIMARY KEY,
    value TEXT UNIQUE NOT NULL,
    length INTEGER,
    is_palindrome BOOLEAN,
    unique_characters INTEGER,
    word_count INTEGER,
    character_frequency_map TEXT,
    sha256_hash TEXT,
    created_at TEXT
  )
`).run();


export default db;
