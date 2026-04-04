import express from 'express';
import rateLimit from 'express-rate-limit';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_PASSWORD_LENGTH = 128;

// In-memory session store: token → { username, expiresAt }
const sessions = new Map();

function createSession(username) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { username, expiresAt: Date.now() + SESSION_TTL_MS });
  return token;
}

function getSessionUsername(token) {
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }
  return session.username;
}

// Clean up expired sessions every hour to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [token, session] of sessions.entries()) {
    if (now > session.expiresAt) {
      sessions.delete(token);
    }
  }
}, 60 * 60 * 1000).unref();

// Authenticate request: verify Bearer token belongs to the given username.
// Returns true on success; sends a 401 response and returns false on failure.
function requireAuth(req, res, requiredUsername) {
  const authHeader = req.headers['authorization'] ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: 'Nicht authentifiziert' });
    return false;
  }
  const sessionUsername = getSessionUsername(token);
  if (!sessionUsername || sessionUsername !== requiredUsername) {
    res.status(401).json({ error: 'Nicht authentifiziert' });
    return false;
  }
  return true;
}
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
const stmtDeleteUser = db.prepare('DELETE FROM users WHERE username = ?');
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
  if (typeof data.planName !== 'string' || data.planName.length > 200) return false;
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
  if (typeof password === 'string' && password.length > MAX_PASSWORD_LENGTH) {
    return res.status(400).json({ error: 'Passwort zu lang' });
  }

  let passwordHash = null;
  if (typeof password === 'string' && password.length > 0) {
    passwordHash = await bcrypt.hash(password, 12);
  }

  try {
    stmtCreateUser.run(username, passwordHash);
    const token = createSession(username);
    res.status(201).json({ username, token });
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
    const token = createSession(user.username);
    return res.json({ username: user.username, token });
  }

  const password = req.body?.password;
  if (typeof password !== 'string' || password.length === 0) {
    return res.status(401).json({ error: 'Passwort erforderlich', requiresPassword: true });
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    return res.status(400).json({ error: 'Passwort zu lang' });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Falsches Passwort' });
  }

  const token = createSession(user.username);
  res.json({ username: user.username, token });
});

// GET /api/plan/:username – load plan for a user
app.get('/api/plan/:username', apiLimiter, (req, res) => {
  const username = sanitizeUsername(req.params.username);
  if (!username) {
    return res.status(400).json({ error: 'Ungültiger Benutzername' });
  }

  if (!requireAuth(req, res, username)) return;

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

  if (!requireAuth(req, res, username)) return;

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

// DELETE /api/users/:username – delete user account (no auth required; consistent with
// the unauthenticated GET /api/users and POST /api/users endpoints for self-hosted use)
app.delete('/api/users/:username', apiLimiter, (req, res) => {
  const username = sanitizeUsername(req.params.username);
  if (!username) {
    return res.status(400).json({ error: 'Ungültiger Benutzername' });
  }

  try {
    const result = stmtDeleteUser.run(username);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }
    // Invalidate all sessions for this user
    for (const [token, session] of sessions.entries()) {
      if (session.username === username) {
        sessions.delete(token);
      }
    }
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Fehler beim Löschen des Benutzers' });
  }
});

// Fallback route for SPA
app.get('*', apiLimiter, (req, res) => {
  res.sendFile(join(DIST_DIR, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`StudiumsPlaner server running on port ${PORT}`);
});
