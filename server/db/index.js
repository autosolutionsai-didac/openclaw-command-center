import Database from 'better-sqlite3';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync, mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'data', 'marketing-hub.db');

let db = null;

export function initDatabase() {
  if (db) return db;

  // Ensure data directory exists
  const dbDir = dirname(DB_PATH);
  mkdirSync(dbDir, { recursive: true });

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  // Load and execute schema
  const schemaPath = join(__dirname, 'schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8');
  db.exec(schema);

  console.log('[db] Database initialized at', DB_PATH);
  return db;
}

export function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

// Company operations
export function createCompany(company) {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO companies (id, name, config_json, active)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      config_json = excluded.config_json,
      active = excluded.active,
      updated_at = CURRENT_TIMESTAMP
  `);
  return stmt.run(company.id, company.name, JSON.stringify(company), company.active !== false ? 1 : 0);
}

export function getCompany(companyId) {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM companies WHERE id = ? AND active = 1');
  const row = stmt.get(companyId);
  if (row) {
    row.config = JSON.parse(row.config_json);
  }
  return row;
}

export function getAllCompanies() {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM companies WHERE active = 1 ORDER BY created_at');
  const rows = stmt.all();
  return rows.map(row => ({
    ...row,
    config: JSON.parse(row.config_json)
  }));
}

export function getActiveCompany() {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM companies WHERE active = 1 ORDER BY created_at LIMIT 1');
  const row = stmt.get();
  if (row) {
    row.config = JSON.parse(row.config_json);
  }
  return row;
}

// Post operations
export function createPost(post) {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO posts (company_id, content, platform, status, scheduled_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  return stmt.run(post.company_id, post.content, post.platform, post.status || 'draft', post.scheduled_at || null);
}

export function getPostsByCompany(companyId, status = null, limit = 50) {
  const db = getDatabase();
  let query = 'SELECT * FROM posts WHERE company_id = ?';
  const params = [companyId];
  
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  
  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);
  
  const stmt = db.prepare(query);
  return stmt.all(...params);
}

export function updatePostStatus(postId, status, postedAt = null) {
  const db = getDatabase();
  const stmt = db.prepare(`
    UPDATE posts 
    SET status = ?, posted_at = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  return stmt.run(status, postedAt || new Date().toISOString(), postId);
}

// Analytics operations
export function saveAnalytics(companyId, platform, metric, value) {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO analytics (company_id, platform, metric, value, date)
    VALUES (?, ?, ?, ?, date('now'))
  `);
  return stmt.run(companyId, platform, metric, value);
}

export function getAnalytics(companyId, platform = null, days = 30) {
  const db = getDatabase();
  let query = `
    SELECT * FROM analytics 
    WHERE company_id = ? AND date >= date('now', ?)
    ORDER BY date DESC
  `;
  const params = [companyId, `-${days} days`];
  
  if (platform) {
    query += ' AND platform = ?';
    params.push(platform);
  }
  
  const stmt = db.prepare(query);
  return stmt.all(...params);
}

// Activity log operations
export function logActivity(companyId, agent, action, details = null) {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO activity_log (company_id, agent, action, details)
    VALUES (?, ?, ?, ?)
  `);
  return stmt.run(companyId, agent, action, details ? JSON.stringify(details) : null);
}

export function getRecentActivity(companyId = null, limit = 100) {
  const db = getDatabase();
  let query = 'SELECT * FROM activity_log';
  const params = [];
  
  if (companyId) {
    query += ' WHERE company_id = ?';
    params.push(companyId);
  }
  
  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);
  
  const stmt = db.prepare(query);
  return stmt.all(...params);
}

// Website check operations
export function saveWebsiteCheck(companyId, url, statusCode, responseTime, isUp, error = null) {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO website_checks (company_id, website_url, status_code, response_time_ms, is_up, error_message)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  return stmt.run(companyId, url, statusCode, responseTime, isUp ? 1 : 0, error);
}

export function getLatestWebsiteChecks(companyId, limit = 10) {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM website_checks 
    WHERE company_id = ? 
    ORDER BY checked_at DESC 
    LIMIT ?
  `);
  return stmt.all(companyId, limit);
}

export default {
  initDatabase,
  getDatabase,
  createCompany,
  getCompany,
  getAllCompanies,
  getActiveCompany,
  createPost,
  getPostsByCompany,
  updatePostStatus,
  saveAnalytics,
  getAnalytics,
  logActivity,
  getRecentActivity,
  saveWebsiteCheck,
  getLatestWebsiteChecks
};
