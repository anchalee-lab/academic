/**
 * Script to initialize and verify the Database (SQLite / PostgreSQL)
 */
const db = require('../db');

async function main() {
  console.log('====================================================');
  console.log('  ตรวจสอบและเตรียมความพร้อมฐานข้อมูลจริง (Database Init)');
  console.log('====================================================');

  await db.ensureReady();
  console.log(`[OK] ไดรเวอร์ฐานข้อมูลที่ใช้งาน: ${db.getDriverName()}`);

  const users = await db.getUsers();
  console.log(`[OK] พบบัญชีผู้ใช้งานในตาราง users: ${users.length} รายการ`);
  users.forEach(u => {
    console.log(`   - Username: ${u.username} | ชื่อ-สกุล: ${u.fullName} | ตำแหน่ง: ${u.position}`);
  });

  const issues = await db.getIssues();
  console.log(`[OK] พบบันทึกในตาราง issues: ${issues.length} รายการ`);

  const stats = await db.getStats();
  console.log('[OK] สถิติภาพรวมในระบบ:');
  console.log(`   - ทั้งหมด: ${stats.totalIssues} เรื่อง`);
  console.log(`   - รอดำเนินการ: ${stats.pendingIssues} เรื่อง`);
  console.log(`   - กำลังดำเนินการ: ${stats.inProgressIssues} เรื่อง`);
  console.log(`   - แก้ไขเสร็จสิ้น: ${stats.resolvedIssues} เรื่อง`);

  console.log('====================================================');
  console.log('  การตั้งค่าฐานข้อมูลพร้อมใช้งานสมบูรณ์ 100%');
  console.log('====================================================');
  process.exit(0);
}

main().catch(err => {
  console.error('[ERROR] เกิดข้อผิดพลาดในการตรวจสอบฐานข้อมูล:', err);
  process.exit(1);
});
