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

const db = require('./db');

// Paths
const CATALOG_PATH = path.join(__dirname, 'data', 'catalog.json');

// In-memory active sessions
const activeSessions = new Map();

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

// API: Database Info & Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    database: db.getDriverName(),
    timestamp: new Date().toISOString()
  });
});

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
app.get('/api/stats', async (req, res) => {
  try {
    const catalog = getCatalog();
    const issueStats = await db.getStats();

    const stats = {
      totalStudents: catalog.students ? catalog.students.length : 0,
      totalTeachers: catalog.teachers ? catalog.teachers.length : 0,
      totalRooms: catalog.rooms ? catalog.rooms.length : 0,
      ...issueStats,
      database: db.getDriverName()
    };

    res.json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// API: Get Issues with optional filtering
app.get('/api/issues', async (req, res) => {
  try {
    const { status, category, urgency, search, phone } = req.query;
    const issues = await db.getIssues({ status, category, urgency, search, phone });
    res.json({ success: true, count: issues.length, data: issues });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// API: Lookup Issue by ID
app.get('/api/issues/:id', async (req, res) => {
  try {
    const issue = await db.getIssueById(req.params.id);
    if (!issue) {
      return res.status(404).json({ success: false, message: 'ไม่พบหมายเลขเรื่องแจ้งนี้' });
    }
    res.json({ success: true, data: issue });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// API: Create new Issue
app.post('/api/issues', async (req, res) => {
  try {
    let {
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

    reporterName = (reporterName || '').trim();
    reporterPhone = (reporterPhone || '').trim();
    category = (category || 'student').trim();
    targetName = (targetName || '').trim();
    issueType = (issueType || 'คาบเรียนซ้ำซ้อน / คาบชนกัน').trim();
    urgency = (urgency || 'normal').trim();
    dayPeriod = (dayPeriod || 'ไม่ระบุ').trim();
    description = (description || '').trim();

    if (!reporterName) {
      return res.status(400).json({
        success: false,
        message: 'กรุณากรอกชื่อ-นามสกุลของผู้แจ้ง'
      });
    }

    if (!reporterPhone) {
      return res.status(400).json({
        success: false,
        message: 'กรุณากรอกเบอร์โทรศัพท์ติดต่อ'
      });
    }

    // Smart defaults if targetName or description are empty
    if (!targetName) {
      if (category === 'student') targetName = 'ตารางเรียนนักเรียน (ไม่ระบุห้อง)';
      else if (category === 'teacher') targetName = 'ตารางสอนครู (ไม่ระบุครู)';
      else if (category === 'room') targetName = 'ตารางการใช้ห้อง (ไม่ระบุห้อง)';
      else targetName = 'ตารางเรียนทั่วไป';
    }

    if (!description) {
      description = `แจ้งปัญหาเรื่อง ${issueType} โดย ${reporterName} (${reporterRole || 'ผู้แจ้ง'})`;
    }

    const newIssue = await db.createIssue({
      reporterName,
      reporterRole: reporterRole || 'นักเรียน',
      reporterPhone,
      reporterEmail: (reporterEmail || '').trim(),
      category,
      targetName,
      issueType,
      urgency,
      dayPeriod,
      description
    });

    res.status(201).json({
      success: true,
      message: 'บันทึกเรื่องแจ้งปัญหาลงฐานข้อมูลสำเร็จ',
      data: newIssue
    });
  } catch (err) {
    console.error('Error creating issue in database:', err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' + err.message });
  }
});

// ==========================================
// AUTHENTICATION APIs (งานจัดตารางเรียน)
// ==========================================
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน'
      });
    }

    const user = await db.getUserByUsername(username);

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
app.patch('/api/issues/:id', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const { status, adminResponse, resolvedBy } = req.body;

    let staffName = resolvedBy;
    if (!staffName && req.user) {
      staffName = `${req.user.fullName} (${req.user.position})`;
    }

    const updated = await db.updateIssue(id, {
      status,
      adminResponse,
      resolvedBy: staffName
    });

    if (!updated) {
      return res.status(404).json({ success: false, message: 'ไม่พบเรื่องแจ้งดังกล่าว' });
    }

    res.json({
      success: true,
      message: 'อัปเดตสถานะสำเร็จโดยเจ้าหน้าที่งานจัดตารางเรียน',
      data: updated
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
