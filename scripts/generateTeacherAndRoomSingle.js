const { PDFDocument } = require('pdf-lib');
const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
const fs = require('fs');
const path = require('path');

// Safe file name helper
function safeFilename(str) {
  return str.replace(/[\/\\:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim();
}

// 1. GENERATE SINGLE TEACHER PDFs (210 teachers)
async function generateSingleTeachers() {
  const outDir = path.join(__dirname, '..', 'teacher_single');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const teacherFiles = fs.readdirSync('teacher').filter(f => f.endsWith('.pdf'));
  let count = 0;

  for (const f of teacherFiles) {
    const dept = f.replace('.pdf', '');
    const bytes = fs.readFileSync(path.join('teacher', f));
    const srcDoc = await PDFDocument.load(bytes);
    const pdfjsDoc = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise;

    for (let p = 1; p <= pdfjsDoc.numPages; p++) {
      const page = await pdfjsDoc.getPage(p);
      const tc = await page.getTextContent();
      const topItems = tc.items.filter(it => it.transform[5] > 421);
      const botItems = tc.items.filter(it => it.transform[5] <= 421);

      const parseTeacher = (items) => {
        const text = items.map(it => it.str).join(' ').trim();
        const m = text.match(/ชื่อ\s*-\s*สกุล\s+([^\n\r]+?)(?:\s+จํานวนคาบที่|$)/);
        if (!m) return null;
        let raw = m[1].replace(/\s+/g, ' ').trim();
        raw = raw.replace(/จํานวนคาบ.*$/, '').trim();
        return raw;
      };

      const topTeacher = parseTeacher(topItems);
      const botTeacher = parseTeacher(botItems);
      const srcPage = srcDoc.getPages()[p - 1];

      // Top Teacher
      if (topTeacher) {
        const outDoc = await PDFDocument.create();
        const embedded = await outDoc.embedPage(srcPage);
        const newPage = outDoc.addPage([595.22, 421]);
        newPage.drawPage(embedded, { x: 0, y: -421 });
        const outBytes = await outDoc.save();
        const filename = safeFilename(`${dept}_${topTeacher}`) + '.pdf';
        fs.writeFileSync(path.join(outDir, filename), outBytes);
        count++;
      }

      // Bottom Teacher
      if (botTeacher) {
        const outDoc = await PDFDocument.create();
        const embedded = await outDoc.embedPage(srcPage);
        const newPage = outDoc.addPage([595.22, 421]);
        newPage.drawPage(embedded, { x: 0, y: 0 });
        const outBytes = await outDoc.save();
        const filename = safeFilename(`${dept}_${botTeacher}`) + '.pdf';
        fs.writeFileSync(path.join(outDir, filename), outBytes);
        count++;
      }
    }
  }

  console.log(`[Success] Generated ${count} single-teacher PDFs in ${outDir}`);
  return count;
}

// 2. GENERATE SINGLE CLASSROOM PDFs (138 rooms)
async function generateSingleClassrooms() {
  const outDir = path.join(__dirname, '..', 'classroom_single');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const roomFiles = fs.readdirSync('classroom').filter(f => f.endsWith('.pdf'));
  let count = 0;

  for (const f of roomFiles) {
    const building = f.replace('.pdf', '');
    const bytes = fs.readFileSync(path.join('classroom', f));
    const srcDoc = await PDFDocument.load(bytes);
    const pdfjsDoc = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise;

    for (let p = 1; p <= pdfjsDoc.numPages; p++) {
      const page = await pdfjsDoc.getPage(p);
      const tc = await page.getTextContent();
      const text = tc.items.map(it => it.str).join(' ');
      const m = text.match(/ตารางการใช้ห้อง\s+([^\n\r]+?)(?:\s+ภาคเรียนที่|$)/);
      let rName = m ? m[1].replace(/\s+/g, ' ').trim() : `หน้า_${p}`;

      const outDoc = await PDFDocument.create();
      const [copiedPage] = await outDoc.copyPages(srcDoc, [p - 1]);
      outDoc.addPage(copiedPage);
      const outBytes = await outDoc.save();

      const filename = safeFilename(`${building}_P${p}_${rName}`) + '.pdf';
      fs.writeFileSync(path.join(outDir, filename), outBytes);
      count++;
    }
  }

  console.log(`[Success] Generated ${count} single-classroom PDFs in ${outDir}`);
  return count;
}

async function main() {
  await generateSingleTeachers();
  await generateSingleClassrooms();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { generateSingleTeachers, generateSingleClassrooms };
