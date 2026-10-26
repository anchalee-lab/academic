const fs = require('fs');

const initialIssues = [
  {
    id: "YW69-1001",
    createdAt: "2026-10-25T08:30:00.000Z",
    updatedAt: "2026-10-26T14:20:00.000Z",
    reporterName: "ด.ช.ธนภัทร วงศ์เจริญ",
    reporterRole: "นักเรียน",
    reporterPhone: "081-234-5678",
    reporterEmail: "tanapat.w@student.yorwor.ac.th",
    category: "student",
    targetName: "ม.1/2",
    issueType: "คาบเรียนซ้ำซ้อน / คาบชนกัน",
    urgency: "urgent",
    dayPeriod: "วันอังคาร คาบที่ 3-4 (10.10 - 11.50 น.)",
    description: "ในตารางเรียนวันอังคาร คาบ 3-4 มีการลงเรียนวิชาคณิตศาสตร์เพิ่มเติม ซ้อนกับวิชาภาษาอังกฤษเพื่อการสื่อสาร ทำให้นักเรียนและคุณครูชนกันครับ",
    status: "resolved",
    adminResponse: "ฝ่ายบริหารวิชาการและงานจัดตารางสอนได้ตรวจสอบแล้ว และดำเนินการสลับคาบเรียนวิชาภาษาอังกฤษสื่อสารไปเป็นวันพฤหัสบดี คาบที่ 7 เรียบร้อยแล้ว พร้อมส่งตารางฉบับแก้ไขให้ครูประจำชั้นแล้วครับ",
    resolvedBy: "นายสมชาย ใจมั่นคง (ฝ่ายบริหารวิชาการ)",
    resolvedAt: "2026-10-26T14:20:00.000Z"
  },
  {
    id: "YW69-1002",
    createdAt: "2026-10-26T09:15:00.000Z",
    updatedAt: "2026-10-26T11:00:00.000Z",
    reporterName: "นางสาวอรทัย ประทุมชาติภักดี",
    reporterRole: "ครู/อาจารย์",
    reporterPhone: "089-765-4321",
    reporterEmail: "orathai.p@yorwor.ac.th",
    category: "teacher",
    targetName: "203 นางสาวอรทัย ประทุมชาติภักดี",
    issueType: "ข้อมูลห้องเรียนไม่ตรง / สลับห้อง",
    urgency: "normal",
    dayPeriod: "วันศุกร์ คาบที่ 5 (11.50 - 12.40 น.)",
    description: "ในตารางสอนของข้าพเจ้า มีสอนห้อง ม.4/5 ที่ห้อง 8302 แต่ในตารางการใช้ห้อง 8302 ปรากฏว่าตรงกับวิชาของกลุ่มสาระวิทยาศาสตร์ รบกวนช่วยตรวจสอบห้องเรียนที่ถูกต้องค่ะ",
    status: "in_progress",
    adminResponse: "เจ้าหน้าที่กำลังประสานงานตรวจสอบการจองห้องกับกลุ่มสาระวิทยาศาสตร์ คาดว่าจะยืนยันห้องทดแทนให้ภายใน 24 ชม. ครับ",
    resolvedBy: "นางพรทิพย์ สุวรรณรัตน์ (เจ้าหน้าที่จัดตารางสอน)",
    resolvedAt: null
  },
  {
    id: "YW69-1003",
    createdAt: "2026-10-26T13:45:00.000Z",
    updatedAt: "2026-10-26T13:45:00.000Z",
    reporterName: "นายอนุสรณ์ พิชิตชัย",
    reporterRole: "ครู/อาจารย์",
    reporterPhone: "082-998-1122",
    reporterEmail: "anusorn.p@yorwor.ac.th",
    category: "room",
    targetName: "ห้อง 7205",
    issueType: "ปัญหาการใช้ห้อง / อุปกรณ์ประจำห้อง",
    urgency: "normal",
    dayPeriod: "ตลอดภาคเรียนที่ 2",
    description: "ห้องปฏิบัติการคอมพิวเตอร์ 7205 เครื่องโปรเจกเตอร์มีปัญหาสายสัญญาณภาพติดๆ ดับๆ ขอความอนุเคราะห์งานอาคารสถานที่หรือคอมพิวเตอร์เข้าตรวจเช็คก่อนเปิดเทอม",
    status: "pending",
    adminResponse: "ได้รับเรื่องแล้ว กำลังส่งเรื่องต่อให้ฝ่ายคอมพิวเตอร์และโสตทัศนูปกรณ์เข้าซ่อมบำรุง",
    resolvedBy: null,
    resolvedAt: null
  },
  {
    id: "YW69-1004",
    createdAt: "2026-10-26T15:10:00.000Z",
    updatedAt: "2026-10-26T15:10:00.000Z",
    reporterName: "น.ส.กัญญาพร แสงสุวรรณ",
    reporterRole: "นักเรียน",
    reporterPhone: "095-443-2211",
    reporterEmail: "kanyaporn.s@student.yorwor.ac.th",
    category: "student",
    targetName: "ม.5/8",
    issueType: "รหัสวิชา / จำนวนหน่วยกิตไม่ตรงหลักสูตร",
    urgency: "urgent",
    dayPeriod: "วันจันทร์ คาบที่ 1-2",
    description: "รหัสวิชาภาษาไทยในตารางเขียนเป็น ท32101 แต่ภาคเรียนที่ 2 ควรเป็น ท32102 รบกวนแก้ไขให้ถูกต้องเพื่อไม่ให้สับสนตอนลงทะเบียนคะแนนค่ะ",
    status: "pending",
    adminResponse: null,
    resolvedBy: null,
    resolvedAt: null
  }
];

if (!fs.existsSync('data')) {
  fs.mkdirSync('data', { recursive: true });
}

fs.writeFileSync('data/issues.json', JSON.stringify(initialIssues, null, 2), 'utf-8');
console.log('Created data/issues.json successfully with 4 sample tickets.');
