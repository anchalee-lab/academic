-- ========================================================
-- Schema: ระบบตารางเรียนตารางสอน โรงเรียนหาดใหญ่วิทยาลัย
-- ภาคเรียนที่ 2 ปีการศึกษา 2569
-- รองรับ: PostgreSQL / Neon / Supabase / SQLite
-- ========================================================

-- 1. ตาราง users: บัญชีผู้ดูแลและเจ้าหน้าที่งานจัดตารางเรียน
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(100) NOT NULL DEFAULT 'staff',
    position VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. ตาราง issues: รายการแจ้งปัญหาตารางเรียน ตารางสอน และการใช้ห้อง
CREATE TABLE IF NOT EXISTS issues (
    id VARCHAR(50) PRIMARY KEY,
    reporter_name VARCHAR(255) NOT NULL,
    reporter_role VARCHAR(100) NOT NULL DEFAULT 'นักเรียน',
    reporter_phone VARCHAR(100) NOT NULL,
    reporter_email VARCHAR(255),
    category VARCHAR(50) NOT NULL,             -- student, teacher, classroom
    target_name VARCHAR(255) NOT NULL,          -- เช่น ม.1/1, ครูสมศักดิ์, ห้อง 111
    issue_type VARCHAR(255) NOT NULL,           -- คาบชนกัน, ตารางไม่ตรง, ห้องซ้ำ ฯลฯ
    urgency VARCHAR(50) NOT NULL DEFAULT 'normal', -- low, normal, high, urgent
    day_period VARCHAR(255),                    -- วันและคาบที่พบปัญหา
    description TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, in_progress, resolved, cancelled
    admin_response TEXT,                        -- ข้อความตอบกลับจากงานจัดตารางเรียน
    resolved_by VARCHAR(255),                   -- ชื่อเจ้าหน้าที่ผู้ดำเนินการ
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Indexes เพื่อเพิ่มประสิทธิภาพการค้นหา
CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_category ON issues(category);
CREATE INDEX IF NOT EXISTS idx_issues_urgency ON issues(urgency);
CREATE INDEX IF NOT EXISTS idx_issues_created_at ON issues(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_issues_phone ON issues(reporter_phone);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- 4. Initial Users (งานจัดตารางเรียน)
INSERT INTO users (username, password, full_name, role, position)
VALUES 
    ('admin', 'admin2569', 'ครูผู้ดูแลระบบงานจัดตารางเรียน', 'head_schedule', 'หัวหน้างานจัดตารางเรียน'),
    ('schedule', 'yw69schedule', 'เจ้าหน้าที่งานจัดตารางเรียน', 'schedule_staff', 'เจ้าหน้าที่งานจัดตารางเรียน')
ON CONFLICT (username) DO NOTHING;
