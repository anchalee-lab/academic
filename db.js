/**
 * Database Module for Hatyaiwittayalai School Timetable System
 * รองรับทั้ง:
 * 1. PostgreSQL (เมื่อตั้งค่า DATABASE_URL หรือ POSTGRES_URL เช่น Neon / Supabase / Vercel Postgres)
 * 2. SQLite (สำหรับ Local Development โดยสร้าง data/database.sqlite อัตโนมัติ)
 * 3. In-memory / Tmp Fallback (สำหรับกรณีฉุกเฉินบน Serverless ที่ยังไม่ได้ต่อ Postgres)
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const os = require('os');

// Initial data paths
const DATA_DIR = path.join(__dirname, 'data');
const SEED_ISSUES_PATH = path.join(DATA_DIR, 'issues.json');
const SEED_AUTH_PATH = path.join(DATA_DIR, 'auth.json');
const SQLITE_FILE = path.join(DATA_DIR, 'database.sqlite');
const TMP_ISSUES_PATH = path.join(os.tmpdir(), 'issues.json');

// Mappers
function rowToIssue(row) {
  if (!row) return null;
  return {
    id: row.id,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
    reporterName: row.reporter_name,
    reporterRole: row.reporter_role || 'นักเรียน',
    reporterPhone: row.reporter_phone,
    reporterEmail: row.reporter_email || '',
    category: row.category,
    targetName: row.target_name,
    issueType: row.issue_type,
    urgency: row.urgency || 'normal',
    dayPeriod: row.day_period || 'ไม่ระบุ',
    description: row.description,
    status: row.status || 'pending',
    adminResponse: row.admin_response || null,
    resolvedBy: row.resolved_by || null,
    resolvedAt: row.resolved_at ? new Date(row.resolved_at).toISOString() : null
  };
}

function rowToUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    password: row.password,
    fullName: row.full_name,
    role: row.role,
    position: row.position,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null
  };
}

// Load seed data helpers
function getSeedUsers() {
  if (fs.existsSync(SEED_AUTH_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(SEED_AUTH_PATH, 'utf-8')).users || [];
    } catch (e) {
      console.warn('Failed to read seed auth.json:', e.message);
    }
  }
  return [
    {
      username: 'admin',
      password: 'admin2569',
      fullName: 'ครูผู้ดูแลระบบงานจัดตารางเรียน',
      role: 'head_schedule',
      position: 'หัวหน้างานจัดตารางเรียน'
    },
    {
      username: 'schedule',
      password: 'yw69schedule',
      fullName: 'เจ้าหน้าที่งานจัดตารางเรียน',
      role: 'schedule_staff',
      position: 'เจ้าหน้าที่งานจัดตารางเรียน'
    }
  ];
}

function getSeedIssues() {
  if (fs.existsSync(SEED_ISSUES_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(SEED_ISSUES_PATH, 'utf-8')) || [];
    } catch (e) {
      console.warn('Failed to read seed issues.json:', e.message);
    }
  }
  return [];
}

// ========================================================
// 1. PostgreSQL Adapter
// ========================================================
class PostgresDatabase {
  constructor(connectionString) {
    this.connectionString = connectionString;
    const { Pool } = require('pg');
    const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
    this.pool = new Pool({
      connectionString,
      ssl: isLocal ? false : { rejectUnauthorized: false }
    });
  }

  async init() {
    // Create tables
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        role VARCHAR(100) NOT NULL DEFAULT 'staff',
        position VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS issues (
        id VARCHAR(50) PRIMARY KEY,
        reporter_name VARCHAR(255) NOT NULL,
        reporter_role VARCHAR(100) NOT NULL DEFAULT 'นักเรียน',
        reporter_phone VARCHAR(100) NOT NULL,
        reporter_email VARCHAR(255),
        category VARCHAR(50) NOT NULL,
        target_name VARCHAR(255) NOT NULL,
        issue_type VARCHAR(255) NOT NULL,
        urgency VARCHAR(50) NOT NULL DEFAULT 'normal',
        day_period VARCHAR(255),
        description TEXT NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        admin_response TEXT,
        resolved_by VARCHAR(255),
        resolved_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
      CREATE INDEX IF NOT EXISTS idx_issues_category ON issues(category);
      CREATE INDEX IF NOT EXISTS idx_issues_created_at ON issues(created_at DESC);
    `);

    // Seed users if empty
    const userCountRes = await this.pool.query('SELECT COUNT(*) as count FROM users');
    if (parseInt(userCountRes.rows[0].count, 10) === 0) {
      const seedUsers = getSeedUsers();
      for (const u of seedUsers) {
        await this.pool.query(
          `INSERT INTO users (username, password, full_name, role, position)
           VALUES ($1, $2, $3, $4, $5) ON CONFLICT (username) DO NOTHING`,
          [u.username, u.password, u.fullName, u.role, u.position]
        );
      }
    }

    // Seed issues if empty
    const issueCountRes = await this.pool.query('SELECT COUNT(*) as count FROM issues');
    if (parseInt(issueCountRes.rows[0].count, 10) === 0) {
      const seedIssues = getSeedIssues();
      for (const item of seedIssues) {
        await this.pool.query(
          `INSERT INTO issues (
            id, reporter_name, reporter_role, reporter_phone, reporter_email,
            category, target_name, issue_type, urgency, day_period,
            description, status, admin_response, resolved_by, resolved_at,
            created_at, updated_at
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
          ON CONFLICT (id) DO NOTHING`,
          [
            item.id,
            item.reporterName,
            item.reporterRole || 'นักเรียน',
            item.reporterPhone,
            item.reporterEmail || '',
            item.category,
            item.targetName,
            item.issueType,
            item.urgency || 'normal',
            item.dayPeriod || 'ไม่ระบุ',
            item.description,
            item.status || 'pending',
            item.adminResponse || null,
            item.resolvedBy || null,
            item.resolvedAt ? new Date(item.resolvedAt) : null,
            item.createdAt ? new Date(item.createdAt) : new Date(),
            item.updatedAt ? new Date(item.updatedAt) : new Date()
          ]
        );
      }
    }
  }

  async getIssues(filters = {}) {
    let sql = 'SELECT * FROM issues WHERE 1=1';
    const params = [];

    if (filters.status && filters.status !== 'all') {
      params.push(filters.status);
      sql += ` AND status = $${params.length}`;
    }
    if (filters.category && filters.category !== 'all') {
      params.push(filters.category);
      sql += ` AND category = $${params.length}`;
    }
    if (filters.urgency && filters.urgency !== 'all') {
      params.push(filters.urgency);
      sql += ` AND urgency = $${params.length}`;
    }
    if (filters.phone) {
      params.push(`%${filters.phone.trim()}%`);
      sql += ` AND reporter_phone ILIKE $${params.length}`;
    }
    if (filters.search) {
      params.push(`%${filters.search.trim()}%`);
      const p = `$${params.length}`;
      sql += ` AND (id ILIKE ${p} OR reporter_name ILIKE ${p} OR target_name ILIKE ${p} OR description ILIKE ${p} OR issue_type ILIKE ${p})`;
    }

    sql += ' ORDER BY created_at DESC';
    const res = await this.pool.query(sql, params);
    return res.rows.map(rowToIssue);
  }

  async getIssueById(id) {
    const res = await this.pool.query('SELECT * FROM issues WHERE UPPER(id) = UPPER($1)', [id.trim()]);
    return rowToIssue(res.rows[0]);
  }

  async createIssue(data) {
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    const newId = `YW69-${Date.now().toString().slice(-3)}${randomDigits.toString().slice(0, 2)}`;
    const now = new Date();

    const res = await this.pool.query(
      `INSERT INTO issues (
        id, reporter_name, reporter_role, reporter_phone, reporter_email,
        category, target_name, issue_type, urgency, day_period,
        description, status, admin_response, resolved_by, resolved_at,
        created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      RETURNING *`,
      [
        newId,
        data.reporterName.trim(),
        data.reporterRole || 'นักเรียน',
        data.reporterPhone.trim(),
        data.reporterEmail ? data.reporterEmail.trim() : '',
        data.category,
        data.targetName.trim(),
        data.issueType || 'คาบเรียนซ้ำซ้อน / คาบชนกัน',
        data.urgency || 'normal',
        data.dayPeriod ? data.dayPeriod.trim() : 'ไม่ระบุ',
        data.description.trim(),
        'pending',
        null,
        null,
        null,
        now,
        now
      ]
    );

    return rowToIssue(res.rows[0]);
  }

  async updateIssue(id, updateData) {
    const existing = await this.getIssueById(id);
    if (!existing) return null;

    const status = updateData.status !== undefined ? updateData.status : existing.status;
    const adminResponse = updateData.adminResponse !== undefined ? updateData.adminResponse : existing.adminResponse;
    const resolvedBy = updateData.resolvedBy !== undefined ? updateData.resolvedBy : existing.resolvedBy;
    const resolvedAt = (status === 'resolved' && !existing.resolvedAt) ? new Date() : (updateData.resolvedAt || (existing.resolvedAt ? new Date(existing.resolvedAt) : null));
    const now = new Date();

    const res = await this.pool.query(
      `UPDATE issues SET
        status = $1,
        admin_response = $2,
        resolved_by = $3,
        resolved_at = $4,
        updated_at = $5
       WHERE UPPER(id) = UPPER($6)
       RETURNING *`,
      [status, adminResponse, resolvedBy, resolvedAt, now, id.trim()]
    );

    return rowToIssue(res.rows[0]);
  }

  async getStats() {
    const res = await this.pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
        COUNT(*) FILTER (WHERE status = 'resolved') as resolved,
        COUNT(*) FILTER (WHERE urgency IN ('urgent', 'critical')) as urgent
      FROM issues
    `);
    const r = res.rows[0];
    return {
      totalIssues: parseInt(r.total, 10),
      pendingIssues: parseInt(r.pending, 10),
      inProgressIssues: parseInt(r.in_progress, 10),
      resolvedIssues: parseInt(r.resolved, 10),
      urgentIssues: parseInt(r.urgent, 10)
    };
  }

  async getUserByUsername(username) {
    const res = await this.pool.query('SELECT * FROM users WHERE LOWER(username) = LOWER($1)', [username.trim()]);
    return rowToUser(res.rows[0]);
  }

  async getUsers() {
    const res = await this.pool.query('SELECT id, username, full_name, role, position, created_at FROM users');
    return res.rows.map(rowToUser);
  }
}

// ========================================================
// 2. SQLite Adapter (สำหรับ Local Development)
// ========================================================
class SqliteDatabase {
  constructor(filePath) {
    this.filePath = filePath;
    const sqlite3 = require('sqlite3').verbose();
    this.db = new sqlite3.Database(filePath);
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve(this);
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
  }

  async init() {
    await this.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'staff',
        position TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await this.run(`
      CREATE TABLE IF NOT EXISTS issues (
        id TEXT PRIMARY KEY,
        reporter_name TEXT NOT NULL,
        reporter_role TEXT NOT NULL DEFAULT 'นักเรียน',
        reporter_phone TEXT NOT NULL,
        reporter_email TEXT,
        category TEXT NOT NULL,
        target_name TEXT NOT NULL,
        issue_type TEXT NOT NULL,
        urgency TEXT NOT NULL DEFAULT 'normal',
        day_period TEXT,
        description TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        admin_response TEXT,
        resolved_by TEXT,
        resolved_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await this.run(`CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);`);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_issues_category ON issues(category);`);

    // Seed users
    const userRow = await this.get('SELECT COUNT(*) as count FROM users');
    if (!userRow || userRow.count === 0) {
      const seedUsers = getSeedUsers();
      for (const u of seedUsers) {
        await this.run(
          `INSERT OR IGNORE INTO users (username, password, full_name, role, position, created_at)
           VALUES (?, ?, ?, ?, ?, datetime('now'))`,
          [u.username, u.password, u.fullName, u.role, u.position]
        );
      }
    }

    // Seed issues
    const issueRow = await this.get('SELECT COUNT(*) as count FROM issues');
    if (!issueRow || issueRow.count === 0) {
      const seedIssues = getSeedIssues();
      for (const item of seedIssues) {
        await this.run(
          `INSERT OR IGNORE INTO issues (
            id, reporter_name, reporter_role, reporter_phone, reporter_email,
            category, target_name, issue_type, urgency, day_period,
            description, status, admin_response, resolved_by, resolved_at,
            created_at, updated_at
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            item.id,
            item.reporterName,
            item.reporterRole || 'นักเรียน',
            item.reporterPhone,
            item.reporterEmail || '',
            item.category,
            item.targetName,
            item.issueType,
            item.urgency || 'normal',
            item.dayPeriod || 'ไม่ระบุ',
            item.description,
            item.status || 'pending',
            item.adminResponse || null,
            item.resolvedBy || null,
            item.resolvedAt || null,
            item.createdAt || new Date().toISOString(),
            item.updatedAt || new Date().toISOString()
          ]
        );
      }
    }
  }

  async getIssues(filters = {}) {
    let sql = 'SELECT * FROM issues WHERE 1=1';
    const params = [];

    if (filters.status && filters.status !== 'all') {
      params.push(filters.status);
      sql += ' AND status = ?';
    }
    if (filters.category && filters.category !== 'all') {
      params.push(filters.category);
      sql += ' AND category = ?';
    }
    if (filters.urgency && filters.urgency !== 'all') {
      params.push(filters.urgency);
      sql += ' AND urgency = ?';
    }
    if (filters.phone) {
      params.push(`%${filters.phone.trim()}%`);
      sql += ' AND reporter_phone LIKE ?';
    }
    if (filters.search) {
      const q = `%${filters.search.trim()}%`;
      params.push(q, q, q, q, q);
      sql += ' AND (id LIKE ? OR reporter_name LIKE ? OR target_name LIKE ? OR description LIKE ? OR issue_type LIKE ?)';
    }

    sql += ' ORDER BY created_at DESC';
    const rows = await this.all(sql, params);
    return rows.map(rowToIssue);
  }

  async getIssueById(id) {
    const row = await this.get('SELECT * FROM issues WHERE UPPER(id) = UPPER(?)', [id.trim()]);
    return rowToIssue(row);
  }

  async createIssue(data) {
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    const newId = `YW69-${Date.now().toString().slice(-3)}${randomDigits.toString().slice(0, 2)}`;
    const nowIso = new Date().toISOString();

    await this.run(
      `INSERT INTO issues (
        id, reporter_name, reporter_role, reporter_phone, reporter_email,
        category, target_name, issue_type, urgency, day_period,
        description, status, admin_response, resolved_by, resolved_at,
        created_at, updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        newId,
        data.reporterName.trim(),
        data.reporterRole || 'นักเรียน',
        data.reporterPhone.trim(),
        data.reporterEmail ? data.reporterEmail.trim() : '',
        data.category,
        data.targetName.trim(),
        data.issueType || 'คาบเรียนซ้ำซ้อน / คาบชนกัน',
        data.urgency || 'normal',
        data.dayPeriod ? data.dayPeriod.trim() : 'ไม่ระบุ',
        data.description.trim(),
        'pending',
        null,
        null,
        null,
        nowIso,
        nowIso
      ]
    );

    const created = await this.getIssueById(newId);

    // Sync to issues.json so files stay synchronized
    try {
      const allIssues = await this.getIssues();
      fs.writeFileSync(SEED_ISSUES_PATH, JSON.stringify(allIssues, null, 2), 'utf-8');
    } catch (e) {
      // ignore write error if read-only
    }

    return created;
  }

  async updateIssue(id, updateData) {
    const existing = await this.getIssueById(id);
    if (!existing) return null;

    const status = updateData.status !== undefined ? updateData.status : existing.status;
    const adminResponse = updateData.adminResponse !== undefined ? updateData.adminResponse : existing.adminResponse;
    const resolvedBy = updateData.resolvedBy !== undefined ? updateData.resolvedBy : existing.resolvedBy;
    const resolvedAt = (status === 'resolved' && !existing.resolvedAt) ? new Date().toISOString() : (updateData.resolvedAt || existing.resolvedAt);
    const nowIso = new Date().toISOString();

    await this.run(
      `UPDATE issues SET
        status = ?,
        admin_response = ?,
        resolved_by = ?,
        resolved_at = ?,
        updated_at = ?
       WHERE UPPER(id) = UPPER(?)`,
      [status, adminResponse, resolvedBy, resolvedAt, nowIso, id.trim()]
    );

    const updated = await this.getIssueById(id);

    // Sync to issues.json
    try {
      const allIssues = await this.getIssues();
      fs.writeFileSync(SEED_ISSUES_PATH, JSON.stringify(allIssues, null, 2), 'utf-8');
    } catch (e) {
      // ignore
    }

    return updated;
  }

  async getStats() {
    const issues = await this.getIssues();
    return {
      totalIssues: issues.length,
      pendingIssues: issues.filter(i => i.status === 'pending').length,
      inProgressIssues: issues.filter(i => i.status === 'in_progress').length,
      resolvedIssues: issues.filter(i => i.status === 'resolved').length,
      urgentIssues: issues.filter(i => i.urgency === 'urgent' || i.urgency === 'critical').length
    };
  }

  async getUserByUsername(username) {
    const row = await this.get('SELECT * FROM users WHERE LOWER(username) = LOWER(?)', [username.trim()]);
    return rowToUser(row);
  }

  async getUsers() {
    const rows = await this.all('SELECT id, username, full_name, role, position, created_at FROM users');
    return rows.map(rowToUser);
  }
}

// ========================================================
// 3. Fallback Memory/JSON Adapter (สำหรับกรณี Serverless)
// ========================================================
class MemoryFallbackDatabase {
  constructor() {
    this.issues = getSeedIssues();
    this.users = getSeedUsers();
  }

  async init() {
    if (fs.existsSync(TMP_ISSUES_PATH)) {
      try {
        this.issues = JSON.parse(fs.readFileSync(TMP_ISSUES_PATH, 'utf-8'));
      } catch (e) {
        // ignore
      }
    }
  }

  persist() {
    try {
      if (fs.existsSync(DATA_DIR) && !process.env.VERCEL) {
        fs.writeFileSync(SEED_ISSUES_PATH, JSON.stringify(this.issues, null, 2), 'utf-8');
      }
    } catch (e) {
      try {
        fs.writeFileSync(TMP_ISSUES_PATH, JSON.stringify(this.issues, null, 2), 'utf-8');
      } catch (tmpErr) {
        // keep in memory
      }
    }
  }

  async getIssues(filters = {}) {
    let list = [...this.issues];
    if (filters.status && filters.status !== 'all') {
      list = list.filter(i => i.status === filters.status);
    }
    if (filters.category && filters.category !== 'all') {
      list = list.filter(i => i.category === filters.category);
    }
    if (filters.urgency && filters.urgency !== 'all') {
      list = list.filter(i => i.urgency === filters.urgency);
    }
    if (filters.phone) {
      list = list.filter(i => i.reporterPhone && i.reporterPhone.includes(filters.phone.trim()));
    }
    if (filters.search) {
      const q = filters.search.trim().toLowerCase();
      list = list.filter(i =>
        (i.id && i.id.toLowerCase().includes(q)) ||
        (i.reporterName && i.reporterName.toLowerCase().includes(q)) ||
        (i.targetName && i.targetName.toLowerCase().includes(q)) ||
        (i.description && i.description.toLowerCase().includes(q)) ||
        (i.issueType && i.issueType.toLowerCase().includes(q))
      );
    }
    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return list;
  }

  async getIssueById(id) {
    return this.issues.find(i => i.id.toUpperCase() === id.toUpperCase().trim()) || null;
  }

  async createIssue(data) {
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    const newId = `YW69-${Date.now().toString().slice(-3)}${randomDigits.toString().slice(0, 2)}`;
    const nowIso = new Date().toISOString();

    const newIssue = {
      id: newId,
      createdAt: nowIso,
      updatedAt: nowIso,
      reporterName: data.reporterName.trim(),
      reporterRole: data.reporterRole || 'นักเรียน',
      reporterPhone: data.reporterPhone.trim(),
      reporterEmail: data.reporterEmail ? data.reporterEmail.trim() : '',
      category: data.category,
      targetName: data.targetName.trim(),
      issueType: data.issueType || 'คาบเรียนซ้ำซ้อน / คาบชนกัน',
      urgency: data.urgency || 'normal',
      dayPeriod: data.dayPeriod ? data.dayPeriod.trim() : 'ไม่ระบุ',
      description: data.description.trim(),
      status: 'pending',
      adminResponse: null,
      resolvedBy: null,
      resolvedAt: null
    };

    this.issues.unshift(newIssue);
    this.persist();
    return newIssue;
  }

  async updateIssue(id, updateData) {
    const issue = await this.getIssueById(id);
    if (!issue) return null;

    if (updateData.status) issue.status = updateData.status;
    if (updateData.adminResponse !== undefined) issue.adminResponse = updateData.adminResponse;
    if (updateData.resolvedBy !== undefined) issue.resolvedBy = updateData.resolvedBy;
    issue.updatedAt = new Date().toISOString();

    if (issue.status === 'resolved' && !issue.resolvedAt) {
      issue.resolvedAt = new Date().toISOString();
    }

    this.persist();
    return issue;
  }

  async getStats() {
    return {
      totalIssues: this.issues.length,
      pendingIssues: this.issues.filter(i => i.status === 'pending').length,
      inProgressIssues: this.issues.filter(i => i.status === 'in_progress').length,
      resolvedIssues: this.issues.filter(i => i.status === 'resolved').length,
      urgentIssues: this.issues.filter(i => i.urgency === 'urgent' || i.urgency === 'critical').length
    };
  }

  async getUserByUsername(username) {
    return this.users.find(u => u.username.toLowerCase() === username.trim().toLowerCase()) || null;
  }

  async getUsers() {
    return this.users.map(u => ({
      username: u.username,
      fullName: u.fullName,
      role: u.role,
      position: u.position
    }));
  }
}

// ========================================================
// Factory & Manager
// ========================================================
class DatabaseManager {
  constructor() {
    this.driver = null;
    this.driverName = 'Initializing';
    this.readyPromise = this.setup();
  }

  async setup() {
    const pgUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

    // 1. Try PostgreSQL if DATABASE_URL is set
    if (pgUrl) {
      try {
        console.log('[DB] Connecting to PostgreSQL database...');
        const pgDb = new PostgresDatabase(pgUrl);
        await pgDb.init();
        this.driver = pgDb;
        this.driverName = 'PostgreSQL (Cloud / Supabase / Neon)';
        console.log(`[DB] Successfully connected to ${this.driverName}`);
        return;
      } catch (err) {
        console.error('[DB] PostgreSQL connection failed, falling back:', err.message);
      }
    }

    // 2. Try SQLite if running locally (not in read-only serverless)
    if (!process.env.VERCEL) {
      try {
        if (!fs.existsSync(DATA_DIR)) {
          fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        console.log('[DB] Initializing SQLite database at:', SQLITE_FILE);
        const sqliteDb = new SqliteDatabase(SQLITE_FILE);
        await sqliteDb.init();
        this.driver = sqliteDb;
        this.driverName = 'SQLite (Local Database: data/database.sqlite)';
        console.log(`[DB] Successfully loaded ${this.driverName}`);
        return;
      } catch (err) {
        console.warn('[DB] SQLite initialization failed:', err.message);
      }
    }

    // 3. Fallback for serverless without Postgres
    console.log('[DB] Using In-Memory & Serverless Tmp storage');
    const fallbackDb = new MemoryFallbackDatabase();
    await fallbackDb.init();
    this.driver = fallbackDb;
    this.driverName = 'Memory / Tmp Fallback';
  }

  async ensureReady() {
    await this.readyPromise;
  }

  async getIssues(filters) {
    await this.ensureReady();
    return this.driver.getIssues(filters);
  }

  async getIssueById(id) {
    await this.ensureReady();
    return this.driver.getIssueById(id);
  }

  async createIssue(data) {
    await this.ensureReady();
    return this.driver.createIssue(data);
  }

  async updateIssue(id, updateData) {
    await this.ensureReady();
    return this.driver.updateIssue(id, updateData);
  }

  async getStats() {
    await this.ensureReady();
    return this.driver.getStats();
  }

  async getUserByUsername(username) {
    await this.ensureReady();
    return this.driver.getUserByUsername(username);
  }

  async getUsers() {
    await this.ensureReady();
    return this.driver.getUsers();
  }

  getDriverName() {
    return this.driverName;
  }
}

// Singleton database instance
const db = new DatabaseManager();

module.exports = db;
