const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static assets from public/
app.use(express.static(path.join(__dirname, 'public')));

// Serve PDF files
app.use('/pdf/student-single', express.static(path.join(__dirname, 'student_single')));
app.use('/pdf/teacher-single', express.static(path.join(__dirname, 'teacher_single')));
app.use('/pdf/classroom-single', express.static(path.join(__dirname, 'classroom_single')));
app.use('/pdf/student', express.static(path.join(__dirname, 'student')));
app.use('/pdf/teacher', express.static(path.join(__dirname, 'teacher')));
app.use('/pdf/classroom', express.static(path.join(__dirname, 'classroom')));

// Paths
const CATALOG_PATH = path.join(__dirname, 'data', 'catalog.json');
const ISSUES_PATH = path.join(__dirname, 'data', 'issues.json');
const AUTH_PATH = path.join(__dirname, 'data', 'auth.json');
const TMP_ISSUES_PATH = path.join(os.tmpdir(), 'issues.json');

// In-memory cache for issues (essential for Vercel read-only filesystem)
let inMemoryIssues = null;

// In-memory active sessions
const activeSessions = new Map();

// Helper to load auth users
function getAuthUsers() {
  if (fs.existsSync(AUTH_PATH)) {
    try {
      const data = JSON.parse(fs.readFileSync(AUTH_PATH, 'utf-8'));
      return data.users || [];
    } catch (e) {
      console.error('Error reading auth.json', e);
    }
  }
  return [
    {
      username: "admin",
      password: "admin2569",
      fullName: "ครูผู้ดูแลระบบงานจัดตารางเรียน",
      role: "head_schedule",
      position: "หัวหน้างานจัดตารางเรียน"
    }
  ];
}

// Auth Middleware for protected routes
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'กรุณาเข้าสู่ระบบสำหรับเจ้าหน้าที่งานจัดตารางเรียน'
    });
  }

  const token = authHeader.split(' ')[1];
  const session = activeSessions.get(token);
  if (!session) {
    return res.status(401).json({
      success: false,
      message: 'เซสชันหมดอายุหรือไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่'
    });
  }

  req.user = session;
  next();
}

// Helper to load catalog
function getCatalog() {
  if (fs.existsSync(CATALOG_PATH)) {
    return JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf-8'));
  }
  return { students: [], teachers: [], rooms: [] };
}

// Helper to load issues (in-memory + /tmp support for Vercel read-only filesystem)
function getIssues() {
  if (inMemoryIssues !== null) {
    return inMemoryIssues;
  }

  // 1. Try reading from /tmp/issues.json first (modified on Vercel)
  if (fs.existsSync(TMP_ISSUES_PATH)) {
    try {
      inMemoryIssues = JSON.parse(fs.readFileSync(TMP_ISSUES_PATH, 'utf-8'));
      return inMemoryIssues;
    } catch (e) {
      console.warn('Error reading from /tmp/issues.json', e.message);
    }
  }

  // 2. Read from bundled data/issues.json
  if (fs.existsSync(ISSUES_PATH)) {
    try {
      inMemoryIssues = JSON.parse(fs.readFileSync(ISSUES_PATH, 'utf-8'));
      return inMemoryIssues;
    } catch (e) {
      console.error('Error reading issues.json', e);
      return [];
    }
  }

  inMemoryIssues = [];
  return inMemoryIssues;
}

// Helper to save issues (handles local filesystem and Vercel EROFS read-only)
function saveIssues(issues) {
  inMemoryIssues = issues;

  // Try saving to local data/issues.json first (normal local environment)
  try {
    fs.writeFileSync(ISSUES_PATH, JSON.stringify(issues, null, 2), 'utf-8');
    return;
  } catch (err) {
    // If running in a read-only filesystem (EROFS like Vercel / AWS Lambda)
    if (err.code === 'EROFS' || err.code === 'EACCES') {
      try {
        fs.writeFileSync(TMP_ISSUES_PATH, JSON.stringify(issues, null, 2), 'utf-8');
        console.log('Saved issues to writable /tmp/issues.json successfully (Serverless mode)');
      } catch (tmpErr) {
        console.warn('Could not write to /tmp, keeping issues in-memory:', tmpErr.message);
      }
      return;
    }
    // Other errors: fallback to /tmp or in-memory
    console.warn('Filesystem error, keeping in-memory:', err.message);
  }
}

// API: Get Catalog
app.get('/api/catalog', (req, res) => {
  try {
    const catalog = getCatalog();
    res.json({ success: true, data: catalog });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// API: Stats
app.get('/api/stats', (req, res) => {
  try {
    const catalog = getCatalog();
    const issues = getIssues();

    const stats = {
      totalStudents: catalog.students ? catalog.students.length : 0,
      totalTeachers: catalog.teachers ? catalog.teachers.length : 0,
      totalRooms: catalog.rooms ? catalog.rooms.length : 0,
      totalIssues: issues.length,
      pendingIssues: issues.filter(i => i.status === 'pending').length,
      inProgressIssues: issues.filter(i => i.status === 'in_progress').length,
      resolvedIssues: issues.filter(i => i.status === 'resolved').length,
      urgentIssues: issues.filter(i => i.urgency === 'urgent' || i.urgency === 'critical').length
    };

    res.json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// API: Get Issues with optional filtering
app.get('/api/issues', (req, res) => {
  try {
    let issues = getIssues();
    const { status, category, urgency, search, phone } = req.query;

    if (status && status !== 'all') {
      issues = issues.filter(i => i.status === status);
    }
    if (category && category !== 'all') {
      issues = issues.filter(i => i.category === category);
    }
    if (urgency && urgency !== 'all') {
      issues = issues.filter(i => i.urgency === urgency);
    }
    if (phone) {
      issues = issues.filter(i => i.reporterPhone && i.reporterPhone.replace(/\D/g, '').includes(phone.replace(/\D/g, '')));
    }
    if (search) {
      const q = search.trim().toLowerCase();
      issues = issues.filter(i => 
        (i.id && i.id.toLowerCase().includes(q)) ||
        (i.reporterName && i.reporterName.toLowerCase().includes(q)) ||
        (i.targetName && i.targetName.toLowerCase().includes(q)) ||
        (i.description && i.description.toLowerCase().includes(q)) ||
        (i.issueType && i.issueType.toLowerCase().includes(q))
      );
    }

    // Sort newest first
    issues.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ success: true, count: issues.length, data: issues });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// API: Lookup Issue by ID
app.get('/api/issues/:id', (req, res) => {
  try {
    const issues = getIssues();
    const issue = issues.find(i => i.id.toUpperCase() === req.params.id.toUpperCase().trim());
    if (!issue) {
      return res.status(404).json({ success: false, message: 'ไม่พบหมายเลขเรื่องแจ้งนี้' });
    }
    res.json({ success: true, data: issue });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// API: Create new Issue
app.post('/api/issues', (req, res) => {
  try {
    const {
      reporterName,
      reporterRole,
      reporterPhone,
      reporterEmail,
      category,
      targetName,
      issueType,
      urgency,
      dayPeriod,
      description
    } = req.body;

    if (!reporterName || !reporterPhone || !category || !targetName || !description) {
      return res.status(400).json({
        success: false,
        message: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน (ชื่อ, เบอร์โทร, ประเภท, เป้าหมาย, รายละเอียด)'
      });
    }

    const issues = getIssues();

    // Generate unique ID
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    const newId = `YW69-${Date.now().toString().slice(-3)}${randomDigits.toString().slice(0, 2)}`;

    const newIssue = {
      id: newId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      reporterName: reporterName.trim(),
      reporterRole: reporterRole || 'นักเรียน',
      reporterPhone: reporterPhone.trim(),
      reporterEmail: reporterEmail ? reporterEmail.trim() : '',
      category: category,
      targetName: targetName.trim(),
      issueType: issueType || 'คาบเรียนซ้ำซ้อน / คาบชนกัน',
      urgency: urgency || 'normal',
      dayPeriod: dayPeriod ? dayPeriod.trim() : 'ไม่ระบุ',
      description: description.trim(),
      status: 'pending',
      adminResponse: null,
      resolvedBy: null,
      resolvedAt: null
    };

    issues.unshift(newIssue);
    saveIssues(issues);

    res.status(201).json({
      success: true,
      message: 'บันทึกเรื่องแจ้งปัญหาสำเร็จ',
      data: newIssue
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// AUTHENTICATION APIs (งานจัดตารางเรียน)
// ==========================================
app.post('/api/auth/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน'
      });
    }

    const users = getAuthUsers();
    const user = users.find(u => u.username.toLowerCase() === username.trim().toLowerCase());

    if (!user || user.password !== password) {
      return res.status(401).json({
        success: false,
        message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'
      });
    }

    // Generate token
    const token = `YW_AUTH_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    const userInfo = {
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      position: user.position,
      loginAt: new Date().toISOString()
    };

    activeSessions.set(token, userInfo);

    res.json({
      success: true,
      message: 'เข้าสู่ระบบสำเร็จ ยินดีต้อนรับสู่งานจัดตารางเรียน',
      token,
      user: userInfo
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

app.post('/api/auth/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    activeSessions.delete(token);
  }
  res.json({ success: true, message: 'ออกจากระบบสำเร็จ' });
});

// API: Update Issue Status / Admin Response (Protected by requireAuth)
app.patch('/api/issues/:id', requireAuth, (req, res) => {
  try {
    const id = req.params.id.toUpperCase().trim();
    const { status, adminResponse, resolvedBy } = req.body;
    const issues = getIssues();
    const idx = issues.findIndex(i => i.id === id);

    if (idx === -1) {
      return res.status(404).json({ success: false, message: 'ไม่พบเรื่องแจ้งดังกล่าว' });
    }

    const issue = issues[idx];
    if (status) issue.status = status;
    if (adminResponse !== undefined) issue.adminResponse = adminResponse;
    if (resolvedBy !== undefined) {
      issue.resolvedBy = resolvedBy;
    } else if (req.user && !issue.resolvedBy) {
      issue.resolvedBy = `${req.user.fullName} (${req.user.position})`;
    }
    issue.updatedAt = new Date().toISOString();

    if (status === 'resolved' && !issue.resolvedAt) {
      issue.resolvedAt = new Date().toISOString();
    }

    issues[idx] = issue;
    saveIssues(issues);

    res.json({
      success: true,
      message: 'อัปเดตสถานะสำเร็จโดยเจ้าหน้าที่งานจัดตารางเรียน',
      data: issue
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Start Server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`  ระบบตารางเรียนตารางสอน โรงเรียนหาดใหญ่วิทยาลัย`);
    console.log(`  ภาคเรียนที่ 2 ปีการศึกษา 2569`);
    console.log(`  Server running at http://localhost:${PORT}`);
    console.log(`=======================================================`);
  });
}

module.exports = app;
