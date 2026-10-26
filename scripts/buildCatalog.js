const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');

async function buildCatalog() {
  const catalog = {
    schoolName: 'โรงเรียนหาดใหญ่วิทยาลัย',
    term: 'ภาคเรียนที่ 2',
    academicYear: '2569',
    updatedAt: new Date().toISOString(),
    students: [],
    teachers: [],
    rooms: []
  };

  // 1. STUDENTS
  const studentFiles = fs.readdirSync('student').filter(f => f.endsWith('.pdf'));
  for (const f of studentFiles) {
    const buf = fs.readFileSync(path.join('student', f));
    const parser = new PDFParse(new Uint8Array(buf));
    await parser.load();
    const textObj = await parser.getText();
    const grade = f.replace('.pdf', '');

    textObj.pages.forEach((page, pIdx) => {
      const pageText = page.text;
      const matchesSimple = [...pageText.matchAll(/ชั้น\s*(ม\.\s*\d+\/\d+)/g)];
      
      matchesSimple.forEach(m => {
        const className = m[1].replace(/\s+/g, '');
        const sub = pageText.substring(m.index, m.index + 140);
        const roomMatch = sub.match(/ห้องเรียนประจํา\s*([^\n\r\t]+)/);
        const periodMatch = sub.match(/จํานวนคาบที่\s*(\d+)/);
        
        let room = roomMatch ? roomMatch[1].replace(/จํานวนคาบ.*$/, '').trim() : '';
        let program = 'ห้องเรียนทั่วไป';
        if (room.includes('EP') || className.includes('EP')) program = 'English Program (EP)';
        else if (room.includes('SMA')) program = 'SMA (ห้องเรียนส่งเสริมความเป็นเลิศด้านคณิต-วิทย์)';
        else if (room.includes('SMTE') || room.includes('SMT')) program = 'SMTE / SMT (วิทยาศาสตร์และคณิตศาสตร์)';
        else if (room.includes('EIS')) program = 'EIS (English for Integrated Studies)';

        // Class number parsing for sorting
        const parts = className.replace('ม.', '').split('/');
        const gNum = parseInt(parts[0], 10) || 0;
        const cNum = parseInt(parts[1], 10) || 0;

        const singleFileName = `${className.replace('/', '-')}.pdf`;
        catalog.students.push({
          id: `stu-${gNum}-${cNum}`,
          grade: grade,
          gradeNum: gNum,
          classNum: cNum,
          className: className,
          room: room,
          program: program,
          periods: periodMatch ? parseInt(periodMatch[1], 10) : null,
          pdf: f,
          page: pIdx + 1,
          singlePdf: singleFileName,
          singlePdfUrl: `/pdf/student-single/${encodeURIComponent(singleFileName)}`,
          pdfUrl: `/pdf/student/${encodeURIComponent(f)}#page=${pIdx + 1}`
        });
      });
    });
    await parser.destroy();
  }

  // Deduplicate and sort students
  const studentMap = new Map();
  catalog.students.forEach(s => {
    const key = s.className;
    if (!studentMap.has(key)) {
      studentMap.set(key, s);
    }
  });
  catalog.students = Array.from(studentMap.values()).sort((a, b) => {
    if (a.gradeNum !== b.gradeNum) return a.gradeNum - b.gradeNum;
    return a.classNum - b.classNum;
  });

  // 2. TEACHERS
  const teacherFiles = fs.readdirSync('teacher').filter(f => f.endsWith('.pdf'));
  for (const f of teacherFiles) {
    const buf = fs.readFileSync(path.join('teacher', f));
    const parser = new PDFParse(new Uint8Array(buf));
    await parser.load();
    const textObj = await parser.getText();
    const dept = f.replace('.pdf', '');

    textObj.pages.forEach((page, pIdx) => {
      const pageText = page.text;
      const matches = [...pageText.matchAll(/ชื่อ-สกุล\s*([^\n\r]+)/g)];
      matches.forEach(m => {
        const raw = m[1].trim();
        const parts = raw.split(/\s+จํานวนคาบที่/);
        let namePart = parts[0].trim();
        let periods = parts[1] ? parseInt(parts[1].trim(), 10) : null;
        let code = '';
        let name = namePart;
        const codeMatch = namePart.match(/^(\d+|\S+)\s+(.+)$/);
        if (codeMatch && /^\d+$/.test(codeMatch[1])) {
          code = codeMatch[1];
          name = codeMatch[2];
        }
        catalog.teachers.push({
          id: `tch-${dept}-${code || name.replace(/\s+/g, '_')}`,
          department: dept,
          code: code,
          name: name,
          fullName: code ? `${code} ${name}` : name,
          periods: periods,
          pdf: f,
          page: pIdx + 1,
          pdfUrl: `/pdf/teacher/${encodeURIComponent(f)}#page=${pIdx + 1}`
        });
      });
    });
    await parser.destroy();
  }

  // Deduplicate and sort teachers
  const teacherMap = new Map();
  catalog.teachers.forEach(t => {
    const key = `${t.department}-${t.code}-${t.name}`;
    if (!teacherMap.has(key)) {
      teacherMap.set(key, t);
    }
  });
  catalog.teachers = Array.from(teacherMap.values()).sort((a, b) => {
    if (a.department !== b.department) return a.department.localeCompare(b.department, 'th');
    const codeA = parseInt(a.code, 10) || 9999;
    const codeB = parseInt(b.code, 10) || 9999;
    if (codeA !== codeB) return codeA - codeB;
    return a.name.localeCompare(b.name, 'th');
  });

  // Match single-teacher PDFs
  const teacherSingleFiles = fs.existsSync('teacher_single') ? fs.readdirSync('teacher_single') : [];
  catalog.teachers.forEach(t => {
    const match = teacherSingleFiles.find(f => {
      if (!f.startsWith(t.department + '_')) return false;
      if (t.code && f.includes(t.code)) return true;
      const cleanName = t.name.replace(/\s+/g, ' ').trim();
      return f.includes(cleanName.slice(0, 10));
    });
    if (match) {
      t.singlePdf = match;
      t.singlePdfUrl = `/pdf/teacher-single/${encodeURIComponent(match)}`;
    }
  });

  // 3. CLASSROOMS
  const roomSingleFiles = fs.existsSync('classroom_single') ? fs.readdirSync('classroom_single') : [];
  const roomFiles = fs.readdirSync('classroom').filter(f => f.endsWith('.pdf'));
  for (const f of roomFiles) {
    const buf = fs.readFileSync(path.join('classroom', f));
    const parser = new PDFParse(new Uint8Array(buf));
    await parser.load();
    const textObj = await parser.getText();
    const building = f.replace('.pdf', '');

    textObj.pages.forEach((page, pIdx) => {
      const pageText = page.text;
      const pageNum = pIdx + 1;
      const singleMatch = roomSingleFiles.find(sf => sf.startsWith(`${building}_P${pageNum}_`));
      const singlePdf = singleMatch || null;
      const singlePdfUrl = singleMatch ? `/pdf/classroom-single/${encodeURIComponent(singleMatch)}` : null;

      const matches = [...pageText.matchAll(/ตารางการใช้ห้อง\s+([^\n\r]+)/g)];
      if (matches.length > 0) {
        matches.forEach(m => {
          const line = m[1].trim();
          let roomName = line.replace(/ภาคเรียนที่.*$/, '').trim();
          let purpose = '';
          if (roomName.includes('ห้องของ')) {
            const spl = roomName.split('ห้องของ');
            roomName = spl[0].trim();
            purpose = spl[1].trim();
          }
          catalog.rooms.push({
            id: `rm-${building}-${roomName.replace(/\s+/g, '_')}`,
            building: building,
            roomName: roomName,
            purpose: purpose,
            pdf: f,
            page: pageNum,
            singlePdf: singlePdf,
            singlePdfUrl: singlePdfUrl,
            pdfUrl: `/pdf/classroom/${encodeURIComponent(f)}#page=${pageNum}`
          });
        });
      } else {
        catalog.rooms.push({
          id: `rm-${building}-p${pageNum}`,
          building: building,
          roomName: `${building} (หน้า ${pageNum})`,
          purpose: '',
          pdf: f,
          page: pageNum,
          singlePdf: singlePdf,
          singlePdfUrl: singlePdfUrl,
          pdfUrl: `/pdf/classroom/${encodeURIComponent(f)}#page=${pageNum}`
        });
      }
    });
    await parser.destroy();
  }

  // Deduplicate and sort rooms
  const roomMap = new Map();
  catalog.rooms.forEach(r => {
    const key = `${r.building}-${r.roomName}`;
    if (!roomMap.has(key)) {
      roomMap.set(key, r);
    }
  });
  catalog.rooms = Array.from(roomMap.values()).sort((a, b) => {
    if (a.building !== b.building) return a.building.localeCompare(b.building, 'th');
    return a.roomName.localeCompare(b.roomName, 'th', { numeric: true });
  });

  if (!fs.existsSync('data')) {
    fs.mkdirSync('data', { recursive: true });
  }

  fs.writeFileSync('data/catalog.json', JSON.stringify(catalog, null, 2), 'utf-8');
  console.log(`Successfully built data/catalog.json:`);
  console.log(`- Students: ${catalog.students.length} classes`);
  console.log(`- Teachers: ${catalog.teachers.length} teachers`);
  console.log(`- Rooms: ${catalog.rooms.length} rooms/spaces`);
}

buildCatalog().catch(console.error);
