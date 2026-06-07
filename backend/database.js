import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import path from "path";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, "data.db"));

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    plan TEXT DEFAULT 'business',
    status TEXT DEFAULT 'active',
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    company_id TEXT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'admin',
    is_superadmin INTEGER DEFAULT 0,
    name TEXT,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS departments (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT DEFAULT '💬',
    system_prompt TEXT,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS chats (
    id TEXT PRIMARY KEY,
    department_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    title TEXT,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    department_id TEXT NOT NULL,
    company_id TEXT NOT NULL,
    name TEXT NOT NULL,
    size INTEGER,
    content TEXT,
    uploaded_by TEXT,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS artifacts (
    id TEXT PRIMARY KEY,
    department_id TEXT NOT NULL,
    company_id TEXT NOT NULL,
    title TEXT,
    content TEXT NOT NULL,
    created_by TEXT,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS department_users (
    department_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    PRIMARY KEY (department_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS crm_leads (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    status TEXT DEFAULT 'new',
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    source TEXT DEFAULT 'manual',
    custom_fields TEXT DEFAULT '{}',
    profit REAL,
    assigned_to TEXT,
    created_by TEXT,
    created_at TEXT,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS crm_comments (
    id TEXT PRIMARY KEY,
    lead_id TEXT NOT NULL,
    user_id TEXT,
    user_name TEXT,
    text TEXT NOT NULL,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS crm_tasks (
    id TEXT PRIMARY KEY,
    lead_id TEXT NOT NULL,
    title TEXT NOT NULL,
    done INTEGER DEFAULT 0,
    created_by TEXT,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS crm_history (
    id TEXT PRIMARY KEY,
    lead_id TEXT NOT NULL,
    user_id TEXT,
    user_name TEXT,
    action TEXT NOT NULL,
    details TEXT,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS crm_tags (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#6366F1',
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS crm_lead_tags (
    lead_id TEXT NOT NULL,
    tag_id TEXT NOT NULL,
    PRIMARY KEY (lead_id, tag_id)
  );

  CREATE TABLE IF NOT EXISTS crm_columns (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#6366F1',
    position INTEGER DEFAULT 0,
    is_default INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS crm_fields (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    name TEXT NOT NULL,
    field_type TEXT DEFAULT 'text',
    position INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS crm_lead_files (
    id TEXT PRIMARY KEY,
    lead_id TEXT NOT NULL,
    company_id TEXT NOT NULL,
    name TEXT NOT NULL,
    size INTEGER,
    mime_type TEXT,
    data TEXT NOT NULL,
    uploaded_by TEXT,
    uploader_name TEXT,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS crm_notifications (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    lead_id TEXT,
    lead_name TEXT,
    message TEXT NOT NULL,
    read INTEGER DEFAULT 0,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS crm_integrations (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    name TEXT NOT NULL,
    api_key TEXT UNIQUE NOT NULL,
    form_fields TEXT DEFAULT '[]',
    active INTEGER DEFAULT 1,
    created_at TEXT,
    updated_at TEXT
  );
`);

// ── Migrations (safe — ignore if column exists) ───────────────────────────────
const migrations = [
  "ALTER TABLE crm_leads ADD COLUMN profit REAL",
  "ALTER TABLE companies ADD COLUMN status TEXT DEFAULT 'active'",
  "ALTER TABLE users ADD COLUMN is_superadmin INTEGER DEFAULT 0",
  "ALTER TABLE users ADD COLUMN company_id TEXT",
  "ALTER TABLE crm_tasks ADD COLUMN due_date TEXT",
  "ALTER TABLE crm_tasks ADD COLUMN priority TEXT DEFAULT 'normal'",
];
for (const sql of migrations) {
  try { db.prepare(sql).run(); } catch { /* already exists */ }
}

// ── Seed superadmin ───────────────────────────────────────────────────────────
const existing = db.prepare("SELECT id FROM users WHERE email = 'admin@aioffice.ru'").get();
if (!existing) {
  const hash = bcrypt.hashSync("admin", 10);
  db.prepare(
    "INSERT INTO users (id, company_id, email, password_hash, role, is_superadmin, name, created_at) VALUES (?, '', ?, ?, 'superadmin', 1, 'Superadmin', ?)"
  ).run(randomUUID(), "admin@aioffice.ru", hash, new Date().toISOString());
}

// ── Activate existing companies that have no status ───────────────────────────
db.prepare("UPDATE companies SET status = 'active' WHERE status IS NULL").run();

export default db;
