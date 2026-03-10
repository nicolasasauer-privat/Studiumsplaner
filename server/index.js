import express from 'express';
import rateLimit from 'express-rate-limit';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || '/data/studiumsplaner.db';
const DIST_DIR = join(__dirname, '..', 'dist');

// Ensure data directory exists
const dbDir = dirname(DB_PATH);
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

// Initialize database
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT
  );
  CREATE TABLE IF NOT EXISTS plans (
    user_id INTEGER NOT NULL UNIQUE,
    plan_data TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// Prepared statements
const stmtGetAllUsers = db.prepare('SELECT username FROM users ORDER BY username');
const stmtGetUserByName = db.prepare('SELECT id, username, password_hash FROM users WHERE username = ?');
const stmtCreateUser = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)');
const stmtGetPlan = db.prepare('SELECT plan_data FROM plans WHERE user_id = ?');
const stmtUpsertPlan = db.prepare(`
  INSERT INTO plans (user_id, plan_data) VALUES (?, ?)
  ON CONFLICT(user_id) DO UPDATE SET plan_data = excluded.plan_data
`);

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(express.json({ limit: '5mb' }));
app.use(express.static(DIST_DIR));

// Validate that a value looks like a StudyPlan
function isValidStudyPlan(data) {
  if (!data || typeof data !== 'object') return false;
  if (typeof data.planName !== 'string') return false;
  if (typeof data.regularSemesters !== 'number') return false;
  if (data.startSeason !== 'winter' && data.startSeason !== 'summer') return false;
  if (typeof data.isConfigured !== 'boolean') return false;
  if (!Array.isArray(data.semesters)) return false;
  if (!Array.isArray(data.parkingLot)) return false;
  return true;
}

// Sanitize username: trim and check length/characters
function sanitizeUsername(username) {
  if (typeof username !== 'string') return null;
  const trimmed = username.trim();
  if (trimmed.length < 1 || trimmed.length > 50) return null;
  if (!/^[-a-zA-Z0-9_ ]+$/.test(trimmed)) return null;
  return trimmed;
}

// GET /api/users – list all usernames
app.get('/api/users', apiLimiter, (_req, res) => {
  try {
    const rows = stmtGetAllUsers.all();
    res.json(rows.map((r) => r.username));
  } catch {
    res.status(500).json({ error: 'Fehler beim Laden der Benutzer' });
  }
});

// POST /api/users – create a new user (optional password)
app.post('/api/users', apiLimiter, async (req, res) => {
  const username = sanitizeUsername(req.body?.username);
  if (!username) {
    return res.status(400).json({ error: 'Ungültiger Benutzername' });
  }

  const password = req.body?.password;
  let passwordHash = null;
  if (typeof password === 'string' && password.length > 0) {
    passwordHash = await bcrypt.hash(password, 12);
  }

  try {
    stmtCreateUser.run(username, passwordHash);
    res.status(201).json({ username });
  } catch (err) {
    if (
      err.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
      (err.code === 'SQLITE_CONSTRAINT' && err.message?.includes('UNIQUE'))
    ) {
      return res.status(409).json({ error: 'Benutzername bereits vergeben' });
    }
    res.status(500).json({ error: 'Fehler beim Erstellen des Benutzers' });
  }
});

// POST /api/login – validate username + password
app.post('/api/login', apiLimiter, async (req, res) => {
  const username = sanitizeUsername(req.body?.username);
  if (!username) {
    return res.status(400).json({ error: 'Ungültiger Benutzername' });
  }

  const user = stmtGetUserByName.get(username);
  if (!user) {
    return res.status(404).json({ error: 'Benutzer nicht gefunden' });
  }

  // If user has no password, allow login without password
  if (user.password_hash === null) {
    return res.json({ username: user.username, requiresPassword: false });
  }

  const password = req.body?.password;
  if (typeof password !== 'string' || password.length === 0) {
    return res.status(401).json({ error: 'Passwort erforderlich', requiresPassword: true });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Falsches Passwort' });
  }

  res.json({ username: user.username, requiresPassword: false });
});

// GET /api/plan/:username – load plan for a user
app.get('/api/plan/:username', apiLimiter, (req, res) => {
  const username = sanitizeUsername(req.params.username);
  if (!username) {
    return res.status(400).json({ error: 'Ungültiger Benutzername' });
  }

  const user = stmtGetUserByName.get(username);
  if (!user) {
    return res.status(404).json({ error: 'Benutzer nicht gefunden' });
  }

  const row = stmtGetPlan.get(user.id);
  if (!row) {
    return res.status(404).json({ error: 'Kein Plan gefunden' });
  }

  try {
    res.json(JSON.parse(row.plan_data));
  } catch {
    res.status(500).json({ error: 'Fehler beim Lesen des Plans' });
  }
});

// POST /api/plan/:username – save plan for a user
app.post('/api/plan/:username', apiLimiter, (req, res) => {
  const username = sanitizeUsername(req.params.username);
  if (!username) {
    return res.status(400).json({ error: 'Ungültiger Benutzername' });
  }

  if (!isValidStudyPlan(req.body)) {
    return res.status(400).json({ error: 'Ungültiges Plan-Format' });
  }

  const user = stmtGetUserByName.get(username);
  if (!user) {
    return res.status(404).json({ error: 'Benutzer nicht gefunden' });
  }

  try {
    stmtUpsertPlan.run(user.id, JSON.stringify(req.body));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Fehler beim Speichern des Plans' });
  }
});

// Fallback route for SPA
app.get('*', apiLimiter, (req, res) => {
  res.sendFile(join(DIST_DIR, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`StudiumsPlaner server running on port ${PORT}`);
});
