-- Multi-Tenant Marketing Hub Database Schema
-- All tables include company_id for multi-company support

-- Companies table (stores company configurations)
CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  config_json TEXT NOT NULL,
  active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Posts table (all social media posts across all companies)
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id TEXT NOT NULL,
  content TEXT NOT NULL,
  platform TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  scheduled_at DATETIME,
  posted_at DATETIME,
  external_id TEXT,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

-- Analytics table (metrics per company per platform)
CREATE TABLE IF NOT EXISTS analytics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  metric TEXT NOT NULL,
  value REAL NOT NULL,
  date DATE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

-- Post queue (scheduled posts waiting to be published)
CREATE TABLE IF NOT EXISTS post_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id TEXT NOT NULL,
  post_id INTEGER NOT NULL,
  scheduled_time DATETIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  processed_at DATETIME,
  FOREIGN KEY (company_id) REFERENCES companies(id),
  FOREIGN KEY (post_id) REFERENCES posts(id)
);

-- Activity log (agent actions, voice commands, system events)
CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id TEXT,
  agent TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

-- Website monitoring results
CREATE TABLE IF NOT EXISTS website_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id TEXT NOT NULL,
  website_url TEXT NOT NULL,
  status_code INTEGER,
  response_time_ms INTEGER,
  is_up INTEGER NOT NULL,
  error_message TEXT,
  checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_posts_company_status ON posts(company_id, status);
CREATE INDEX IF NOT EXISTS idx_posts_scheduled ON posts(scheduled_at) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_analytics_company_date ON analytics(company_id, date);
CREATE INDEX IF NOT EXISTS idx_post_queue_scheduled ON post_queue(scheduled_time, status);
CREATE INDEX IF NOT EXISTS idx_activity_company ON activity_log(company_id, created_at);
CREATE INDEX IF NOT EXISTS idx_website_checks_company ON website_checks(company_id, checked_at);
