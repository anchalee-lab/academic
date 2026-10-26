const { PDFDocument } = require('pdf-lib');
const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
const fs = require('fs');
const path = require('path');

async function generateAllSingleClasses() {
  const outDir = path.join(__dirname, '..', 'student_single');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const grades = ['ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'];
  let totalCount = 0;

  for (const g of grades) {
    const filePath = path.join(__dirname, '..', 'student', `${g}.pdf`);
    const bytes = fs.readFileSync(filePath);
    const srcDoc = await PDFDocument.load(bytes);
    const pdfjsDoc = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise;

    for (let p = 1; p <= pdfjsDoc.numPages; p++) {
      const page = await pdfjsDoc.getPage(p);
      const textContent = await page.getTextContent();
      
      const topItems = textContent.items.filter(it => it.transform[5] > 421);
      const botItems = textContent.items.filter(it => it.transform[5] <= 421);
      
      const topText = topItems.map(it => it.str).join(' ');
      const botText = botItems.map(it => it.str).join(' ');

      const findClass = (text) => {
        const cleaned = text.replace(/\s+/g, '');
        const m = cleaned.match(/ชั้นม\.?(\d+\/\d+)/);
        return m ? 'ม.' + m[1] : null;
      };

      const topClass = findClass(topText);
      const botClass = findClass(botText);
      const srcPage = srcDoc.getPages()[p - 1];

      // Top Class
      if (topClass) {
        const outDoc = await PDFDocument.create();
        const embedded = await outDoc.embedPage(srcPage);
        const newPage = outDoc.addPage([595.22, 421]);
        newPage.drawPage(embedded, { x: 0, y: -421 });
        const outBytes = await outDoc.save();
        const fileName = topClass.replace('/', '-') + '.pdf';
        fs.writeFileSync(path.join(outDir, fileName), outBytes);
        totalCount++;
      }

      // Bottom Class
      if (botClass) {
        const outDoc = await PDFDocument.create();
        const embedded = await outDoc.embedPage(srcPage);
        const newPage = outDoc.addPage([595.22, 421]);
        newPage.drawPage(embedded, { x: 0, y: 0 });
        const outBytes = await outDoc.save();
        const fileName = botClass.replace('/', '-') + '.pdf';
        fs.writeFileSync(path.join(outDir, fileName), outBytes);
        totalCount++;
      }
    }
  }

  console.log(`[Success] Generated ${totalCount} individual standalone class timetables in ${outDir}`);
}

if (require.main === module) {
  generateAllSingleClasses().catch(console.error);
}

module.exports = { generateAllSingleClasses };
